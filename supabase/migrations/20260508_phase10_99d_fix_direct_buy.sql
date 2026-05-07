-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.99d — Fix submit_direct_buy_request: missing enum + price
-- Date: 2026-05-08
-- Idempotent: safe to re-run.
--
-- Bug: when a buyer clicked "إرسال الطلب" the RPC returned
-- {error: 'deal_insert_failed'} with no detail. Root cause:
--   1. The status `'pending_payment'` is NOT in the deal_status enum
--      (the canonical enum has only pending_seller_approval / accepted
--      / payment_submitted / completed / cancelled / disputed /
--      rejected / expired). Both INSERT attempts in the RPC tried to
--      use 'pending_payment' → enum violation → both branches threw.
--   2. The first INSERT also omitted `price_per_share` which is
--      NOT NULL CHECK > 0 in the schema.
--
-- Fix:
--   • Add 'pending_payment' to deal_status (IF NOT EXISTS, PG 12+).
--   • Re-create submit_direct_buy_request with:
--       - price_per_share always included
--       - share_price > 0 guard before insert
--       - SQLERRM surfaced as `detail` when insert still fails
--       - keeps suspension checks (Phase 10.93) intact
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Extend deal_status enum ───────────────────────────────────
-- Postgres 12+ supports `ADD VALUE IF NOT EXISTS`. We commit this
-- statement first so the new value is available for the function
-- body re-creation below.
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'pending_payment';

-- Some older Postgres versions require COMMITting before using the
-- new enum value. The migration runner handles this; if it doesn't,
-- run this file twice (the second run is a no-op for the ALTER TYPE).


-- ─── 2. Re-create submit_direct_buy_request ───────────────────────
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
  v_uid            UUID := auth.uid();
  v_project        RECORD;
  v_seller_id      UUID;
  v_share_price    BIGINT;
  v_total_amount   BIGINT;
  v_deal_id        UUID;
  v_offering_avail BIGINT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF p_shares_amount IS NULL OR p_shares_amount <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_amount');
  END IF;

  -- Load project with suspension flags + price (preferring market price)
  SELECT
    p.id, p.name,
    COALESCE(p.current_market_price, p.share_price, 0) AS effective_share_price,
    p.share_price,
    p.created_by,
    p.status::TEXT                AS status,
    p.trading_suspended,
    p.trading_suspension_reason,
    p.offering_suspended,
    p.offering_suspension_reason
  INTO v_project
  FROM public.projects p
  WHERE p.id = p_project_id;

  IF v_project.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'project_not_found');
  END IF;

  -- Phase 10.93 — suspension checks
  IF v_project.trading_suspended THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error',  'trading_suspended',
      'reason', COALESCE(v_project.trading_suspension_reason, 'التداول معلق مؤقتاً')
    );
  END IF;
  IF v_project.status NOT IN ('active', 'launching', 'open') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'project_not_active');
  END IF;
  IF v_project.offering_suspended THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error',  'offering_suspended',
      'reason', COALESCE(v_project.offering_suspension_reason, 'شراء الحصص الجديدة معلق مؤقتاً')
    );
  END IF;

  -- Phase 10.99d — share price MUST be > 0 (deals.price_per_share check)
  v_share_price := v_project.effective_share_price;
  IF v_share_price IS NULL OR v_share_price <= 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error',  'invalid_share_price',
      'detail', 'سعر الحصة على المشروع يجب أن يكون أكبر من صفر'
    );
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

  -- Seller = project owner (created_by). Block self-buy.
  v_seller_id := COALESCE(v_project.created_by, v_uid);
  IF v_seller_id = v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cannot_buy_own_project');
  END IF;

  v_total_amount := p_shares_amount * v_share_price;

  -- Insert the deal — full column set with price_per_share. SQLERRM
  -- surfaced as `detail` so any leftover schema mismatch is debuggable.
  BEGIN
    INSERT INTO public.deals (
      project_id, buyer_id, seller_id,
      shares, price_per_share,
      deal_type, status
    ) VALUES (
      p_project_id, v_uid, v_seller_id,
      p_shares_amount, v_share_price,
      'primary', 'pending_payment'
    )
    RETURNING id INTO v_deal_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error',   'deal_insert_failed',
      'detail',  SQLERRM,
      'sqlstate', SQLSTATE
    );
  END;

  -- Notify admins (best-effort; non-fatal on schema drift)
  BEGIN
    INSERT INTO public.notifications (user_id, title, body, type, metadata)
    SELECT
      pr.id,
      'طلب شراء مباشر جديد',
      format('طلب شراء %s حصة من مشروع %s', p_shares_amount, v_project.name),
      'deal_request',
      jsonb_build_object('deal_id', v_deal_id, 'project_id', p_project_id)
    FROM public.profiles pr
    WHERE pr.role IN ('admin', 'super_admin');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success',      TRUE,
    'deal_id',      v_deal_id,
    'total_amount', v_total_amount,
    'expires_at',   (NOW() + INTERVAL '48 hours')::TEXT
  );
END $$;

GRANT EXECUTE ON FUNCTION public.submit_direct_buy_request(UUID, BIGINT) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.99d applied:';
  RAISE NOTICE '  ✓ deal_status enum: pending_payment value added (IF NOT EXISTS)';
  RAISE NOTICE '  ✓ submit_direct_buy_request: price_per_share always included';
  RAISE NOTICE '  ✓ share_price > 0 guard before INSERT';
  RAISE NOTICE '  ✓ SQLERRM surfaced as `detail` for any future schema drift';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
