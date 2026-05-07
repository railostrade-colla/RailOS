-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.99 — Fix admin_set_user_level (defensive + detailed errors)
-- Date: 2026-05-08
-- Idempotent: safe to re-run.
--
-- The Phase 10.98 RPC failed silently with a generic "فشل تحديث المستوى"
-- toast because:
--   1. The `level` column on profiles may not exist if 10-levels-system.sql
--      wasn't applied (the UPDATE then raises 42703 "column does not exist"
--      and callRpc maps it to reason='unknown' — not in the UI map).
--   2. The function had no top-level EXCEPTION block so any error was
--      surfaced as a raw SQLSTATE instead of a friendly RPC error string.
--
-- This migration:
--   • Ensures the level columns exist on profiles (idempotent).
--   • Re-creates admin_set_user_level with a wrapping EXCEPTION that
--     returns the actual SQLERRM in the result.
--   • Validates the four allowed levels: basic / advanced / pro / elite.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Ensure the level columns exist (idempotent) ──────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS level                  TEXT DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS level_upgraded_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS level_override         TEXT,
  ADD COLUMN IF NOT EXISTS level_override_reason  TEXT,
  ADD COLUMN IF NOT EXISTS level_overridden_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS level_overridden_by    UUID,
  ADD COLUMN IF NOT EXISTS level_locked           BOOLEAN DEFAULT FALSE;


-- ─── 2. Re-create admin_set_user_level (defensive) ────────────────
DROP FUNCTION IF EXISTS public.admin_set_user_level(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.admin_set_user_level(
  p_user_id UUID,
  p_level   TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_role      TEXT;
  v_old_level TEXT;
BEGIN
  -- ─── Auth ──────────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role <> 'super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'super_admin_only');
  END IF;

  -- ─── Validate level ────────────────────────────────────────────
  IF p_level NOT IN ('basic', 'advanced', 'pro', 'elite') THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'invalid_level',
      'detail', 'Allowed values: basic, advanced, pro, elite'
    );
  END IF;

  -- ─── Validate target ───────────────────────────────────────────
  SELECT level INTO v_old_level FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'user_not_found');
  END IF;

  -- ─── Update level + override metadata ──────────────────────────
  -- Wrapped so any DB-level surprise (missing column, RLS, etc) gets
  -- returned as a helpful detail string instead of a SQL crash.
  BEGIN
    UPDATE public.profiles
       SET level                 = p_level,
           level_override        = p_level,
           level_override_reason = 'admin_manual_set',
           level_overridden_at   = NOW(),
           level_overridden_by   = v_uid,
           level_locked          = TRUE,
           level_upgraded_at     = COALESCE(level_upgraded_at, NOW())
     WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'update_failed',
      'detail', SQLERRM
    );
  END;

  -- Best-effort level_history row
  BEGIN
    INSERT INTO public.level_history (user_id, from_level, to_level, reason, changed_by)
    VALUES (p_user_id, v_old_level, p_level, 'admin_manual_set', v_uid);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Best-effort audit
  BEGIN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_uid, 'set_user_level', 'profile', p_user_id,
      jsonb_build_object('from', v_old_level, 'to', p_level)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', p_user_id,
    'from',    v_old_level,
    'level',   p_level
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_set_user_level(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_level(UUID, TEXT) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.99 applied:';
  RAISE NOTICE '  ✓ profiles.level + override columns ensured';
  RAISE NOTICE '  ✓ admin_set_user_level: defensive UPDATE with detail field';
  RAISE NOTICE '  ✓ all 4 levels accepted: basic / advanced / pro / elite';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
