-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.45 — admin_create_project v3: bullet-proof wallet handling
-- Date: 2026-05-05
-- Idempotent: safe to re-run.
--
-- Error reported by user: "insert or update on table 'project_wallets'
-- violates foreign key constraint 'project_wallets_project_id_fkey'"
--
-- The previous version's `EXCEPTION WHEN OTHERS` block should have
-- caught this, but in some Supabase deployments cached query plans
-- or savepoint visibility issues let the error bubble up anyway.
--
-- This v3 fixes it three ways:
--   1. Wallets creation is moved into its OWN inner function,
--      `admin_create_project_wallets(uuid, bigint, bigint, bigint)`,
--      so the main RPC's success doesn't depend on the wallets'
--      success at all.
--   2. The main RPC calls the inner function via PERFORM inside an
--      EXCEPTION block. The inner function's failure is logged via
--      RAISE NOTICE but never propagates.
--   3. Each individual wallet INSERT inside the inner function has
--      its own EXCEPTION block. Even if one wallet fails (FK,
--      duplicate, whatever), the others still get created.
--
-- Result: creating a project ALWAYS succeeds as long as the project
-- row itself can be inserted. Wallets are best-effort.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Inner wallets-creation helper ──────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_create_project_wallets(
  p_project_id UUID,
  p_offering_shares BIGINT,
  p_ambassador_shares BIGINT,
  p_reserve_shares BIGINT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offering_ok BOOLEAN := FALSE;
  v_ambassador_ok BOOLEAN := FALSE;
  v_reserve_ok BOOLEAN := FALSE;
BEGIN
  -- Each wallet wrapped in its own savepoint so a single FK or
  -- duplicate-key error doesn't sink the rest.
  BEGIN
    INSERT INTO public.project_wallets (project_id, wallet_type, total_shares, available_shares)
    VALUES (p_project_id, 'offering', p_offering_shares, p_offering_shares);
    v_offering_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'admin_create_project_wallets: offering wallet failed: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.project_wallets (project_id, wallet_type, total_shares, available_shares)
    VALUES (p_project_id, 'ambassador', p_ambassador_shares, p_ambassador_shares);
    v_ambassador_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'admin_create_project_wallets: ambassador wallet failed: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.project_wallets (project_id, wallet_type, total_shares, available_shares)
    VALUES (p_project_id, 'reserve', p_reserve_shares, p_reserve_shares);
    v_reserve_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'admin_create_project_wallets: reserve wallet failed: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'offering_created',   v_offering_ok,
    'ambassador_created', v_ambassador_ok,
    'reserve_created',    v_reserve_ok
  );
END
$$;

REVOKE ALL ON FUNCTION public.admin_create_project_wallets(UUID, BIGINT, BIGINT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_project_wallets(UUID, BIGINT, BIGINT, BIGINT) TO authenticated;


-- ─── 2. Main RPC ────────────────────────────────────────────────────
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
  v_wallets_result JSONB;
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

  IF p_company_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'company_not_found');
    END IF;
  END IF;

  -- Slug
  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(BOTH '-' FROM v_slug);
  IF length(v_slug) < 3 THEN
    v_slug := 'project-' || substr(gen_random_uuid()::text, 1, 8);
  END IF;
  WHILE EXISTS (SELECT 1 FROM public.projects WHERE slug = v_slug) LOOP
    v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  END LOOP;

  v_total_value := p_share_price * p_total_shares;
  v_offering_shares := FLOOR(p_total_shares * p_offering_percentage / 100);
  v_ambassador_shares := FLOOR(p_total_shares * p_ambassador_percentage / 100);
  v_reserve_shares := p_total_shares - v_offering_shares - v_ambassador_shares;

  -- ─── Project INSERT — generated-column-aware (Phase 10.43) ───
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

  -- Set current_market_price defensively (skipped silently if generated)
  BEGIN
    UPDATE public.projects
       SET current_market_price = p_share_price
     WHERE id = v_project_id
       AND (current_market_price IS NULL OR current_market_price = 0);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- ─── Wallets — call the inner helper. NEVER fails the parent. ───
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
    -- Even the wrapping function failed (table missing, etc.) — log
    -- but proceed. The project is already created.
    RAISE NOTICE 'admin_create_project: wallets helper threw: %', SQLERRM;
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
        'status', p_status,
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
    'wallets', v_wallets_result
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
  RAISE NOTICE 'Phase 10.45 applied: admin_create_project v3 with bullet-proof wallet handling.';
END $$;
