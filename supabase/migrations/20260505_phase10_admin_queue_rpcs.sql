-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.38 — admin queue RPCs (bypass PostgREST FK inference)
-- Date: 2026-05-05
-- Idempotent: safe to re-run.
--
-- Production bug — submitted ambassador applications + fee unit
-- requests weren't appearing in the admin panel even though INSERT
-- succeeded. Root cause: the admin SELECT queries used PostgREST's
-- FK-relationship inference (`profile:profiles!user_id (...)`) which
-- silently fails — returns no rows — when the FK constraint isn't
-- declared on the table. RLS was fine; the join was the problem.
--
-- This migration ships two SECURITY DEFINER RPCs that do the join in
-- pure SQL, sidestepping PostgREST entirely. They return clean JSON
-- arrays the admin panels can consume directly.
--
-- Both RPCs:
--   • Gate on public.is_admin() — non-admins get an empty array.
--   • Defensive: every source-table read is wrapped so a missing
--     `profiles` row never sinks the whole query.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. get_ambassadors_admin ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_ambassadors_admin(p_limit INT DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        a.id,
        a.user_id,
        a.application_status,
        a.is_active,
        a.application_reason,
        a.application_experience,
        a.social_media_links,
        a.approved_by,
        a.approved_at,
        a.revoked_by,
        a.revoked_at,
        a.revoke_reason,
        a.admin_notes,
        a.total_referrals,
        a.successful_referrals,
        a.total_rewards_earned,
        a.applied_at,
        -- Profile fields surfaced flat so the client doesn't need a join.
        COALESCE(p.full_name, p.username, '—') AS user_name,
        p.username AS user_handle,
        COALESCE(p.level::TEXT, 'basic') AS user_level
      FROM public.ambassadors a
      LEFT JOIN public.profiles p ON p.id = a.user_id
      ORDER BY a.applied_at DESC NULLS LAST
      LIMIT GREATEST(0, LEAST(p_limit, 1000))
    ) t;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    -- ambassadors table not present (or schema drift). Surface empty
    -- array so the admin panel renders.
    v_result := '[]'::jsonb;
  END;

  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.get_ambassadors_admin(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ambassadors_admin(INT) TO authenticated;


-- ─── 2. get_fee_requests_admin ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_fee_requests_admin(p_limit INT DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        r.id,
        r.user_id,
        r.amount_requested,
        r.amount_approved,
        r.payment_method::TEXT AS payment_method,
        r.transaction_reference,
        r.proof_image_url,
        r.status::TEXT AS status,
        r.admin_notes,
        r.rejection_reason,
        r.submitted_at,
        COALESCE(p.full_name, p.username, '—') AS user_name,
        p.username AS user_handle,
        COALESCE(p.level::TEXT, 'basic') AS user_level,
        COALESCE(b.balance, 0) AS current_balance
      FROM public.fee_unit_requests r
      LEFT JOIN public.profiles p ON p.id = r.user_id
      LEFT JOIN public.fee_unit_balances b ON b.user_id = r.user_id
      ORDER BY r.submitted_at DESC NULLS LAST
      LIMIT GREATEST(0, LEAST(p_limit, 1000))
    ) t;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_result := '[]'::jsonb;
  END;

  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.get_fee_requests_admin(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fee_requests_admin(INT) TO authenticated;


-- ─── Done ─────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Phase 10.38 applied: get_ambassadors_admin + get_fee_requests_admin RPCs.';
END $$;
