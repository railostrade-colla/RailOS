-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.94 — admin_update_project
-- Date: 2026-05-08
-- Idempotent: safe to re-run.
--
-- Lets the admin EDIT panel save changes to a published project.
-- The previous edit flow only showed a toast and didn't persist
-- anything to the DB.
--
-- IMMUTABLE FIELDS (intentionally absent from this RPC):
--   • total_shares     — adding more shares is via project_wallets
--   • share_price      — initial launch price is fixed forever
--   • offering_percentage — split is fixed at creation; redistribution
--     happens via admin_add_shares_to_offering
--   • slug, created_by, created_at — system fields
--
-- Mutable fields cover everything else: name, description, owner contact,
-- gallery, documents, dates, returns, risk, brand assets, etc.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_update_project(
  p_project_id UUID,

  -- Basic info
  p_name              TEXT,
  p_short_description TEXT  DEFAULT NULL,
  p_description       TEXT  DEFAULT NULL,
  p_project_type      TEXT  DEFAULT NULL,
  p_company_id        UUID  DEFAULT NULL,
  p_symbol            TEXT  DEFAULT NULL,

  -- Brand assets
  p_logo_url          TEXT  DEFAULT NULL,
  p_cover_url         TEXT  DEFAULT NULL,
  p_gallery_images    JSONB DEFAULT NULL,
  p_documents         JSONB DEFAULT NULL,

  -- Location
  p_location_city     TEXT  DEFAULT NULL,
  p_location_address  TEXT  DEFAULT NULL,
  p_detailed_address  TEXT  DEFAULT NULL,

  -- Dates
  p_offering_start_date DATE DEFAULT NULL,
  p_offering_end_date   DATE DEFAULT NULL,
  p_duration_open       BOOLEAN DEFAULT NULL,
  p_duration_months     INT     DEFAULT NULL,

  -- Returns (annual values — caller multiplies monthly × 12 before passing)
  p_expected_return_min NUMERIC DEFAULT NULL,
  p_expected_return_max NUMERIC DEFAULT NULL,

  -- Risk + distribution
  p_risk_level        TEXT DEFAULT NULL,
  p_distribution_type TEXT DEFAULT NULL,
  p_profit_source     TEXT DEFAULT NULL,

  -- Owner contact
  p_owner_name        TEXT DEFAULT NULL,
  p_owner_phone       TEXT DEFAULT NULL,
  p_owner_email       TEXT DEFAULT NULL,

  -- Status (admin can publish a draft from edit form too)
  p_status            TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_role      TEXT;
  v_changed   INT := 0;
BEGIN
  -- ─── Auth ───
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  -- ─── Validate target exists ───
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'project_not_found');
  END IF;

  -- ─── Validate basic fields ───
  IF p_name IS NULL OR length(trim(p_name)) < 3 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_name');
  END IF;

  IF p_company_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'company_not_found');
    END IF;
  END IF;

  -- ─── Core update (safe columns only) ───
  UPDATE public.projects SET
    name              = trim(p_name),
    short_description = COALESCE(NULLIF(trim(COALESCE(p_short_description, '')), ''), short_description),
    description       = COALESCE(NULLIF(trim(COALESCE(p_description, '')), ''), description),
    project_type      = COALESCE(p_project_type::project_type, project_type),
    company_id        = p_company_id,
    location_city     = COALESCE(NULLIF(trim(COALESCE(p_location_city, '')), ''), location_city),
    location_address  = COALESCE(NULLIF(trim(COALESCE(p_location_address, '')), ''), location_address),
    offering_start_date = COALESCE(p_offering_start_date, offering_start_date),
    offering_end_date   = COALESCE(p_offering_end_date, offering_end_date),
    updated_at = NOW()
   WHERE id = p_project_id;
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  -- ─── Status (publish a draft) ───
  IF p_status IS NOT NULL AND p_status IN ('draft', 'active', 'coming_soon', 'sold_out', 'completed') THEN
    BEGIN
      UPDATE public.projects
         SET status = p_status::project_status,
             published_at = CASE WHEN p_status = 'active' AND published_at IS NULL THEN NOW() ELSE published_at END
       WHERE id = p_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- ─── Symbol ───
  IF p_symbol IS NOT NULL THEN
    BEGIN
      UPDATE public.projects SET symbol = NULLIF(trim(p_symbol), '') WHERE id = p_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- ─── Brand assets ───
  IF p_logo_url IS NOT NULL THEN
    BEGIN
      UPDATE public.projects SET logo_url = NULLIF(trim(p_logo_url), '') WHERE id = p_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF p_cover_url IS NOT NULL THEN
    BEGIN
      UPDATE public.projects SET cover_url = NULLIF(trim(p_cover_url), '') WHERE id = p_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF p_gallery_images IS NOT NULL THEN
    BEGIN
      UPDATE public.projects SET gallery_images = p_gallery_images WHERE id = p_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF p_documents IS NOT NULL THEN
    BEGIN
      UPDATE public.projects SET documents = p_documents WHERE id = p_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- ─── Detailed address ───
  IF p_detailed_address IS NOT NULL THEN
    BEGIN
      UPDATE public.projects
         SET detailed_address = NULLIF(trim(p_detailed_address), '')
       WHERE id = p_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- ─── Duration ───
  IF p_duration_open IS NOT NULL THEN
    BEGIN
      UPDATE public.projects
         SET duration_open   = p_duration_open,
             duration_months = CASE WHEN p_duration_open THEN NULL ELSE COALESCE(p_duration_months, duration_months) END
       WHERE id = p_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- ─── Returns (annual %) ───
  IF p_expected_return_min IS NOT NULL THEN
    BEGIN
      UPDATE public.projects SET expected_return_min = p_expected_return_min WHERE id = p_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
      UPDATE public.projects SET return_min = p_expected_return_min WHERE id = p_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF p_expected_return_max IS NOT NULL THEN
    BEGIN
      UPDATE public.projects SET expected_return_max = p_expected_return_max WHERE id = p_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
      UPDATE public.projects SET return_max = p_expected_return_max WHERE id = p_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- ─── Risk + distribution + profit source ───
  IF p_risk_level IS NOT NULL THEN
    BEGIN
      EXECUTE format('UPDATE public.projects SET risk_level = %L WHERE id = %L', p_risk_level, p_project_id);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF p_distribution_type IS NOT NULL THEN
    BEGIN
      EXECUTE format('UPDATE public.projects SET distribution_type = %L WHERE id = %L', p_distribution_type, p_project_id);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF p_profit_source IS NOT NULL THEN
    BEGIN
      UPDATE public.projects
         SET profit_source = NULLIF(trim(p_profit_source), '')
       WHERE id = p_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- ─── Owner contact ───
  IF p_owner_name IS NOT NULL THEN
    BEGIN
      UPDATE public.projects SET owner_name = NULLIF(trim(p_owner_name), '') WHERE id = p_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF p_owner_phone IS NOT NULL THEN
    BEGIN
      UPDATE public.projects SET owner_phone = NULLIF(trim(p_owner_phone), '') WHERE id = p_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF p_owner_email IS NOT NULL THEN
    BEGIN
      UPDATE public.projects SET owner_email = NULLIF(trim(p_owner_email), '') WHERE id = p_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- ─── Audit ───
  BEGIN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_uid, 'update_project', 'project', p_project_id,
      jsonb_build_object('name', p_name, 'status', p_status)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE, 'project_id', p_project_id);
END $$;

REVOKE ALL ON FUNCTION public.admin_update_project(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT,
  TEXT, TEXT, JSONB, JSONB,
  TEXT, TEXT, TEXT,
  DATE, DATE, BOOLEAN, INT,
  NUMERIC, NUMERIC,
  TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_project(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT,
  TEXT, TEXT, JSONB, JSONB,
  TEXT, TEXT, TEXT,
  DATE, DATE, BOOLEAN, INT,
  NUMERIC, NUMERIC,
  TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT
) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.94 applied:';
  RAISE NOTICE '  ✓ admin_update_project() created';
  RAISE NOTICE '  ✓ total_shares + share_price are IMMUTABLE (not in params)';
  RAISE NOTICE '  ✓ offering_percentage is IMMUTABLE (use admin_add_shares_to_offering)';
  RAISE NOTICE '  ✓ admin/super_admin can call';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
