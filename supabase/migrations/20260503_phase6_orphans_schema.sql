-- ═══════════════════════════════════════════════════════════════════
-- Phase 6.1 — Orphans care program schema
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Three tables:
--   1. orphan_children    — public profiles (no PII; first_name + age + city)
--   2. sponsorships       — user → child sponsorship records
--   3. orphan_reports     — periodic progress reports for sponsors
--
-- Triggers maintain denormalised counters on orphan_children
-- (sponsored_amount, sponsors_count, status) so the children
-- listing doesn't need to aggregate sponsorships on every query.
-- ═══════════════════════════════════════════════════════════════════

-- ─── ENUMs ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE child_gender AS ENUM ('male', 'female');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE child_sponsorship_status AS ENUM (
    'needs_sponsor', 'partial', 'fully_sponsored'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sponsorship_type AS ENUM ('monthly', 'annual', 'onetime');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sponsorship_status AS ENUM ('active', 'ended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE education_level AS ENUM (
    'kindergarten', 'primary', 'intermediate', 'secondary', 'university'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1. orphan_children ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orphan_children (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL CHECK (length(trim(first_name)) > 0),
  age INTEGER NOT NULL CHECK (age >= 0 AND age <= 25),
  gender child_gender NOT NULL,
  city TEXT NOT NULL,
  story TEXT,
  needs_amount_monthly BIGINT NOT NULL CHECK (needs_amount_monthly > 0),

  -- Denormalised counters (maintained by trigger).
  sponsored_amount BIGINT NOT NULL DEFAULT 0 CHECK (sponsored_amount >= 0),
  sponsors_count INTEGER NOT NULL DEFAULT 0 CHECK (sponsors_count >= 0),
  status child_sponsorship_status NOT NULL DEFAULT 'needs_sponsor',

  blur_photo BOOLEAN NOT NULL DEFAULT TRUE,
  photo_url TEXT,
  education_level education_level NOT NULL,
  health_status TEXT NOT NULL DEFAULT 'good'
    CHECK (health_status IN ('good', 'monitoring', 'needs_care')),

  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orphan_children_status ON public.orphan_children(status);
CREATE INDEX IF NOT EXISTS idx_orphan_children_city ON public.orphan_children(city);

COMMENT ON TABLE public.orphan_children IS
  'الأطفال الأيتام في برنامج الرعاية. لا تحتوي PII (الاسم الأول فقط).';

-- ─── 2. sponsorships ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sponsorships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sponsor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.orphan_children(id) ON DELETE CASCADE,

  type sponsorship_type NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  duration_months INTEGER NOT NULL CHECK (duration_months > 0),
  status sponsorship_status NOT NULL DEFAULT 'active',

  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  receive_reports BOOLEAN NOT NULL DEFAULT TRUE,

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsorships_sponsor ON public.sponsorships(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsorships_child ON public.sponsorships(child_id);
CREATE INDEX IF NOT EXISTS idx_sponsorships_status ON public.sponsorships(status);

COMMENT ON TABLE public.sponsorships IS 'كفالات الأطفال من المستخدمين';

-- ─── 3. orphan_reports ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orphan_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES public.orphan_children(id) ON DELETE CASCADE,
  -- Sponsor receiving the report — enforced via sponsorship existence.
  sponsor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  period TEXT NOT NULL,
  education_progress TEXT,
  health_status TEXT,
  highlights TEXT,
  photos_count INTEGER NOT NULL DEFAULT 0,

  created_by UUID NOT NULL REFERENCES public.profiles(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orphan_reports_child ON public.orphan_reports(child_id);
CREATE INDEX IF NOT EXISTS idx_orphan_reports_sponsor ON public.orphan_reports(sponsor_id);

COMMENT ON TABLE public.orphan_reports IS 'تقارير دورية تُرسَل للكفلاء';

-- ─── Trigger: maintain orphan_children counters ──────────────
CREATE OR REPLACE FUNCTION public.refresh_orphan_child_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_child_id UUID;
  v_sponsored BIGINT;
  v_count INT;
  v_needs BIGINT;
  v_status child_sponsorship_status;
BEGIN
  -- Resolve which child to refresh (works for INSERT/UPDATE/DELETE).
  v_child_id := COALESCE(NEW.child_id, OLD.child_id);

  SELECT
    COALESCE(SUM(amount), 0),
    COUNT(*)
    INTO v_sponsored, v_count
  FROM public.sponsorships
  WHERE child_id = v_child_id AND status = 'active';

  SELECT needs_amount_monthly INTO v_needs
  FROM public.orphan_children WHERE id = v_child_id;

  IF v_needs IS NULL THEN RETURN NEW; END IF;

  v_status := CASE
    WHEN v_sponsored = 0 THEN 'needs_sponsor'::child_sponsorship_status
    WHEN v_sponsored >= v_needs THEN 'fully_sponsored'::child_sponsorship_status
    ELSE 'partial'::child_sponsorship_status
  END;

  UPDATE public.orphan_children
  SET sponsored_amount = v_sponsored,
      sponsors_count = v_count,
      status = v_status,
      updated_at = NOW()
  WHERE id = v_child_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sponsorship_after_change ON public.sponsorships;
CREATE TRIGGER sponsorship_after_change
  AFTER INSERT OR UPDATE OR DELETE ON public.sponsorships
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_orphan_child_counters();

-- ─── updated_at triggers ─────────────────────────────────────
DROP TRIGGER IF EXISTS orphan_children_updated_at ON public.orphan_children;
CREATE TRIGGER orphan_children_updated_at
  BEFORE UPDATE ON public.orphan_children
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS sponsorships_updated_at ON public.sponsorships;
CREATE TRIGGER sponsorships_updated_at
  BEFORE UPDATE ON public.sponsorships
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.orphan_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orphan_reports ENABLE ROW LEVEL SECURITY;

-- orphan_children: SELECT public, write admin
DROP POLICY IF EXISTS "Anyone can view orphan children" ON public.orphan_children;
CREATE POLICY "Anyone can view orphan children"
ON public.orphan_children FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins manage orphan children" ON public.orphan_children;
CREATE POLICY "Admins manage orphan children"
ON public.orphan_children FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- sponsorships: SELECT (sponsor + admin), INSERT (self), UPDATE (cancel by self), DELETE admin
DROP POLICY IF EXISTS "Sponsors can view own sponsorships" ON public.sponsorships;
CREATE POLICY "Sponsors can view own sponsorships"
ON public.sponsorships FOR SELECT
USING (sponsor_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can sponsor children" ON public.sponsorships;
CREATE POLICY "Users can sponsor children"
ON public.sponsorships FOR INSERT
WITH CHECK (sponsor_id = auth.uid());

DROP POLICY IF EXISTS "Sponsors can cancel own sponsorships" ON public.sponsorships;
CREATE POLICY "Sponsors can cancel own sponsorships"
ON public.sponsorships FOR UPDATE
USING (sponsor_id = auth.uid() OR public.is_admin())
WITH CHECK (sponsor_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins can delete sponsorships" ON public.sponsorships;
CREATE POLICY "Admins can delete sponsorships"
ON public.sponsorships FOR DELETE
USING (public.is_admin());

-- orphan_reports: SELECT (sponsor only — privacy), admin manages
DROP POLICY IF EXISTS "Sponsors can view own reports" ON public.orphan_reports;
CREATE POLICY "Sponsors can view own reports"
ON public.orphan_reports FOR SELECT
USING (sponsor_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage reports" ON public.orphan_reports;
CREATE POLICY "Admins manage reports"
ON public.orphan_reports FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());
