-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.67 — direct-buy from system (offering wallet) RPCs
-- Date: 2026-05-12
-- Idempotent: safe to re-run.
--
-- Founder discovered that the "Direct Buy" flow on /project/[id] was
-- routing through a MOCK createDeal() in lib/realtime/RealtimeProvider
-- — it never wrote to the deals table, so admin panels stayed empty.
--
-- This migration ships:
--   1. submit_direct_buy_request(project_id, shares_amount) — creates
--      a real `deals` row with seller=system (project owner), status
--      = 'pending_payment'. Returns the deal_id so the client can
--      navigate the buyer to "upload payment proof".
--   2. submit_payment_proof(deal_id, payment_method, amount_paid,
--      transaction_reference, proof_image_url, notes) — creates a
--      `payment_proofs` row + advances deal status to
--      'payment_submitted'. Notifies admin via the existing
--      notification fan-out.
--
-- Both are SECURITY DEFINER + caller-gated. They reuse the existing
-- triggers (deal completion, share transfer) so the lifecycle stays
-- consistent.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. submit_direct_buy_request ────────────────────────────────
DROP FUNCTION IF EXISTS public.submit_direct_buy_request(UUID, BIGINT);
CREATE OR REPLACE FUNCTION public.submit_direct_buy_request(
  p_project_id    UUID,
  p_shares_amount BIGINT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_project       RECORD;
  v_seller_id     UUID;
  v_total_amount  BIGINT;
  v_deal_id       UUID;
  v_offering_avail BIGINT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF p_shares_amount IS NULL OR p_shares_amount <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_amount');
  END IF;

  -- Load project + price
  SELECT
    p.id, p.name, p.share_price, p.created_by, p.status::TEXT AS status
  INTO v_project
  FROM public.projects p
  WHERE p.id = p_project_id;

  IF v_project.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'project_not_found');
  END IF;
  IF v_project.status NOT IN ('active', 'launching', 'open') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'project_not_active');
  END IF;

  -- Verify the offering wallet has enough shares
  BEGIN
    SELECT COALESCE(available_shares, 0) INTO v_offering_avail
    FROM public.project_wallets
    WHERE project_id = p_project_id AND wallet_type = 'offering'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_offering_avail := 0;
  END;

  IF v_offering_avail < p_shares_amount THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error', 'insufficient_offering_shares',
      'available', v_offering_avail
    );
  END IF;

  -- The "seller" for direct buy is the project owner (created_by) —
  -- when the admin confirms, the offering wallet decrements and
  -- shares move to the buyer.
  v_seller_id := COALESCE(v_project.created_by, v_uid);

  -- Block self-buy in the rare case where the project owner clicks
  -- their own buy button.
  IF v_seller_id = v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cannot_buy_own_project');
  END IF;

  v_total_amount := p_shares_amount * COALESCE(v_project.share_price, 0);

  -- Insert the deal row.
  -- ⚠ Real schema columns:
  --   • `shares` (not `shares_amount`)
  --   • `total_amount` is a GENERATED column — never write to it
  --   • deal_type enum: primary | secondary | quick_sell
  --   • status default = 'pending_seller_approval'
  INSERT INTO public.deals (
    buyer_id, seller_id, project_id,
    deal_type, shares, price_per_share
  ) VALUES (
    v_uid,
    v_seller_id,
    p_project_id,
    'primary'::deal_type,
    p_shares_amount,
    COALESCE(v_project.share_price, 0)
  )
  RETURNING id INTO v_deal_id;

  -- Notify admins (best-effort — uses helper from Phase 10.61)
  BEGIN
    PERFORM public.notify_all_admins(
      p_title    := '🛒 طلب شراء مباشر جديد',
      p_message  := COALESCE(v_project.name, '—') || ' · ' ||
                    p_shares_amount::TEXT || ' حصة · ' ||
                    v_total_amount::TEXT || ' د.ع',
      p_link_url := '/admin?tab=shares',
      p_priority := 'high'::notification_priority,
      p_metadata := jsonb_build_object(
        'deal_id', v_deal_id,
        'project_id', p_project_id,
        'buyer_id', v_uid
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success',      TRUE,
    'deal_id',      v_deal_id,
    'total_amount', v_total_amount,
    'expires_at',   NOW() + INTERVAL '24 hours'
  );
END
$$;

REVOKE ALL ON FUNCTION public.submit_direct_buy_request(UUID, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_direct_buy_request(UUID, BIGINT) TO authenticated;


-- ─── 2. submit_payment_proof ─────────────────────────────────────
DROP FUNCTION IF EXISTS public.submit_payment_proof(UUID, TEXT, BIGINT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.submit_payment_proof(
  p_deal_id               UUID,
  p_payment_method        TEXT,
  p_amount_paid           BIGINT,
  p_transaction_reference TEXT DEFAULT NULL,
  p_proof_image_url       TEXT DEFAULT NULL,
  p_notes                 TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_deal    RECORD;
  v_proof_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF p_amount_paid IS NULL OR p_amount_paid <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_amount');
  END IF;
  IF p_proof_image_url IS NULL OR length(trim(p_proof_image_url)) = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'proof_required');
  END IF;

  -- Authorize: caller must be the buyer
  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id;
  IF v_deal.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'deal_not_found');
  END IF;
  IF v_deal.buyer_id <> v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_buyer');
  END IF;
  IF v_deal.status::TEXT NOT IN ('pending_payment', 'pending', 'awaiting_payment') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_status', 'current', v_deal.status::TEXT);
  END IF;

  -- Insert the proof row
  INSERT INTO public.payment_proofs (
    deal_id, payment_method, amount_paid,
    transaction_reference, proof_image_url, notes
  ) VALUES (
    p_deal_id,
    p_payment_method::payment_method,
    p_amount_paid,
    NULLIF(trim(p_transaction_reference), ''),
    p_proof_image_url,
    NULLIF(trim(p_notes), '')
  )
  RETURNING id INTO v_proof_id;

  -- Advance deal status
  UPDATE public.deals
     SET status = 'payment_submitted'
   WHERE id = p_deal_id;

  -- Notify admins
  BEGIN
    PERFORM public.notify_all_admins(
      p_title    := '🧾 إثبات دفع جديد للمراجعة',
      p_message  := 'صفقة شراء مباشر بانتظار التحقّق من الدفعة (' ||
                    p_amount_paid::TEXT || ' د.ع)',
      p_link_url := '/admin?tab=shares',
      p_priority := 'high'::notification_priority,
      p_metadata := jsonb_build_object(
        'deal_id', p_deal_id,
        'proof_id', v_proof_id
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success',  TRUE,
    'deal_id',  p_deal_id,
    'proof_id', v_proof_id
  );
END
$$;

REVOKE ALL ON FUNCTION public.submit_payment_proof(UUID, TEXT, BIGINT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_payment_proof(UUID, TEXT, BIGINT, TEXT, TEXT, TEXT) TO authenticated;


-- ─── Done ─────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.67 applied:';
  RAISE NOTICE '  ✓ submit_direct_buy_request(project_id, shares)';
  RAISE NOTICE '  ✓ submit_payment_proof(deal_id, method, amount, ref, url, notes)';
  RAISE NOTICE '  ✓ Both notify all admins via notify_all_admins helper';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
