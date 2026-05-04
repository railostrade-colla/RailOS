-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.3 — follows (متابعة المشاريع والشركات)
-- Date: 2026-05-04
-- Idempotent: safe to re-run.
--
-- A user can "follow" projects or companies. The /following page
-- pulls them, project/company cards show a heart toggle.
-- Schema: (user_id, target_type, target_id) — composite unique to
-- prevent double-follows. RLS: user only sees their own follows.
-- ═══════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE follow_target_type AS ENUM ('project', 'company');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.follows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type follow_target_type NOT NULL,
  target_id   UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_user ON public.follows(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_target
  ON public.follows(target_type, target_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Drop + recreate so re-runs pick up policy edits
DROP POLICY IF EXISTS "follows_select_own" ON public.follows;
CREATE POLICY "follows_select_own" ON public.follows
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
CREATE POLICY "follows_insert_own" ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;
CREATE POLICY "follows_delete_own" ON public.follows
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─── RPCs ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.follow_target(
  p_target_type TEXT,
  p_target_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF p_target_type NOT IN ('project', 'company') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_target_type');
  END IF;

  INSERT INTO public.follows (user_id, target_type, target_id)
  VALUES (v_uid, p_target_type::follow_target_type, p_target_id)
  ON CONFLICT (user_id, target_type, target_id) DO NOTHING
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', TRUE, 'id', v_id);
END
$$;

CREATE OR REPLACE FUNCTION public.unfollow_target(
  p_target_type TEXT,
  p_target_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF p_target_type NOT IN ('project', 'company') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_target_type');
  END IF;

  DELETE FROM public.follows
  WHERE user_id = v_uid
    AND target_type = p_target_type::follow_target_type
    AND target_id = p_target_id;

  RETURN jsonb_build_object('success', TRUE);
END
$$;

GRANT EXECUTE ON FUNCTION public.follow_target(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unfollow_target(TEXT, UUID) TO authenticated;
