-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.43 — fix admin_create_project: handle generated total_value
-- Date: 2026-05-05
-- Idempotent: safe to re-run.
--
-- Error reported by user when publishing a project from /admin:
--   "cannot insert a non-DEFAULT value into column 'total_value'"
--
-- Cause: the original Phase 10.20 RPC INSERTs into projects.total_value,
-- but in production that column is defined as GENERATED ALWAYS AS
-- (share_price * total_shares) STORED. Postgres rejects manual values
-- for generated columns.
--
-- Fix: try the INSERT WITHOUT total_value first (works for the
-- generated-column schema), and fall back to the legacy INSERT WITH
-- total_value if the first one fails (works for older schemas where
-- total_value is a plain numeric). Either path leaves total_value
-- with the correct value.
--
-- The RPC also no longer touches `current_market_price` defensively —
-- we set it via a follow-up UPDATE so a similar generated-column
-- definition there can't break creation either.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_create_project(
  p_name TEXT,
  p_short_description TEXT,
  p_description TEXT,
  p_project_type TEXT,
  p_share_price NUMERIC,
  p_total_shares BIGINT,
  p_offering_percentage NUMERIC DEFAULT 90,
  p_ambassador_percentage NUMERIC DEFAULT 2,
  p_reserve_percentage NUMERIC DEFAULT 8,
  p_location_city TEXT DEFAULT NULL,
  p_offering_start_date DATE DEFAULT NULL,
  p_offering_end_date DATE DEFAULT NULL,
  p_company_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT 'draft'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_caller_role TEXT;
  v_project_id UUID;
  v_slug TEXT;
  v_total_value NUMERIC;
  v_offering_shares BIGINT;
  v_ambassador_shares BIGINT;
  v_reserve_shares BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_uid;
  IF v_caller_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  -- Validation
  IF p_name IS NULL OR length(trim(p_name)) < 3 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_name');
  END IF;
  IF p_share_price IS NULL OR p_share_price <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_share_price');
  END IF;
  IF p_total_shares IS NULL OR p_total_shares <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_total_shares');
  END IF;
  IF p_status NOT IN ('draft', 'active') THEN
    p_status := 'draft';
  END IF;

  -- Verify the company exists if provided (NULL = standalone project)
  IF p_company_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'company_not_found');
    END IF;
  END IF;

  -- Generate slug from name (best-effort, ASCII-safe). For Arabic
  -- names the regexp strips everything → fall back to a random slug.
  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(BOTH '-' FROM v_slug);
  IF length(v_slug) < 3 THEN
    v_slug := 'project-' || substr(gen_random_uuid()::text, 1, 8);
  END IF;

  -- Make slug unique
  WHILE EXISTS (SELECT 1 FROM public.projects WHERE slug = v_slug) LOOP
    v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  END LOOP;

  v_total_value := p_share_price * p_total_shares;
  v_offering_shares := FLOOR(p_total_shares * p_offering_percentage / 100);
  v_ambassador_shares := FLOOR(p_total_shares * p_ambassador_percentage / 100);
  v_reserve_shares := p_total_shares - v_offering_shares - v_ambassador_shares;

  -- ─── INSERT — generated-column-aware ───
  -- Try the modern schema first: total_value + current_market_price
  -- are GENERATED ALWAYS AS (...) STORED, so we OMIT them from the
  -- INSERT. If that fails because they are plain columns (legacy
  -- schema), we retry WITH them in the EXCEPTION block.
  BEGIN
    INSERT INTO public.projects (
      name, slug, description, short_description, project_type,
      share_price, total_shares,
      offering_percentage, ambassador_percentage, reserve_percentage,
      location_city, offering_start_date, offering_end_date,
      company_id, status, created_by
    ) VALUES (
      trim(p_name), v_slug, COALESCE(p_description, ''), p_short_description,
      p_project_type::project_type,
      p_share_price, p_total_shares,
      p_offering_percentage, p_ambassador_percentage, p_reserve_percentage,
      p_location_city, p_offering_start_date, p_offering_end_date,
      p_company_id, p_status::project_status, v_uid
    )
    RETURNING id INTO v_project_id;
  EXCEPTION
    WHEN not_null_violation THEN
      -- Legacy schema: total_value (and possibly current_market_price)
      -- are plain NOT NULL columns without DEFAULT. Retry with values.
      INSERT INTO public.projects (
        name, slug, description, short_description, project_type,
        share_price, total_shares, total_value, current_market_price,
        offering_percentage, ambassador_percentage, reserve_percentage,
        location_city, offering_start_date, offering_end_date,
        company_id, status, created_by
      ) VALUES (
        trim(p_name), v_slug, COALESCE(p_description, ''), p_short_description,
        p_project_type::project_type,
        p_share_price, p_total_shares, v_total_value, p_share_price,
        p_offering_percentage, p_ambassador_percentage, p_reserve_percentage,
        p_location_city, p_offering_start_date, p_offering_end_date,
        p_company_id, p_status::project_status, v_uid
      )
      RETURNING id INTO v_project_id;
  END;

  -- Best-effort: set current_market_price to share_price if it isn't
  -- already (helps both legacy schemas where the column was NULL and
  -- modern schemas where it's a regular column we skipped above).
  -- Skipped silently if the column is generated.
  BEGIN
    UPDATE public.projects
       SET current_market_price = p_share_price
     WHERE id = v_project_id
       AND (current_market_price IS NULL OR current_market_price = 0);
  EXCEPTION WHEN OTHERS THEN
    -- Generated column or missing column — fine.
    NULL;
  END;

  -- Auto-create the 3 project wallets (best-effort)
  BEGIN
    INSERT INTO public.project_wallets (project_id, wallet_type, total_shares, available_shares)
    VALUES
      (v_project_id, 'offering',   v_offering_shares,   v_offering_shares),
      (v_project_id, 'ambassador', v_ambassador_shares, v_ambassador_shares),
      (v_project_id, 'reserve',    v_reserve_shares,    v_reserve_shares);
  EXCEPTION WHEN OTHERS THEN
    -- Schema mismatch — skip wallet creation but keep project
    NULL;
  END;

  -- Audit (best-effort)
  BEGIN
    INSERT INTO public.audit_log (
      user_id, action, entity_type, entity_id, metadata
    ) VALUES (
      v_uid, 'create_project', 'project', v_project_id,
      jsonb_build_object(
        'name', p_name,
        'company_id', p_company_id,
        'total_shares', p_total_shares,
        'share_price', p_share_price,
        'status', p_status
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'project_id', v_project_id,
    'slug', v_slug,
    'offering_shares', v_offering_shares,
    'ambassador_shares', v_ambassador_shares,
    'reserve_shares', v_reserve_shares
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_project(
  TEXT, TEXT, TEXT, TEXT, NUMERIC, BIGINT, NUMERIC, NUMERIC, NUMERIC,
  TEXT, DATE, DATE, UUID, TEXT
) TO authenticated;


-- ─── Done ─────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Phase 10.43 applied: admin_create_project now handles generated total_value column.';
END $$;
