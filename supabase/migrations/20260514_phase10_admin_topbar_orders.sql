-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.73 — extend admin notification RPCs for the Orders icon
-- Date: 2026-05-14
-- Idempotent: safe to re-run.
--
-- The new 📦 Orders icon in AdminTopBar combines:
--   • share_modification_requests (status pending / pending_super_admin)
--   • fee_unit_requests           (status pending)
--
-- The unified counts RPC (Phase 10.40) already covers fees but lacks
-- a `shares` field. Same for the items RPC — it lacks a 'shares'-typed
-- UNION branch.
--
-- This migration replaces both RPCs in a single drop-in:
--   • get_admin_notification_counts() — now returns extra `shares` + `share_mods` fields and adds them to `total`
--   • get_admin_notification_items(p_limit) — now includes a 'shares' type branch from share_modification_requests
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_admin_notification_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kyc INT := 0;
  v_disputes INT := 0;
  v_fees INT := 0;
  v_support INT := 0;
  v_ambassadors INT := 0;
  v_healthcare INT := 0;
  v_orphans INT := 0;
  v_payment_proofs INT := 0;
  v_shares INT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object(
      'kyc', 0, 'disputes', 0, 'fees', 0, 'support', 0,
      'ambassadors', 0, 'healthcare', 0, 'orphans', 0,
      'payment_proofs', 0, 'shares', 0, 'total', 0
    );
  END IF;

  BEGIN
    SELECT COUNT(*) INTO v_kyc
    FROM public.kyc_submissions WHERE status = 'pending';
  EXCEPTION WHEN OTHERS THEN v_kyc := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_disputes
    FROM public.disputes WHERE status = 'open';
  EXCEPTION WHEN OTHERS THEN v_disputes := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_fees
    FROM public.fee_unit_requests WHERE status = 'pending';
  EXCEPTION WHEN OTHERS THEN v_fees := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_support
    FROM public.support_tickets WHERE status IN ('new', 'open', 'in_progress');
  EXCEPTION WHEN OTHERS THEN v_support := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_ambassadors
    FROM public.ambassadors WHERE application_status = 'pending';
  EXCEPTION WHEN OTHERS THEN v_ambassadors := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_healthcare
    FROM public.healthcare_applications WHERE status = 'pending';
  EXCEPTION WHEN OTHERS THEN v_healthcare := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_orphans
    FROM public.sponsorships WHERE status = 'pending';
  EXCEPTION WHEN OTHERS THEN v_orphans := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_payment_proofs
    FROM public.payment_proofs WHERE status = 'pending';
  EXCEPTION WHEN OTHERS THEN v_payment_proofs := 0; END;

  -- Phase 10.73 — share modification requests
  BEGIN
    SELECT COUNT(*) INTO v_shares
    FROM public.share_modification_requests
    WHERE status IN ('pending', 'pending_super_admin');
  EXCEPTION WHEN OTHERS THEN v_shares := 0; END;

  RETURN jsonb_build_object(
    'kyc', v_kyc,
    'disputes', v_disputes,
    'fees', v_fees,
    'support', v_support,
    'ambassadors', v_ambassadors,
    'healthcare', v_healthcare,
    'orphans', v_orphans,
    'payment_proofs', v_payment_proofs,
    'shares', v_shares,
    'total', v_kyc + v_disputes + v_fees + v_support
             + v_ambassadors + v_healthcare + v_orphans
             + v_payment_proofs + v_shares
  );
END
$$;

REVOKE ALL ON FUNCTION public.get_admin_notification_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_notification_counts() TO authenticated;


-- ─── 2. Items RPC — extend with 'shares' branch ────────────────
CREATE OR REPLACE FUNCTION public.get_admin_notification_items(p_limit INT DEFAULT 12)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH unified AS (
    SELECT * FROM (
      -- KYC
      (SELECT
         'kyc-' || k.id::TEXT AS id,
         'kyc' AS type,
         '🛡️' AS icon,
         'طلب KYC من ' || COALESCE(p.full_name, p.username, 'مستخدم') AS title,
         COALESCE(k.city, '') AS body,
         k.submitted_at AS time,
         '/admin?tab=users' AS href
       FROM public.kyc_submissions k
       LEFT JOIN public.profiles p ON p.id = k.user_id
       WHERE k.status = 'pending'
       ORDER BY k.submitted_at DESC
       LIMIT 5)
      UNION ALL
      -- Disputes
      (SELECT
         'dispute-' || d.id::TEXT AS id,
         'dispute' AS type,
         '⚖️' AS icon,
         'نزاع جديد ' || COALESCE(SUBSTRING(d.id::TEXT, 1, 8), '') AS title,
         COALESCE(d.reason, '') AS body,
         d.opened_at AS time,
         '/admin?tab=users' AS href
       FROM public.disputes d
       WHERE d.status = 'open'
       ORDER BY d.opened_at DESC
       LIMIT 5)
      UNION ALL
      -- Fee requests
      (SELECT
         'fee-' || r.id::TEXT AS id,
         'fee' AS type,
         '💎' AS icon,
         'طلب شحن وحدات من ' || COALESCE(p.full_name, p.username, 'مستخدم') AS title,
         r.amount_requested::TEXT || ' وحدة' AS body,
         r.submitted_at AS time,
         '/admin?tab=fees' AS href
       FROM public.fee_unit_requests r
       LEFT JOIN public.profiles p ON p.id = r.user_id
       WHERE r.status = 'pending'
       ORDER BY r.submitted_at DESC
       LIMIT 5)
      UNION ALL
      -- Support
      (SELECT
         'support-' || t.id::TEXT AS id,
         'support' AS type,
         '💬' AS icon,
         'تذكرة دعم ' || COALESCE(SUBSTRING(t.id::TEXT, 1, 8), '') AS title,
         COALESCE(t.subject, '') AS body,
         t.created_at AS time,
         '/admin?tab=support_inbox' AS href
       FROM public.support_tickets t
       WHERE t.status IN ('new', 'open', 'in_progress')
       ORDER BY t.created_at DESC
       LIMIT 5)
      UNION ALL
      -- Ambassadors
      (SELECT
         'ambassador-' || a.id::TEXT AS id,
         'ambassador' AS type,
         '🌟' AS icon,
         'طلب سفير من ' || COALESCE(p.full_name, p.username, 'مستخدم') AS title,
         COALESCE(LEFT(a.application_reason, 60), '') AS body,
         a.applied_at AS time,
         '/admin?tab=ambassadors_admin' AS href
       FROM public.ambassadors a
       LEFT JOIN public.profiles p ON p.id = a.user_id
       WHERE a.application_status = 'pending'
       ORDER BY a.applied_at DESC
       LIMIT 5)
      UNION ALL
      -- Healthcare
      (SELECT
         'healthcare-' || h.id::TEXT AS id,
         'healthcare' AS type,
         '🏥' AS icon,
         'طلب رعاية من ' || COALESCE(p.full_name, p.username, 'مستخدم') AS title,
         COALESCE(LEFT(h.diagnosis, 60), '') AS body,
         h.submitted_at AS time,
         '/admin?tab=healthcare_admin' AS href
       FROM public.healthcare_applications h
       LEFT JOIN public.profiles p ON p.id = h.user_id
       WHERE h.status = 'pending'
       ORDER BY h.submitted_at DESC
       LIMIT 5)
      UNION ALL
      -- Phase 10.73 — share modification requests
      (SELECT
         'shares-' || smr.id::TEXT AS id,
         'shares' AS type,
         '📈' AS icon,
         'طلب تعديل حصص — ' || COALESCE(pr.name, 'مشروع') AS title,
         CASE smr.modification_type
           WHEN 'increase' THEN 'زيادة ↑ ' || smr.shares_amount::TEXT
           WHEN 'decrease' THEN 'تخفيض ↓ ' || smr.shares_amount::TEXT
           ELSE smr.modification_type::TEXT
         END AS body,
         smr.created_at AS time,
         '/admin?tab=shares' AS href
       FROM public.share_modification_requests smr
       LEFT JOIN public.projects pr ON pr.id = smr.project_id
       WHERE smr.status IN ('pending', 'pending_super_admin')
       ORDER BY smr.created_at DESC
       LIMIT 5)
    ) AS combined
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT *
    FROM unified
    ORDER BY time DESC NULLS LAST
    LIMIT GREATEST(0, LEAST(p_limit, 50))
  ) t;

  RETURN v_items;
EXCEPTION WHEN undefined_table OR undefined_column THEN
  RETURN '[]'::jsonb;
END
$$;

REVOKE ALL ON FUNCTION public.get_admin_notification_items(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_notification_items(INT) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.73 applied:';
  RAISE NOTICE '  ✓ get_admin_notification_counts now exposes `shares` + adds it to `total`';
  RAISE NOTICE '  ✓ get_admin_notification_items now includes a 7th UNION branch for share modification requests (type=''shares'')';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
