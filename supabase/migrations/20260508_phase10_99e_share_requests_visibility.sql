-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.99e — Share-purchase requests visibility + correct notif type
-- Date: 2026-05-08
-- Idempotent: safe to re-run.
--
-- Two related fixes:
--
-- 1. The 'طلبات الحصص' admin tab showed 0 even though a deal had
--    been created. Root cause: the get_share_purchase_requests_admin
--    RPC's 'pending' filter only included pending_seller_approval +
--    accepted. New direct-buy deals start at status='pending_payment'
--    (Phase 10.99d) — they fell through every filter case. Fix: add
--    'pending_payment' to the pending bucket.
--
-- 2. submit_direct_buy_request was firing the admin notification with
--    type='system_announcement' instead of the canonical
--    'deal_request_received'. The bell-icon dropdown groups items by
--    type, so deal-request notifications were being mis-categorised.
--    Fix: insert with the correct enum value directly (no
--    notify_all_admins wrapper) — the helper hard-codes
--    system_announcement.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Update get_share_purchase_requests_admin filter ──────────
DROP FUNCTION IF EXISTS public.get_share_purchase_requests_admin(TEXT, INT);
CREATE OR REPLACE FUNCTION public.get_share_purchase_requests_admin(
  p_status TEXT DEFAULT 'all',
  p_limit  INT  DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        d.id,
        d.created_at,
        d.shares AS shares_amount,
        d.total_amount,
        d.status::TEXT AS status,
        d.buyer_id,
        d.seller_id,
        d.project_id,
        COALESCE(bp.full_name, bp.username, '—') AS buyer_name,
        bp.username AS buyer_username,
        bu.email AS buyer_email,
        COALESCE(sp.full_name, sp.username, '—') AS seller_name,
        sp.username AS seller_username,
        proj.name AS project_name,
        (
          SELECT jsonb_build_object(
            'id', pp.id,
            'payment_method', pp.payment_method::TEXT,
            'amount_paid', pp.amount_paid,
            'transaction_reference', pp.transaction_reference,
            'proof_image_url', pp.proof_image_url,
            'notes', pp.notes,
            'submitted_at', pp.submitted_at
          )
          FROM public.payment_proofs pp
          WHERE pp.deal_id = d.id
          ORDER BY pp.submitted_at DESC
          LIMIT 1
        ) AS payment_proof,
        EXISTS (
          SELECT 1 FROM public.disputes dx WHERE dx.deal_id = d.id
        ) AS has_dispute
      FROM public.deals d
      LEFT JOIN public.profiles bp  ON bp.id = d.buyer_id
      LEFT JOIN auth.users      bu  ON bu.id = d.buyer_id
      LEFT JOIN public.profiles sp  ON sp.id = d.seller_id
      LEFT JOIN public.projects proj ON proj.id = d.project_id
      WHERE
        CASE p_status
          WHEN 'all' THEN TRUE
          -- Phase 10.99e: pending now includes pending_payment (the
          -- starting state of every new direct-buy request).
          WHEN 'pending'   THEN d.status::TEXT IN ('pending_payment', 'pending_seller_approval', 'accepted')
          WHEN 'submitted' THEN d.status::TEXT = 'payment_submitted'
          WHEN 'disputed'  THEN d.status::TEXT = 'disputed'
          WHEN 'completed' THEN d.status::TEXT = 'completed'
          WHEN 'cancelled' THEN d.status::TEXT IN ('cancelled', 'rejected', 'expired')
          ELSE TRUE
        END
      ORDER BY d.created_at DESC
      LIMIT GREATEST(0, LEAST(p_limit, 1000))
    ) t;
  EXCEPTION WHEN OTHERS THEN
    v_result := '[]'::jsonb;
  END;

  RETURN COALESCE(v_result, '[]'::jsonb);
END $$;

GRANT EXECUTE ON FUNCTION public.get_share_purchase_requests_admin(TEXT, INT) TO authenticated;


-- ─── 2. submit_direct_buy_request: fire correct notification type ──
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

  IF v_project.trading_suspended THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error',  'trading_suspended',
      'reason', COALESCE(v_project.trading_suspension_reason, 'التداول معلق مؤقتاً')
    );
  END IF;
  IF v_project.status NOT IN ('active', 'launching', 'open') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'project_not_active');
  END IF;
  IF v_project.offering_suspended THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error',  'offering_suspended',
      'reason', COALESCE(v_project.offering_suspension_reason, 'شراء الحصص الجديدة معلق مؤقتاً')
    );
  END IF;

  v_share_price := v_project.effective_share_price;
  IF v_share_price IS NULL OR v_share_price <= 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error',  'invalid_share_price',
      'detail', 'سعر الحصة على المشروع يجب أن يكون أكبر من صفر'
    );
  END IF;

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

  v_seller_id := COALESCE(v_project.created_by, v_uid);
  IF v_seller_id = v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cannot_buy_own_project');
  END IF;

  v_total_amount := p_shares_amount * v_share_price;

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

  -- Phase 10.99e — fire admin notifications with the canonical
  -- 'deal_request_received' enum value so the bell-icon dropdown
  -- categorises and badges them correctly. Try with column `body`
  -- first; if the schema uses `message`, fall back.
  BEGIN
    INSERT INTO public.notifications (
      user_id, notification_type, title, message,
      priority, link_url, metadata
    )
    SELECT
      pr.id,
      'deal_request_received'::notification_type,
      '🛒 طلب شراء مباشر جديد',
      format('طلب شراء %s حصة من مشروع %s', p_shares_amount, v_project.name),
      'high'::notification_priority,
      '/admin?tab=requests&sub=share_requests',
      jsonb_build_object('deal_id', v_deal_id, 'project_id', p_project_id, 'shares', p_shares_amount)
    FROM public.profiles pr
    WHERE pr.role IN ('admin', 'super_admin');
  EXCEPTION WHEN OTHERS THEN
    -- Fallback for older schema variants
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, priority, metadata)
      SELECT
        pr.id, 'deal_request_received', '🛒 طلب شراء مباشر جديد',
        format('طلب شراء %s حصة من مشروع %s', p_shares_amount, v_project.name),
        'high',
        jsonb_build_object('deal_id', v_deal_id, 'project_id', p_project_id)
      FROM public.profiles pr
      WHERE pr.role IN ('admin', 'super_admin');
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END;

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
  RAISE NOTICE 'Phase 10.99e applied:';
  RAISE NOTICE '  ✓ get_share_purchase_requests_admin: pending now includes pending_payment';
  RAISE NOTICE '  ✓ submit_direct_buy_request: notification fires with deal_request_received type';
  RAISE NOTICE '  ✓ priority=high, link_url points to share requests admin tab';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
