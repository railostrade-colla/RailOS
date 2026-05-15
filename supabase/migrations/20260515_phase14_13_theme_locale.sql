-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.13 M2 — Theme + Locale user preferences
-- Date: 2026-05-15
-- Idempotent. Single transaction.
--
-- What this migration does:
--   1. CREATE TABLE IF NOT EXISTS public.user_preferences
--        - one row per user (PK = user_id → profiles.id)
--        - theme  : 'dark' | 'light' | 'system'   (default 'system')
--        - locale : 'ar'   | 'en'                  (default 'ar')
--        - updated_at timestamptz (auto-touched by trigger)
--   2. ADD COLUMN IF NOT EXISTS guards (forward-safe re-runs)
--   3. CHECK constraints on theme/locale (added only if missing)
--   4. ENABLE ROW LEVEL SECURITY + own-row read / insert / update
--   5. updated_at touch trigger
--   6. NOTIFY pgrst — reload PostgREST schema cache
--
-- NOT touched:
--   ✋ profiles            — only referenced as FK target
--   ✋ any existing RLS    — new table only
--
-- App behaviour: localStorage remains the source of truth for instant,
-- no-FOUC theming. This table is the cross-device sync layer only —
-- read on login, written optimistically on change.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- 1. Table
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme      TEXT NOT NULL DEFAULT 'system',
  locale     TEXT NOT NULL DEFAULT 'ar',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Forward-safe column guards (no-ops if table already had them)
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS theme      TEXT NOT NULL DEFAULT 'system';
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS locale     TEXT NOT NULL DEFAULT 'ar';
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─────────────────────────────────────────────────────────────────
-- 2. CHECK constraints (added only if not already present)
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_preferences_theme_chk'
  ) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_theme_chk
      CHECK (theme IN ('dark', 'light', 'system'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_preferences_locale_chk'
  ) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_locale_chk
      CHECK (locale IN ('ar', 'en'));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 3. Row Level Security — own row only
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_preferences_select_own ON public.user_preferences;
CREATE POLICY user_preferences_select_own
  ON public.user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_preferences_insert_own ON public.user_preferences;
CREATE POLICY user_preferences_insert_own
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_preferences_update_own ON public.user_preferences;
CREATE POLICY user_preferences_update_own
  ON public.user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────
-- 4. updated_at touch trigger
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_user_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_user_preferences ON public.user_preferences;
CREATE TRIGGER trg_touch_user_preferences
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_user_preferences_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- 5. Reload PostgREST schema cache
-- ─────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- Verification (run manually after COMMIT — these are SELECT-only)
-- ═══════════════════════════════════════════════════════════════════
-- 1) Table + columns:
--    SELECT column_name, data_type, column_default
--    FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'user_preferences'
--    ORDER BY ordinal_position;
--
-- 2) RLS enabled + policies:
--    SELECT relrowsecurity FROM pg_class
--    WHERE oid = 'public.user_preferences'::regclass;
--    SELECT polname, cmd FROM pg_policies
--    WHERE tablename = 'user_preferences';
--
-- 3) Constraints:
--    SELECT conname, pg_get_constraintdef(oid)
--    FROM pg_constraint
--    WHERE conrelid = 'public.user_preferences'::regclass;
-- ═══════════════════════════════════════════════════════════════════
