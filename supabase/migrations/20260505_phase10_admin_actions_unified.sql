-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.54 — unified admin actions: delete project + project-level
--                wallet freeze/unfreeze + community user filters
-- Date: 2026-05-05
-- Idempotent: safe to re-run.
--
-- Three RPC bundles:
--   1. admin_delete_project(p_project_id) — actually deletes (or
--      soft-cancels) a project so the panel's delete button stops
--      lying.
--   2. admin_freeze_project / admin_unfreeze_project — operate on
--      ALL of a project's wallets in one call. The user sees the
--      project as a single unit; the 3-wallet split is internal.
--   3. get_users_for_admin_picker(p_filter, p_search) — powers the
--      gifts panel's user picker (new / active / inactive / search).
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. admin_delete_project ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_project(p_project_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_name TEXT;
  v_has_holdings BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  SELECT name INTO v_name FROM public.projects WHERE id = p_project_id;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;

  -- Check for live holdings — if users own shares in this project,
  -- a hard delete would orphan them. Soft-cancel instead.
  BEGIN
    SELECT EXISTS(
      SELECT 1 FROM public.holdings h WHERE h.project_id = p_project_id AND h.shares_owned > 0
    ) INTO v_has_holdings;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_has_holdings := FALSE;
  END;

  IF v_has_holdings THEN
    -- Soft-delete: mark cancelled. Project disappears from the public
    -- market but the holdings ledger stays intact.
    UPDATE public.projects
       SET status = 'cancelled'
     WHERE id = p_project_id;

    BEGIN
      PERFORM public.log_admin_action(
        'cancel_project', 'project', p_project_id,
        jsonb_build_object('name', v_name, 'reason', 'has_active_holdings')
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;

    RETURN jsonb_build_object(
      'success', TRUE,
      'mode', 'soft_cancel',
      'reason', 'project has active holdings'
    );
  END IF;

  -- Hard delete: nothing depends on this project.
  -- Wallets cascade-delete via FK ON DELETE CASCADE (10.46+).
  -- Best-effort cleanup of dependents that may not cascade.
  BEGIN DELETE FROM public.project_wallets WHERE project_id = p_project_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN DELETE FROM public.market_state WHERE project_id = p_project_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN DELETE FROM public.price_history WHERE project_id = p_project_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  DELETE FROM public.projects WHERE id = p_project_id;

  BEGIN
    PERFORM public.log_admin_action(
      'delete_project', 'project', p_project_id,
      jsonb_build_object('name', v_name, 'mode', 'hard_delete')
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE, 'mode', 'hard_delete');
END
$$;

REVOKE ALL ON FUNCTION public.admin_delete_project(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_project(UUID) TO authenticated;


-- ─── 2. Project-level wallet freeze / unfreeze ────────────────────
CREATE OR REPLACE FUNCTION public.admin_freeze_project(
  p_project_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_count INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  BEGIN
    UPDATE public.project_wallets
       SET status = 'frozen',
           frozen_at = now(),
           frozen_reason = NULLIF(TRIM(COALESCE(p_reason, '')), '')
     WHERE project_id = p_project_id
       AND status <> 'frozen';
    GET DIAGNOSTICS v_count = ROW_COUNT;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'wallets_table_missing');
  END;

  BEGIN
    PERFORM public.log_admin_action(
      'freeze_project', 'project', p_project_id,
      jsonb_build_object('wallets_frozen', v_count, 'reason', p_reason)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'wallets_frozen', v_count
  );
END
$$;

REVOKE ALL ON FUNCTION public.admin_freeze_project(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_freeze_project(UUID, TEXT) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_unfreeze_project(p_project_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_count INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  BEGIN
    UPDATE public.project_wallets
       SET status = 'active',
           frozen_at = NULL,
           frozen_reason = NULL
     WHERE project_id = p_project_id
       AND status = 'frozen';
    GET DIAGNOSTICS v_count = ROW_COUNT;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'wallets_table_missing');
  END;

  BEGIN
    PERFORM public.log_admin_action(
      'unfreeze_project', 'project', p_project_id,
      jsonb_build_object('wallets_unfrozen', v_count)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'wallets_unfrozen', v_count
  );
END
$$;

REVOKE ALL ON FUNCTION public.admin_unfreeze_project(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_unfreeze_project(UUID) TO authenticated;


-- ─── 3. User picker for gifts admin ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_users_for_admin_picker(
  p_filter TEXT DEFAULT 'all',  -- 'all' | 'new' | 'active' | 'inactive'
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
  v_search_clean TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  v_search_clean := NULLIF(TRIM(COALESCE(p_search, '')), '');

  BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        p.id,
        COALESCE(p.full_name, p.username, '—') AS name,
        p.username,
        COALESCE(p.level::TEXT, 'basic') AS level,
        p.created_at,
        p.last_seen_at,
        EXTRACT(DAY FROM (now() - p.created_at))::INT AS days_old,
        CASE
          WHEN p.last_seen_at IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM (now() - p.last_seen_at))::INT
        END AS days_since_seen
      FROM public.profiles p
      WHERE
        (p_filter = 'all' OR
         (p_filter = 'new' AND p.created_at > now() - INTERVAL '30 days') OR
         (p_filter = 'active' AND p.last_seen_at > now() - INTERVAL '7 days') OR
         (p_filter = 'inactive' AND (p.last_seen_at IS NULL OR p.last_seen_at < now() - INTERVAL '30 days'))
        )
        AND (
          v_search_clean IS NULL
          OR p.full_name ILIKE '%' || v_search_clean || '%'
          OR p.username ILIKE '%' || v_search_clean || '%'
        )
      ORDER BY p.created_at DESC NULLS LAST
      LIMIT GREATEST(0, LEAST(p_limit, 200))
    ) t;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_result := '[]'::jsonb;
  END;

  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.get_users_for_admin_picker(TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_users_for_admin_picker(TEXT, TEXT, INT) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.54 applied:';
  RAISE NOTICE '  ✓ admin_delete_project';
  RAISE NOTICE '  ✓ admin_freeze_project / admin_unfreeze_project';
  RAISE NOTICE '  ✓ get_users_for_admin_picker';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
