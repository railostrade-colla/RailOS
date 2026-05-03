-- ═══════════════════════════════════════════════════════════════════
-- user_profile_extras — onboarding survey answers (Phase L follow-up)
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Why a separate table (instead of adding columns to profiles)?
--   • profiles is on the hot path — every page reads it. A new column
--     means updating dozens of `select(...)` callsites if we ever
--     denormalise.
--   • These fields are only relevant to /profile-setup + /profile/edit
--     and the admin KYC review queue. A 1:1 side-table keeps the
--     core profile shape lean.
--   • RLS scoped tightly to user_id = auth.uid() — no risk of cross-
--     user reads.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_profile_extras (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Section 1 — personal (KYC also collects birth_date / city / phone)
  birth_date DATE,
  gender     TEXT CHECK (gender IS NULL OR gender IN ('male', 'female')),
  city       TEXT,

  -- Section 2 — professional
  profession    TEXT,
  income_tier   TEXT CHECK (
    income_tier IS NULL OR
    income_tier IN ('lt_1m', '1_5m', '5_15m', 'gt_15m')
  ),
  income_source TEXT,

  -- Section 3 — investment goals
  -- goals + preferred_sectors are stored as TEXT[] arrays since the set
  -- of options is small and stable (defined in the page itself).
  goals             TEXT[] NOT NULL DEFAULT '{}',
  experience        TEXT CHECK (
    experience IS NULL OR
    experience IN ('beginner', 'intermediate', 'expert')
  ),
  preferred_sectors TEXT[] NOT NULL DEFAULT '{}',

  -- Section 4 — confirmations (boolean snapshot at submit-time)
  agreed_terms_at      TIMESTAMPTZ,
  agreed_privacy_at    TIMESTAMPTZ,
  confirmed_accuracy_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_profile_extras IS
  'Optional onboarding survey answers — collected on /profile-setup, '
  'shown back on profile edit. 1:1 with profiles via user_id PK.';

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.user_profile_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own profile extras"
  ON public.user_profile_extras;
CREATE POLICY "Users manage own profile extras"
ON public.user_profile_extras
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ─── updated_at trigger ──────────────────────────────────────
-- Reuses the existing handle_updated_at() function defined in 01_users.sql.
-- If that function isn't there yet (fresh DB), create a local one as a
-- safety net — `OR REPLACE` is harmless.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profile_extras_updated_at
  ON public.user_profile_extras;
CREATE TRIGGER user_profile_extras_updated_at
  BEFORE UPDATE ON public.user_profile_extras
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ─── Index on user_id (already PK, but explicit for clarity) ────
-- (PRIMARY KEY already creates an implicit unique index on user_id —
--  no extra index needed.)
