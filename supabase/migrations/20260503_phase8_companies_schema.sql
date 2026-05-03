-- ═══════════════════════════════════════════════════════════════════
-- Phase 8.3 — Companies schema
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- The codebase has a `lib/data/companies.ts` data layer that has been
-- querying a `companies` table since day one — but the table itself
-- never existed in any migration. The fetch helpers fail soft
-- (return [] / null), so nothing crashed, but no real companies
-- could be persisted either.
--
-- This migration ships the missing table + admin RPCs to create and
-- edit companies. RLS allows public reads (for the user-facing
-- /company/[id] page) and admin-only writes via the RPCs.
--
-- The shape mirrors the DBCompany type already declared in
-- lib/data/companies.ts so that existing code starts working as
-- soon as the migration lands.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. companies table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  sector TEXT NOT NULL,
  city TEXT,
  description TEXT,
  logo_url TEXT,
  share_price BIGINT NOT NULL DEFAULT 0 CHECK (share_price >= 0),
  projects_count INTEGER NOT NULL DEFAULT 0 CHECK (projects_count >= 0),
  shareholders_count INTEGER NOT NULL DEFAULT 0 CHECK (shareholders_count >= 0),
  risk_level TEXT NOT NULL DEFAULT 'medium'
    CHECK (risk_level IN ('low', 'medium', 'high')),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_trending BOOLEAN NOT NULL DEFAULT FALSE,
  is_new BOOLEAN NOT NULL DEFAULT TRUE,
  rating NUMERIC(3,2) DEFAULT 0 CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  joined_days_ago INTEGER NOT NULL DEFAULT 0 CHECK (joined_days_ago >= 0),
  founded_year INTEGER CHECK (founded_year IS NULL OR (founded_year >= 1800 AND founded_year <= 2100)),
  -- Optional creator (admin who set up the company row)
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_sector ON public.companies(sector);
CREATE INDEX IF NOT EXISTS idx_companies_verified ON public.companies(is_verified)
  WHERE is_verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_companies_created_at
  ON public.companies(created_at DESC);

COMMENT ON TABLE public.companies IS
  'الشركات الأمّ — لكل شركة عدد من المشاريع التابعة';

-- ─── 2. updated_at trigger ──────────────────────────────────
DROP TRIGGER IF EXISTS companies_updated_at ON public.companies;
CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── 3. RLS ─────────────────────────────────────────────────
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read companies" ON public.companies;
CREATE POLICY "Public read companies"
ON public.companies FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins write companies" ON public.companies;
CREATE POLICY "Admins write companies"
ON public.companies FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- RPCs
-- ═══════════════════════════════════════════════════════════════════

-- ─── 4. admin_create_company ────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_create_company(
  p_name TEXT,
  p_sector TEXT,
  p_city TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_share_price BIGINT DEFAULT 0,
  p_risk_level TEXT DEFAULT 'medium',
  p_founded_year INTEGER DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_company_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_name');
  END IF;
  IF p_sector IS NULL OR length(trim(p_sector)) = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_sector');
  END IF;
  IF p_risk_level NOT IN ('low', 'medium', 'high') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_risk');
  END IF;
  IF p_share_price < 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_share_price');
  END IF;

  INSERT INTO public.companies (
    name, sector, city, description, logo_url, share_price,
    risk_level, founded_year, created_by
  ) VALUES (
    trim(p_name), trim(p_sector), p_city, p_description, p_logo_url,
    p_share_price, p_risk_level, p_founded_year, v_uid
  )
  RETURNING id INTO v_company_id;

  RETURN jsonb_build_object('success', TRUE, 'company_id', v_company_id);
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_company(
  TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT, INTEGER
) TO authenticated;

-- ─── 5. admin_update_company ────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_company(
  p_company_id UUID,
  p_name TEXT DEFAULT NULL,
  p_sector TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_share_price BIGINT DEFAULT NULL,
  p_risk_level TEXT DEFAULT NULL,
  p_is_verified BOOLEAN DEFAULT NULL,
  p_is_trending BOOLEAN DEFAULT NULL,
  p_founded_year INTEGER DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF p_risk_level IS NOT NULL AND p_risk_level NOT IN ('low', 'medium', 'high') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_risk');
  END IF;
  IF p_share_price IS NOT NULL AND p_share_price < 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_share_price');
  END IF;

  UPDATE public.companies
  SET name          = COALESCE(NULLIF(trim(p_name), ''), name),
      sector        = COALESCE(NULLIF(trim(p_sector), ''), sector),
      city          = COALESCE(p_city, city),
      description   = COALESCE(p_description, description),
      logo_url      = COALESCE(p_logo_url, logo_url),
      share_price   = COALESCE(p_share_price, share_price),
      risk_level    = COALESCE(p_risk_level, risk_level),
      is_verified   = COALESCE(p_is_verified, is_verified),
      is_trending   = COALESCE(p_is_trending, is_trending),
      founded_year  = COALESCE(p_founded_year, founded_year),
      updated_at    = NOW()
  WHERE id = p_company_id;

  RETURN jsonb_build_object('success', TRUE);
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_company(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT, BOOLEAN, BOOLEAN, INTEGER
) TO authenticated;

-- ─── 6. admin_delete_company ────────────────────────────────
-- Soft-removes by checking dependent project rows first.
CREATE OR REPLACE FUNCTION public.admin_delete_company(p_company_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_count INT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  -- Don't orphan projects: refuse delete if any project references it.
  -- (projects.company_id may not exist on every deployment — guard.)
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public.projects WHERE company_id = $1'
      INTO v_project_count
      USING p_company_id;
    IF v_project_count > 0 THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'has_projects',
        'project_count', v_project_count
      );
    END IF;
  EXCEPTION WHEN undefined_column THEN
    NULL; -- projects.company_id missing on this DB — proceed
  END;

  DELETE FROM public.companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('success', TRUE);
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_company(UUID) TO authenticated;
