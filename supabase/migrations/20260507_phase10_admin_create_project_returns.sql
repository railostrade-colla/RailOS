-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.87 — admin_create_project now accepts expected_return_min/max
-- Date: 2026-05-07
-- Idempotent: safe to re-run.
--
-- The form collects monthly returns from the admin and multiplies them
-- × 12 client-side before calling this RPC, so the DB receives ANNUAL
-- percentages (matching the convention used everywhere else in the
-- codebase — finance.ts, project-details, portfolio analytics).
--
-- Two sets of column names exist in the wild because of legacy seeds:
--   • expected_return_min / expected_return_max   (preferred)
--   • return_min          / return_max            (legacy alias)
-- This migration writes to BOTH so any reader (UI / RPC / report)
-- sees consistent values regardless of which alias they read.
--
-- Defensive ALTER TABLE blocks ensure the columns exist on both old
-- and new schemas.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Ensure return columns exist on `projects` ────────────────
DO $$
BEGIN
  -- Preferred names
  BEGIN
    ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS expected_return_min NUMERIC(8,2);
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS expected_return_max NUMERIC(8,2);
  EXCEPTION WHEN OTHERS THEN NULL; END;
  -- Legacy alias names
  BEGIN
    ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS return_min NUMERIC(8,2);
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS return_max NUMERIC(8,2);
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;


-- ─── 2. Re-create admin_create_project with return params ────────
-- Drop the previous overload first so we don't accumulate ambiguous
-- function signatures (Postgres treats different parameter lists as
-- different functions; the wrapper in lib/data/projects.ts needs the
-- single new 16-arg form).
DROP FUNCTION IF EXISTS public.admin_create_project(
  TEXT, TEXT, TEXT, TEXT, NUMERIC, BIGINT,
  NUMERIC, NUMERIC, NUMERIC,
  TEXT, DATE, DATE, UUID, TEXT
);

CREATE OR REPLACE FUNCTION public.admin_create_project(
  p_name TEXT,
  p_short_description TEXT,
  p_description TEXT,
  p_project_type TEXT,
  p_share_price NUMERIC,
  p_total_shares BIGINT,
  p_offering_percentage NUMERIC DEFAULT 90,
  p_ambassador_percentage NUMERIC DEFAULT 0,
  p_reserve_percentage NUMERIC DEFAULT 10,
  p_location_city TEXT DEFAULT NULL,
  p_offering_start_date DATE DEFAULT NULL,
  p_offering_end_date DATE DEFAULT NULL,
  p_company_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT 'draft',
  p_expected_return_min NUMERIC DEFAULT NULL,
  p_expected_return_max NUMERIC DEFAULT NULL
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
  v_wallets_result JSONB;
BEGIN
  SET CONSTRAINTS ALL IMMEDIATE;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_uid;
  IF v_caller_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

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

  IF p_company_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'company_not_found');
    END IF;
  END IF;

  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(BOTH '-' FROM v_slug);
  IF length(v_slug) < 3 THEN
    v_slug := 'project-' || substr(gen_random_uuid()::text, 1, 8);
  END IF;
  WHILE EXISTS (SELECT 1 FROM public.projects WHERE slug = v_slug) LOOP
    v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  END LOOP;

  v_total_value := p_share_price * p_total_shares;
  v_offering_shares   := FLOOR(p_total_shares * p_offering_percentage / 100);
  v_ambassador_shares := FLOOR(p_total_shares * p_ambassador_percentage / 100);
  v_reserve_shares    := FLOOR(p_total_shares * p_reserve_percentage / 100);

  -- Project INSERT — generated-column-aware
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

  -- Backfill current_market_price if NULL/0
  BEGIN
    UPDATE public.projects
       SET current_market_price = p_share_price
     WHERE id = v_project_id
       AND (current_market_price IS NULL OR current_market_price = 0);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- ─── Phase 10.87: store ANNUAL returns into BOTH column variants
  --     so old + new readers stay consistent. NULL → leave alone. ──
  IF p_expected_return_min IS NOT NULL OR p_expected_return_max IS NOT NULL THEN
    BEGIN
      UPDATE public.projects
         SET expected_return_min = COALESCE(p_expected_return_min, expected_return_min),
             expected_return_max = COALESCE(p_expected_return_max, expected_return_max)
       WHERE id = v_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
      UPDATE public.projects
         SET return_min = COALESCE(p_expected_return_min, return_min),
             return_max = COALESCE(p_expected_return_max, return_max)
       WHERE id = v_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- ─── Wallets — auto-created. Failure is non-fatal. ───
  v_wallets_result := jsonb_build_object(
    'offering_created', FALSE,
    'ambassador_created', FALSE,
    'reserve_created', FALSE
  );
  BEGIN
    v_wallets_result := public.admin_create_project_wallets(
      v_project_id, v_offering_shares, v_ambassador_shares, v_reserve_shares
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'wallets helper threw: %', SQLERRM;
  END;

  -- Audit
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
        'status', p_status,
        'expected_return_min', p_expected_return_min,
        'expected_return_max', p_expected_return_max,
        'wallets_result', v_wallets_result
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'project_id', v_project_id,
    'slug', v_slug,
    'offering_shares', v_offering_shares,
    'ambassador_shares', v_ambassador_shares,
    'reserve_shares', v_reserve_shares,
    'expected_return_min', p_expected_return_min,
    'expected_return_max', p_expected_return_max,
    'wallets', v_wallets_result
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_project(
  TEXT, TEXT, TEXT, TEXT, NUMERIC, BIGINT, NUMERIC, NUMERIC, NUMERIC,
  TEXT, DATE, DATE, UUID, TEXT, NUMERIC, NUMERIC
) TO authenticated;


-- ─── Done ────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.87 applied:';
  RAISE NOTICE '  ✓ projects.expected_return_min / max  (numeric)';
  RAISE NOTICE '  ✓ projects.return_min / max           (legacy alias)';
  RAISE NOTICE '  ✓ admin_create_project takes 2 new optional params';
  RAISE NOTICE '    (annual %% — form converts monthly × 12 client-side)';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
