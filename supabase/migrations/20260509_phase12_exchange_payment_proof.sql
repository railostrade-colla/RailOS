-- ═══════════════════════════════════════════════════════════════════
-- Phase 12.7 — exchange-deal payment-proof flow
-- Date: 2026-05-09
-- Idempotent.
--
-- Two adjustments so the founder's exchange flow can complete:
--   1. submit_payment_proof currently only accepts deals in
--      ('pending_payment', 'pending', 'awaiting_payment'). Exchange
--      deals open in 'accepted' (after Phase 12.7 fix), so the RPC
--      rejects every legit proof upload with `invalid_status`.
--      → extend the allowed list to include 'accepted'.
--   2. payment-proofs bucket is private with owner-only RLS — the
--      seller can't render the proof image because they don't own
--      the buyer's folder. Flipping the bucket to `public` is the
--      simplest fix for MVP: path is `<uid>/proof-<ts>.<ext>` which
--      is unguessable, and the URL only ever leaves the deal page
--      (visible to the seller, the buyer, and admins reviewing
--      disputes — all already gated by the deals RLS upstream).
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Extend submit_payment_proof status allowlist ─────────────
-- We re-create the function with an updated allowlist. The body is
-- otherwise identical to 20260512_phase10_direct_buy_requests.sql.
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

  -- Phase 12.7: 'accepted' is the exchange-deal initial status.
  -- The legacy direct-buy path uses 'pending_payment' / 'pending' /
  -- 'awaiting_payment'; both flows now reach this RPC.
  IF v_deal.status::TEXT NOT IN (
    'accepted',
    'pending_payment', 'pending', 'awaiting_payment'
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error', 'invalid_status',
      'current', v_deal.status::TEXT
    );
  END IF;

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

  UPDATE public.deals
     SET status = 'payment_submitted',
         payment_submitted_at = NOW(),
         updated_at = NOW()
   WHERE id = p_deal_id;

  -- Notify the seller (best-effort)
  BEGIN
    PERFORM public.create_user_notification(
      v_deal.seller_id,
      'payment_received'::notification_type,
      '💰 المشتري أرفق إثبات الدفع',
      'افتح الصفقة وراجع الإثبات قبل تحرير الحصص',
      'high'::notification_priority
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Notify admins for disputes path
  BEGIN
    PERFORM public.notify_all_admins(
      p_title    := '🧾 إثبات دفع جديد',
      p_message  := 'صفقة بانتظار التحقّق من الدفعة (' ||
                    p_amount_paid::TEXT || ' د.ع)',
      p_link_url := '/admin?tab=fees',
      p_priority := 'normal'::notification_priority,
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


-- ─── 2. Make payment-proofs bucket public-read ──────────────────
-- Path remains namespaced by uid (RLS on INSERT still owner-only),
-- but anyone with a deal page open + the proof_image_url can render
-- the image. Acceptable for MVP — no PII beyond the off-platform
-- transaction details the buyer chose to attach.
UPDATE storage.buckets
   SET public = true
 WHERE id = 'payment-proofs';


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 12.7 exchange-payment-proof migration applied:';
  RAISE NOTICE '  ✓ submit_payment_proof now accepts status=''accepted''';
  RAISE NOTICE '  ✓ payment-proofs bucket flipped to public-read';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
