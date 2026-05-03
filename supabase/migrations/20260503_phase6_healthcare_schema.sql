-- ═══════════════════════════════════════════════════════════════════
-- Phase 6.1 — Healthcare program schema
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Four tables:
--   1. healthcare_cases         — public crowd-funding cases
--   2. healthcare_applications  — user-submitted aid applications
--   3. insurance_subscriptions  — paid insurance plan subscriptions
--   4. healthcare_donations     — donation ledger (append-only)
--
-- Anonymous donations: the donor can opt to hide their name from
-- the public donor list. The RLS SELECT policy allows the donor
-- themselves to see their own anonymous donations + admin sees
-- everything; everyone else sees only non-anonymous rows.
-- ═══════════════════════════════════════════════════════════════════

-- ─── ENUMs ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE disease_type AS ENUM (
    'cancer', 'heart', 'kidney', 'neurological',
    'pediatric', 'transplant', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE healthcare_case_status AS ENUM (
    'urgent', 'active', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE healthcare_application_status AS ENUM (
    'pending', 'approved', 'rejected', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE insurance_plan AS ENUM ('basic', 'advanced', 'comprehensive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE insurance_status AS ENUM ('active', 'paused', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1. healthcare_cases ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.healthcare_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_display_name TEXT NOT NULL,
  patient_age INTEGER CHECK (patient_age >= 0 AND patient_age <= 120),
  city TEXT NOT NULL,
  disease_type disease_type NOT NULL,
  diagnosis TEXT NOT NULL,
  hospital TEXT NOT NULL,

  total_required BIGINT NOT NULL CHECK (total_required > 0),
  amount_collected BIGINT NOT NULL DEFAULT 0 CHECK (amount_collected >= 0),
  donors_count INTEGER NOT NULL DEFAULT 0 CHECK (donors_count >= 0),

  status healthcare_case_status NOT NULL DEFAULT 'urgent',
  is_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
  story TEXT,
  treatment_plan TEXT,

  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hc_cases_status ON public.healthcare_cases(status);
CREATE INDEX IF NOT EXISTS idx_hc_cases_disease ON public.healthcare_cases(disease_type);
CREATE INDEX IF NOT EXISTS idx_hc_cases_created_at ON public.healthcare_cases(created_at DESC);

COMMENT ON TABLE public.healthcare_cases IS 'الحالات الإنسانية للعلاج — جمع تبرعات';

-- ─── 2. healthcare_applications ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.healthcare_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status healthcare_application_status NOT NULL DEFAULT 'pending',

  disease_type disease_type NOT NULL,
  diagnosis TEXT NOT NULL,
  doctor_name TEXT NOT NULL,
  hospital TEXT NOT NULL,

  total_cost BIGINT NOT NULL CHECK (total_cost > 0),
  user_available BIGINT NOT NULL DEFAULT 0 CHECK (user_available >= 0),
  requested_amount BIGINT NOT NULL CHECK (requested_amount > 0),
  attachments TEXT[] NOT NULL DEFAULT '{}',

  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  admin_notes TEXT,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hc_apps_user ON public.healthcare_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_hc_apps_status ON public.healthcare_applications(status);

COMMENT ON TABLE public.healthcare_applications IS 'طلبات الدعم الصحي من المستخدمين';

-- ─── 3. insurance_subscriptions ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.insurance_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan insurance_plan NOT NULL,
  monthly_fee BIGINT NOT NULL CHECK (monthly_fee > 0),
  annual_limit BIGINT NOT NULL CHECK (annual_limit > 0),

  status insurance_status NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_billing TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_user ON public.insurance_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_status ON public.insurance_subscriptions(status);

COMMENT ON TABLE public.insurance_subscriptions IS 'اشتراكات التأمين الصحي';

-- ─── 4. healthcare_donations ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.healthcare_donations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  donor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.healthcare_cases(id) ON DELETE SET NULL,
  -- NULL case_id = general healthcare fund donation.

  amount BIGINT NOT NULL CHECK (amount > 0),
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hc_donations_donor ON public.healthcare_donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_hc_donations_case ON public.healthcare_donations(case_id);
CREATE INDEX IF NOT EXISTS idx_hc_donations_created_at ON public.healthcare_donations(created_at DESC);

COMMENT ON TABLE public.healthcare_donations IS 'سجلّ التبرعات الصحية (append-only)';

-- ─── Trigger: refresh case counters on donation ──────────────
CREATE OR REPLACE FUNCTION public.refresh_healthcare_case_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_case_id UUID;
  v_collected BIGINT;
  v_count INT;
  v_required BIGINT;
BEGIN
  v_case_id := COALESCE(NEW.case_id, OLD.case_id);
  IF v_case_id IS NULL THEN RETURN NEW; END IF;

  SELECT
    COALESCE(SUM(amount), 0),
    COUNT(DISTINCT donor_id)
    INTO v_collected, v_count
  FROM public.healthcare_donations
  WHERE case_id = v_case_id;

  SELECT total_required INTO v_required
  FROM public.healthcare_cases WHERE id = v_case_id;

  UPDATE public.healthcare_cases
  SET amount_collected = v_collected,
      donors_count = v_count,
      status = CASE
        WHEN v_required IS NOT NULL AND v_collected >= v_required
          THEN 'completed'::healthcare_case_status
        ELSE status
      END,
      completed_at = CASE
        WHEN v_required IS NOT NULL AND v_collected >= v_required AND completed_at IS NULL
          THEN NOW()
        ELSE completed_at
      END,
      updated_at = NOW()
  WHERE id = v_case_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS donation_after_insert ON public.healthcare_donations;
CREATE TRIGGER donation_after_insert
  AFTER INSERT OR DELETE ON public.healthcare_donations
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_healthcare_case_counters();

-- ─── updated_at triggers ─────────────────────────────────────
DROP TRIGGER IF EXISTS hc_cases_updated_at ON public.healthcare_cases;
CREATE TRIGGER hc_cases_updated_at
  BEFORE UPDATE ON public.healthcare_cases
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS hc_apps_updated_at ON public.healthcare_applications;
CREATE TRIGGER hc_apps_updated_at
  BEFORE UPDATE ON public.healthcare_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS insurance_updated_at ON public.insurance_subscriptions;
CREATE TRIGGER insurance_updated_at
  BEFORE UPDATE ON public.insurance_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.healthcare_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.healthcare_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.healthcare_donations ENABLE ROW LEVEL SECURITY;

-- healthcare_cases: SELECT public (no PII), admin manages
DROP POLICY IF EXISTS "Anyone can view healthcare cases" ON public.healthcare_cases;
CREATE POLICY "Anyone can view healthcare cases"
ON public.healthcare_cases FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins manage healthcare cases" ON public.healthcare_cases;
CREATE POLICY "Admins manage healthcare cases"
ON public.healthcare_cases FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- healthcare_applications: SELECT self+admin, INSERT self, UPDATE admin
DROP POLICY IF EXISTS "Users view own applications" ON public.healthcare_applications;
CREATE POLICY "Users view own applications"
ON public.healthcare_applications FOR SELECT
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users submit applications" ON public.healthcare_applications;
CREATE POLICY "Users submit applications"
ON public.healthcare_applications FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins review applications" ON public.healthcare_applications;
CREATE POLICY "Admins review applications"
ON public.healthcare_applications FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- insurance_subscriptions: SELECT/INSERT/UPDATE self
DROP POLICY IF EXISTS "Users view own insurance" ON public.insurance_subscriptions;
CREATE POLICY "Users view own insurance"
ON public.insurance_subscriptions FOR SELECT
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users subscribe to insurance" ON public.insurance_subscriptions;
CREATE POLICY "Users subscribe to insurance"
ON public.insurance_subscriptions FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own insurance" ON public.insurance_subscriptions;
CREATE POLICY "Users update own insurance"
ON public.insurance_subscriptions FOR UPDATE
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- healthcare_donations: anonymous donors hidden from public list
DROP POLICY IF EXISTS "View donations: own + non-anonymous + admin"
  ON public.healthcare_donations;
CREATE POLICY "View donations: own + non-anonymous + admin"
ON public.healthcare_donations FOR SELECT
USING (
  donor_id = auth.uid()
  OR is_anonymous = FALSE
  OR public.is_admin()
);

DROP POLICY IF EXISTS "Users can donate" ON public.healthcare_donations;
CREATE POLICY "Users can donate"
ON public.healthcare_donations FOR INSERT
WITH CHECK (donor_id = auth.uid());

-- DELETE not granted; donations are an audit trail.
