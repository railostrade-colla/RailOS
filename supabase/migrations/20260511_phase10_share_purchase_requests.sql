-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.66 — admin share-purchase-requests RPCs
-- Date: 2026-05-11
-- Idempotent: safe to re-run.
--
-- Repurposes the "طلبات الحصص" admin tab from "share count modification
-- by super_admin" (which lives in /admin?tab=share_modification) to
-- "user share-purchase requests pending payment confirmation".
--
-- Provides:
--   1. get_share_purchase_requests_admin(p_status, p_limit) — joined
--      deals + payment_proofs + profiles + projects in one round-trip.
--      Returns rows with full detail: buyer, seller, project, shares,
--      amount, payment_method, proof_image_url, transaction_reference,
--      status, timestamps.
--   2. admin_confirm_deal_payment(deal_id) — admin verifies the
--      payment proof matches and force-completes the deal (acts in
--      place of the seller's "release shares" call).
--   3. admin_cancel_deal(deal_id, reason) — admin cancels a pending
--      deal (e.g. fake proof, expired, fraudulent). Returns shares to
--      the seller and notifies both parties.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. List share-purchase requests for admin review ─────────────
DROP FUNCTION IF EXISTS public.get_share_purchase_requests_admin(TEXT, INT);
CREATE OR REPLACE FUNCTION public.get_share_purchase_requests_admin(
  p_status TEXT DEFAULT 'all',  -- 'all' | 'pending' | 'submitted' | 'disputed' | 'completed' | 'cancelled'
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
        d.shares_amount,
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
        -- Latest payment proof (if any)
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
        -- Has a dispute been opened?
        EXISTS (
          SELECT 1 FROM public.disputes dx WHERE dx.deal_id = d.id
        ) AS has_dispute
      FROM public.deals d
      LEFT JOIN public.profiles bp  ON bp.id = d.buyer_id
      LEFT JOIN auth.users    bu  ON bu.id = d.buyer_id
      LEFT JOIN public.profiles sp  ON sp.id = d.seller_id
      LEFT JOIN public.projects proj ON proj.id = d.project_id
      WHERE
        CASE p_status
          WHEN 'all' THEN TRUE
          WHEN 'pending' THEN d.status::TEXT IN ('pending', 'pending_payment', 'awaiting_payment')
          WHEN 'submitted' THEN d.status::TEXT IN ('payment_submitted', 'paid', 'pending_release')
          WHEN 'disputed' THEN d.status::TEXT IN ('in_dispute', 'disputed')
          WHEN 'completed' THEN d.status::TEXT = 'completed'
          WHEN 'cancelled' THEN d.status::TEXT IN ('cancelled', 'cancelled_mutual', 'cancelled_expired')
          ELSE TRUE
        END
      ORDER BY d.created_at DESC
      LIMIT GREATEST(0, LEAST(p_limit, 1000))
    ) t;
  EXCEPTION WHEN OTHERS THEN
    v_result := '[]'::jsonb;
  END;

  RETURN COALESCE(v_result, '[]'::jsonb);
END
$$;

REVOKE ALL ON FUNCTION public.get_share_purchase_requests_admin(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_share_purchase_requests_admin(TEXT, INT) TO authenticated;


-- ─── 2. Admin confirms deal payment ───────────────────────────────
DROP FUNCTION IF EXISTS public.admin_confirm_deal_payment(UUID);
CREATE OR REPLACE FUNCTION public.admin_confirm_deal_payment(p_deal_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_deal   RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id;
  IF v_deal.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_deal.status::TEXT NOT IN ('payment_submitted', 'paid', 'pending_release', 'in_dispute', 'pending_payment') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_status', 'current_status', v_deal.status::TEXT);
  END IF;

  -- Mark deal as completed (the existing trg_deal_completion trigger
  -- handles the actual share transfer + balance updates).
  UPDATE public.deals
     SET status = 'completed',
         completed_at = COALESCE(completed_at, NOW())
   WHERE id = p_deal_id;

  -- Audit
  BEGIN
    PERFORM public.log_admin_action(
      'confirm_deal_payment', 'deal', p_deal_id,
      jsonb_build_object(
        'buyer_id', v_deal.buyer_id,
        'seller_id', v_deal.seller_id,
        'amount', v_deal.total_amount,
        'shares', v_deal.shares_amount
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Notify buyer + seller (best-effort)
  BEGIN
    PERFORM public.create_user_notification(
      v_deal.buyer_id,
      'deal_completed'::notification_type,
      '✅ تم تأكيد دفعتك',
      'وصلت دفعة الصفقة وتمّ تحويل الحصص لمحفظتك',
      'high'::notification_priority,
      '/deals/' || p_deal_id::TEXT
    );
    PERFORM public.create_user_notification(
      v_deal.seller_id,
      'deal_completed'::notification_type,
      '💰 صفقتك مكتملة',
      'الإدارة أكّدت استلام الدفعة — تمّ نقل الحصص إلى المشتري',
      'high'::notification_priority,
      '/deals/' || p_deal_id::TEXT
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE, 'deal_id', p_deal_id);
END
$$;

REVOKE ALL ON FUNCTION public.admin_confirm_deal_payment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_confirm_deal_payment(UUID) TO authenticated;


-- ─── 3. Admin cancels a deal ──────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_cancel_deal(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.admin_cancel_deal(p_deal_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_deal RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id;
  IF v_deal.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_deal.status::TEXT = 'completed' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'already_completed');
  END IF;

  UPDATE public.deals
     SET status = 'cancelled_mutual',
         cancelled_at = COALESCE(cancelled_at, NOW()),
         cancellation_reason = COALESCE(p_reason, 'إلغاء من الإدارة')
   WHERE id = p_deal_id;

  BEGIN
    PERFORM public.log_admin_action(
      'cancel_deal', 'deal', p_deal_id,
      jsonb_build_object('reason', p_reason)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Notify both parties
  BEGIN
    PERFORM public.create_user_notification(
      v_deal.buyer_id,
      'deal_cancelled'::notification_type,
      '❌ ألغيت صفقتك',
      COALESCE(p_reason, 'تم إلغاء الصفقة من قبل الإدارة'),
      'urgent'::notification_priority,
      '/deals/' || p_deal_id::TEXT
    );
    PERFORM public.create_user_notification(
      v_deal.seller_id,
      'deal_cancelled'::notification_type,
      '❌ ألغيت صفقة من البيع',
      COALESCE(p_reason, 'تم إلغاء الصفقة من قبل الإدارة'),
      'urgent'::notification_priority,
      '/deals/' || p_deal_id::TEXT
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE, 'deal_id', p_deal_id);
END
$$;

REVOKE ALL ON FUNCTION public.admin_cancel_deal(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_cancel_deal(UUID, TEXT) TO authenticated;


-- ─── Done ─────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.66 applied:';
  RAISE NOTICE '  ✓ get_share_purchase_requests_admin(status, limit)';
  RAISE NOTICE '  ✓ admin_confirm_deal_payment(deal_id)';
  RAISE NOTICE '  ✓ admin_cancel_deal(deal_id, reason)';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
