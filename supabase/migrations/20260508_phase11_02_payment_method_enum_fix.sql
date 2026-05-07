-- ═══════════════════════════════════════════════════════════════════
-- Phase 11.02 — Payment-method enum fix + harden submit_payment_proof
-- Date: 2026-05-08
-- Idempotent: safe to re-run.
--
-- Bug: when the buyer picked "Asia Hawala" or "Ki Card" in the
-- direct-buy modal, the proof failed to save silently — the deal
-- stayed at status='pending_payment' with no payment_proofs row,
-- so the admin's details modal showed no proof image.
--
-- Root cause:
--   • The payment_method ENUM in the schema has only 4 values:
--       zain_cash, master_card, bank_transfer, other
--   • CreateDealModal exposes 6 values (adds asia_hawala + ki_card).
--   • submit_payment_proof casts p_payment_method::payment_method
--     which raises 22P02 for the two missing values, the INSERT
--     aborts, and CreateDealModal's try/catch swallows it.
--
-- Fixes:
--   1. ALTER TYPE payment_method ADD VALUE 'asia_hawala' / 'ki_card'
--      (PG 12+, IF NOT EXISTS — idempotent).
--   2. Re-create submit_payment_proof with a wrapping EXCEPTION block
--      that returns a friendly { error: 'invalid_payment_method' /
--      'insert_failed', detail: SQLERRM } instead of crashing.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Extend the enum ───────────────────────────────────────────
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'asia_hawala';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'ki_card';


-- ─── 2. Harden submit_payment_proof ──────────────────────────────
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
  v_method   payment_method;
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

  -- Phase 11.02 — validate the payment_method enum cast up-front so
  -- we return a clean error instead of letting the INSERT crash.
  BEGIN
    v_method := p_payment_method::payment_method;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error',   'invalid_payment_method',
      'detail',  SQLERRM,
      'sent',    p_payment_method
    );
  END;

  -- Authorize: caller must be the buyer
  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id;
  IF v_deal.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'deal_not_found');
  END IF;
  IF v_deal.buyer_id <> v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_buyer');
  END IF;
  IF v_deal.status::TEXT NOT IN ('pending_payment', 'pending', 'awaiting_payment') THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error', 'invalid_status',
      'current', v_deal.status::TEXT
    );
  END IF;

  -- Phase 11.02 — wrap the INSERT so any constraint / RLS / size
  -- failure surfaces as a structured error instead of bubbling up.
  BEGIN
    INSERT INTO public.payment_proofs (
      deal_id, payment_method, amount_paid,
      transaction_reference, proof_image_url, notes
    ) VALUES (
      p_deal_id,
      v_method,
      p_amount_paid,
      NULLIF(trim(p_transaction_reference), ''),
      p_proof_image_url,
      NULLIF(trim(p_notes), '')
    )
    RETURNING id INTO v_proof_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error',   'insert_failed',
      'detail',  SQLERRM,
      'sqlstate', SQLSTATE
    );
  END;

  -- Advance deal status
  UPDATE public.deals
     SET status = 'payment_submitted'
   WHERE id = p_deal_id;

  -- Notify admins (best-effort)
  BEGIN
    INSERT INTO public.notifications (
      user_id, notification_type, title, message,
      priority, link_url, metadata
    )
    SELECT
      pr.id,
      'deal_request_received'::notification_type,
      '🧾 إثبات دفع جديد للمراجعة',
      'صفقة شراء مباشر بانتظار التحقّق من الدفعة (' || p_amount_paid::TEXT || ' د.ع)',
      'high'::notification_priority,
      '/admin?tab=requests_hub',
      jsonb_build_object('deal_id', p_deal_id, 'proof_id', v_proof_id)
    FROM public.profiles pr
    WHERE pr.role IN ('admin', 'super_admin');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success',  TRUE,
    'deal_id',  p_deal_id,
    'proof_id', v_proof_id
  );
END $$;

REVOKE ALL ON FUNCTION public.submit_payment_proof(UUID, TEXT, BIGINT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_payment_proof(UUID, TEXT, BIGINT, TEXT, TEXT, TEXT) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 11.02 applied:';
  RAISE NOTICE '  ✓ payment_method enum: + asia_hawala + ki_card';
  RAISE NOTICE '  ✓ submit_payment_proof: validates enum cast up-front';
  RAISE NOTICE '  ✓ submit_payment_proof: wraps INSERT in EXCEPTION';
  RAISE NOTICE '  ✓ Returns structured error with detail+sqlstate on any failure';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
