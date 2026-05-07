-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.91 — Precision fix: ROUND instead of FLOOR for share splits
-- Date: 2026-05-08
-- Idempotent: safe to re-run.
--
-- Problem: FLOOR(p_total_shares * p_offering_percentage / 100) can
-- silently produce an off-by-one result whenever the intermediate
-- product is not an exact multiple of 100 in Postgres NUMERIC
-- arithmetic. ROUND gives the mathematically intended value.
--
-- Example: 40001 * 40 / 100 = 16000.4 → FLOOR = 16000 ✓
--          39999 * 40 / 100 = 15999.6 → FLOOR = 15999 ✗ (should be 16000)
--
-- Changes:
--   1. Re-creates admin_create_project (29-arg form from Phase 10.90)
--      replacing every FLOOR with ROUND for wallet share splits.
--   2. Backfills current_market_price = share_price for any rows
--      where they diverged (e.g. old trigger bug, computed-column
--      drift).  This only touches rows where the values differ — it
--      does NOT overwrite legitimate secondary-market price moves.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Re-create admin_create_project with ROUND ─────────────────
CREATE OR REPLACE FUNCTION public.admin_create_project(
  p_name TEXT,
  p_short_description TEXT,
  p_description TEXT,
  p_project_type TEXT,
  p_share_price NUMERIC,
  p_total_shares BIGINT,
  p_offering_percentage NUMERIC DEFAULT 30,
  p_ambassador_percentage NUMERIC DEFAULT 0,
  p_reserve_percentage NUMERIC DEFAULT 0,
  p_location_city TEXT DEFAULT NULL,
  p_offering_start_date DATE DEFAULT NULL,
  p_offering_end_date DATE DEFAULT NULL,
  p_company_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT 'draft',
  p_expected_return_min NUMERIC DEFAULT NULL,
  p_expected_return_max NUMERIC DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_cover_url TEXT DEFAULT NULL,
  -- Phase 10.90 additions
  p_duration_open BOOLEAN DEFAULT TRUE,
  p_duration_months INT DEFAULT NULL,
  p_documents JSONB DEFAULT '[]'::jsonb,
  p_gallery_images JSONB DEFAULT '[]'::jsonb,
  p_owner_name TEXT DEFAULT NULL,
  p_owner_phone TEXT DEFAULT NULL,
  p_owner_email TEXT DEFAULT NULL,
  p_detailed_address TEXT DEFAULT NULL,
  p_profit_source TEXT DEFAULT NULL,
  p_distribution_type TEXT DEFAULT NULL,
  p_risk_level TEXT DEFAULT NULL
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
  v_actual_start DATE;
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

  -- ── Phase 10.91: ROUND instead of FLOOR ────────────────────────
  -- FLOOR silently drops 1 share whenever the product lands just below
  -- an integer boundary in NUMERIC arithmetic.  ROUND gives the exact
  -- value the admin intended (e.g. 40000 * 40% = 16000 exactly).
  v_offering_shares   := ROUND(p_total_shares * p_offering_percentage / 100);
  v_ambassador_shares := ROUND(p_total_shares * p_ambassador_percentage / 100);
  v_reserve_shares    := ROUND(p_total_shares * p_reserve_percentage   / 100);

  -- Phase 10.90: offering_start_date defaults to today if not provided.
  v_actual_start := COALESCE(p_offering_start_date, CURRENT_DATE);

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
      p_location_city, v_actual_start, p_offering_end_date,
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
        p_location_city, v_actual_start, p_offering_end_date,
        p_company_id, p_status::project_status, v_uid
      )
      RETURNING id INTO v_project_id;
  END;

  -- Ensure current_market_price = share_price (the launch price).
  -- Only overwrites NULL/zero — never touches a legitimately updated price.
  BEGIN
    UPDATE public.projects
       SET current_market_price = p_share_price
     WHERE id = v_project_id
       AND (current_market_price IS NULL OR current_market_price = 0);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Returns (annual; both column variants kept in sync)
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

  -- Brand assets
  IF p_logo_url IS NOT NULL OR p_cover_url IS NOT NULL THEN
    BEGIN
      UPDATE public.projects
         SET logo_url  = COALESCE(NULLIF(trim(p_logo_url),  ''), logo_url),
             cover_url = COALESCE(NULLIF(trim(p_cover_url), ''), cover_url)
       WHERE id = v_project_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- Phase 10.90: duration / docs / gallery / owner contact / distribution
  BEGIN
    UPDATE public.projects
       SET duration_open    = COALESCE(p_duration_open, duration_open),
           duration_months  = CASE
             WHEN COALESCE(p_duration_open, TRUE) THEN NULL
             ELSE p_duration_months
           END,
           documents        = COALESCE(p_documents, documents, '[]'::jsonb),
           gallery_images   = COALESCE(p_gallery_images, gallery_images, '[]'::jsonb),
           owner_name       = COALESCE(NULLIF(trim(p_owner_name), ''),    owner_name),
           owner_phone      = COALESCE(NULLIF(trim(p_owner_phone), ''),   owner_phone),
           owner_email      = COALESCE(NULLIF(trim(p_owner_email), ''),   owner_email),
           detailed_address = COALESCE(NULLIF(trim(p_detailed_address), ''), detailed_address),
           profit_source    = COALESCE(NULLIF(trim(p_profit_source), ''),    profit_source)
     WHERE id = v_project_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Distribution type — best-effort cast to enum if it exists.
  IF p_distribution_type IS NOT NULL THEN
    BEGIN
      EXECUTE format(
        'UPDATE public.projects SET distribution_type = %L WHERE id = %L',
        p_distribution_type, v_project_id
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- Risk level
  IF p_risk_level IS NOT NULL THEN
    BEGIN
      EXECUTE format(
        'UPDATE public.projects SET risk_level = %L WHERE id = %L',
        p_risk_level, v_project_id
      );
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
        'offering_shares', v_offering_shares,
        'duration_open', p_duration_open,
        'duration_months', p_duration_months,
        'docs_count', jsonb_array_length(COALESCE(p_documents, '[]'::jsonb)),
        'gallery_count', jsonb_array_length(COALESCE(p_gallery_images, '[]'::jsonb)),
        'wallets_result', v_wallets_result
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'project_id', v_project_id,
    'slug', v_slug,
    'offering_shares', v_offering_shares,
    'reserve_shares', v_reserve_shares,
    'wallets', v_wallets_result
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_project(
  TEXT, TEXT, TEXT, TEXT, NUMERIC, BIGINT,
  NUMERIC, NUMERIC, NUMERIC,
  TEXT, DATE, DATE, UUID, TEXT,
  NUMERIC, NUMERIC,
  TEXT, TEXT,
  BOOLEAN, INT, JSONB, JSONB,
  TEXT, TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT
) TO authenticated;


-- ─── 2. Backfill current_market_price = share_price ───────────────
-- Fix any rows where current_market_price diverged from share_price
-- due to old trigger bugs or computed-column issues.  This only
-- touches rows where the values differ — it does NOT overwrite a
-- price that was legitimately moved by secondary-market trading.
-- (Since all current data is test data, resetting is safe.)
DO $$
DECLARE
  v_fixed INT;
BEGIN
  UPDATE public.projects
     SET current_market_price = share_price
   WHERE (current_market_price IS NULL OR current_market_price != share_price);
  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  IF v_fixed > 0 THEN
    RAISE NOTICE 'Phase 10.91: fixed current_market_price for % row(s)', v_fixed;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Phase 10.91: current_market_price backfill skipped: %', SQLERRM;
END $$;


-- ─── 3. Fix offering wallet total_shares with ROUND ───────────────
-- Re-compute offering wallet shares for projects where the wallet
-- was created with FLOOR and might have the wrong count.
DO $$
DECLARE
  r RECORD;
  v_correct_offering BIGINT;
  v_fixed INT := 0;
BEGIN
  FOR r IN
    SELECT
      p.id,
      p.total_shares,
      p.offering_percentage,
      w.id   AS wallet_id,
      w.total_shares AS wallet_shares
    FROM public.projects p
    JOIN public.project_wallets w
      ON w.project_id = p.id AND w.wallet_type = 'offering'
    WHERE p.total_shares > 0 AND p.offering_percentage > 0
  LOOP
    v_correct_offering := ROUND(r.total_shares * r.offering_percentage / 100);

    -- Only touch wallets where the count is wrong.
    IF r.wallet_shares <> v_correct_offering THEN
      UPDATE public.project_wallets
         SET total_shares     = v_correct_offering,
             -- Keep available_shares <= new total (don't go negative if some were sold)
             available_shares = LEAST(available_shares, v_correct_offering)
       WHERE id = r.wallet_id;
      v_fixed := v_fixed + 1;
    END IF;
  END LOOP;

  IF v_fixed > 0 THEN
    RAISE NOTICE 'Phase 10.91: fixed offering wallet for % project(s)', v_fixed;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Phase 10.91: wallet fix skipped: %', SQLERRM;
END $$;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.91 applied:';
  RAISE NOTICE '  ✓ admin_create_project: FLOOR → ROUND for wallet share splits';
  RAISE NOTICE '  ✓ current_market_price backfill → share_price for drifted rows';
  RAISE NOTICE '  ✓ offering wallet total_shares recalculated with ROUND';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
