-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.50 — Security hardening
-- Date: 2026-05-10
-- Idempotent.
--
-- Founder spec (post-audit): close the critical leak of
-- profiles.payment_methods + phone + total_invested + ban_reason
-- + admin_permissions + fee_units_balance to every authenticated
-- user, and lock down bootstrap_first_super_admin so a clean DB
-- can't be hijacked by any anonymous user.
--
-- Changes:
--   1. Drop the wide "Anyone can view profiles USING (true)" SELECT
--      policy. Replace with a strict policy: only the row owner or
--      an admin can SELECT a full row.
--   2. Create a `profiles_public` VIEW exposing the safe-to-share
--      columns (name, username, avatar, level, role, ratings, badges)
--      with `security_invoker = false` so it bypasses the strict
--      RLS — access is then controlled solely by GRANTs.
--   3. Refactor 3 user-facing cross-user reads to use the view.
--   4. Revoke EXECUTE on `bootstrap_first_super_admin()` from
--      authenticated/anon — only the service_role (Railway shell /
--      Supabase SQL editor) can call it now. Recovery path goes
--      through trusted backend instead of any logged-in user.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Strict SELECT policy on profiles ─────────────────────────
-- We drop ALL existing SELECT policies first so the new strict
-- policy is the only one (Postgres OR-combines policies, so a
-- residual "USING(true)" anywhere defeats the lock-down).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "self_or_admin_reads_profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin());


-- ─── 2. profiles_public VIEW — safe columns for cross-user reads ─
-- security_invoker=false → view runs as its owner (postgres) and
-- bypasses RLS. GRANT below controls who can SELECT.
--
-- Schema-tolerant: the optional columns (level, total_trades,
-- successful_trades) come from migration `10-levels-system.sql` which
-- isn't always applied. We build the view dynamically from
-- information_schema and substitute NULL::TYPE for any missing
-- column so the view always exposes the same shape to clients.

DROP VIEW IF EXISTS public.profiles_public CASCADE;

DO $$
DECLARE
  v_has_level             BOOLEAN;
  v_has_total_trades      BOOLEAN;
  v_has_successful_trades BOOLEAN;
  v_has_trades_completed  BOOLEAN;
  v_has_is_ambassador     BOOLEAN;
  v_has_last_seen_at      BOOLEAN;
  v_select_list           TEXT;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='level')
    INTO v_has_level;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='total_trades')
    INTO v_has_total_trades;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='successful_trades')
    INTO v_has_successful_trades;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='trades_completed')
    INTO v_has_trades_completed;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='is_ambassador')
    INTO v_has_is_ambassador;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='last_seen_at')
    INTO v_has_last_seen_at;

  v_select_list :=
    'id, full_name, username, avatar_url, role, '
    || 'rating_average, rating_count, kyc_status, is_banned, '
    || 'is_active, created_at';

  IF v_has_level             THEN v_select_list := v_select_list || ', level';
                             ELSE v_select_list := v_select_list || ', NULL::TEXT AS level';
  END IF;
  IF v_has_total_trades      THEN v_select_list := v_select_list || ', total_trades';
                             ELSE v_select_list := v_select_list || ', NULL::INT AS total_trades';
  END IF;
  IF v_has_successful_trades THEN v_select_list := v_select_list || ', successful_trades';
                             ELSE v_select_list := v_select_list || ', NULL::INT AS successful_trades';
  END IF;
  IF v_has_trades_completed  THEN v_select_list := v_select_list || ', trades_completed';
                             ELSE v_select_list := v_select_list || ', NULL::INT AS trades_completed';
  END IF;
  IF v_has_is_ambassador     THEN v_select_list := v_select_list || ', is_ambassador';
                             ELSE v_select_list := v_select_list || ', FALSE AS is_ambassador';
  END IF;
  IF v_has_last_seen_at      THEN v_select_list := v_select_list || ', last_seen_at';
                             ELSE v_select_list := v_select_list || ', NULL::TIMESTAMPTZ AS last_seen_at';
  END IF;

  EXECUTE format(
    'CREATE VIEW public.profiles_public WITH (security_invoker = false) AS SELECT %s FROM public.profiles',
    v_select_list
  );
END $$;

REVOKE ALL ON public.profiles_public FROM PUBLIC;
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO anon;


-- ─── 3. Lock bootstrap_first_super_admin ────────────────────────
-- This function originally let any authenticated user become
-- super_admin if no super_admin existed. After initial setup it
-- becomes a back door — revoke it. Recovery goes through Railway
-- shell with service_role.
-- Wrapped in a DO block so the migration is safe to run on DBs
-- where the function was never deployed.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'bootstrap_first_super_admin'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.bootstrap_first_super_admin() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.bootstrap_first_super_admin() FROM authenticated;
    REVOKE EXECUTE ON FUNCTION public.bootstrap_first_super_admin() FROM anon;
    RAISE NOTICE 'Revoked bootstrap_first_super_admin from authenticated/anon/PUBLIC';
  ELSE
    RAISE NOTICE 'bootstrap_first_super_admin not deployed on this DB — nothing to revoke';
  END IF;
END $$;
-- service_role retains EXECUTE implicitly — no change needed.


-- ─── 4. Helper RPC for service-side self-reads ──────────────────
-- API routes that previously did `from("profiles").select("phone")`
-- on the authed user can keep working under strict RLS. This is
-- already permitted by the new policy (id = auth.uid()) — but
-- expose a clean RPC anyway so callers don't depend on direct
-- column access.

CREATE OR REPLACE FUNCTION public.get_my_profile_private()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_record JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  -- to_jsonb on the row makes this resilient to schema drift —
  -- returns whichever columns the table happens to have on this DB.
  SELECT to_jsonb(p) INTO v_record FROM public.profiles p WHERE p.id = v_uid;
  IF v_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;
  RETURN jsonb_build_object('success', true) || v_record;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_profile_private() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile_private() TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.50 security hardening applied.';
  RAISE NOTICE '  ✓ Strict RLS on profiles (self + admin only)';
  RAISE NOTICE '  ✓ profiles_public view for cross-user reads';
  RAISE NOTICE '  ✓ bootstrap_first_super_admin revoked from auth/anon';
  RAISE NOTICE '  ✓ get_my_profile_private RPC available';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'CLIENT REFACTOR REQUIRED:';
  RAISE NOTICE '  • lib/data/gifts.ts        → profiles_public';
  RAISE NOTICE '  • lib/data/users-search.ts → profiles_public';
  RAISE NOTICE '  • lib/data/community.ts    → profiles_public';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
