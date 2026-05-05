-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.63 — wire orphan tables (market engine, deal chat,
--                price history, FAQs, distributions, fund txns).
-- Date: 2026-05-08
-- Idempotent: safe to re-run.
--
-- Audit (Phase 10.62) found 11 tables that exist in the production DB
-- but had no read/write code path. This migration ships SECURITY
-- DEFINER RPCs and helper views that surface them to the app + admin
-- panels:
--
--   1. get_market_engine_overview()       — stability_fund + recent
--      fund_transactions + development_promises summary (admin only)
--   2. get_fund_transactions(p_limit)     — recent fund txns (admin)
--   3. get_development_promises_for_project(p_project_id)
--   4. get_price_history(p_project_id, p_limit)  — for charts
--   5. get_deal_messages(p_deal_id)       — chat between buyer+seller
--      (RLS-aware; only the parties + admins see rows)
--   6. post_deal_message(p_deal_id, p_content, p_attachment_url)
--   7. get_active_faqs()                  — reads if `faqs` exists
--   8. get_user_distributions(p_user_id)  — defensive on `distributions`
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Market engine overview ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_market_engine_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fund JSONB := '{}'::jsonb;
  v_recent_txns JSONB := '[]'::jsonb;
  v_promises_summary JSONB := '{}'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'not_admin');
  END IF;

  BEGIN
    SELECT row_to_json(s)::jsonb
    INTO v_fund
    FROM (SELECT * FROM public.stability_fund WHERE id = 1) s;
    IF v_fund IS NULL THEN v_fund := '{}'::jsonb; END IF;
  EXCEPTION WHEN OTHERS THEN v_fund := '{}'::jsonb; END;

  BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_recent_txns
    FROM (
      SELECT id, type, amount, project_id, shares_count,
             price_per_share, recorded_at, notes
      FROM public.fund_transactions
      ORDER BY recorded_at DESC
      LIMIT 25
    ) t;
  EXCEPTION WHEN OTHERS THEN v_recent_txns := '[]'::jsonb; END;

  BEGIN
    SELECT jsonb_build_object(
      'total',     COUNT(*),
      'pending',   COUNT(*) FILTER (WHERE status = 'pending'),
      'completed', COUNT(*) FILTER (WHERE status = 'completed'),
      'overdue',   COUNT(*) FILTER (WHERE status = 'pending' AND due_at < NOW())
    )
    INTO v_promises_summary
    FROM public.development_promises;
  EXCEPTION WHEN OTHERS THEN v_promises_summary := '{}'::jsonb; END;

  RETURN jsonb_build_object(
    'stability_fund',    v_fund,
    'recent_txns',       v_recent_txns,
    'promises_summary',  v_promises_summary,
    'snapshot_at',       NOW()
  );
END
$$;

REVOKE ALL ON FUNCTION public.get_market_engine_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_market_engine_overview() TO authenticated;


-- ─── 2. Recent fund transactions ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_fund_transactions(p_limit INT DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;
  BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        ft.id, ft.type, ft.amount, ft.project_id,
        p.name AS project_name,
        ft.shares_count, ft.price_per_share,
        ft.recorded_at, ft.notes
      FROM public.fund_transactions ft
      LEFT JOIN public.projects p ON p.id = ft.project_id
      ORDER BY ft.recorded_at DESC
      LIMIT GREATEST(0, LEAST(p_limit, 500))
    ) t;
  EXCEPTION WHEN OTHERS THEN v_result := '[]'::jsonb; END;
  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.get_fund_transactions(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fund_transactions(INT) TO authenticated;


-- ─── 3. Development promises for a project ──────────────────────
CREATE OR REPLACE FUNCTION public.get_development_promises_for_project(p_project_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
BEGIN
  -- Public read (project promises are transparency information).
  BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        id, project_id, promise_text, promise_type, status,
        created_at, due_at, completed_at, evidence_url
      FROM public.development_promises
      WHERE project_id = p_project_id
      ORDER BY due_at ASC
    ) t;
  EXCEPTION WHEN OTHERS THEN v_result := '[]'::jsonb; END;
  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.get_development_promises_for_project(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_development_promises_for_project(UUID) TO authenticated, anon;


-- ─── 4. Price history for a project (for charts) ───────────────
CREATE OR REPLACE FUNCTION public.get_price_history(
  p_project_id UUID,
  p_limit INT DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
BEGIN
  -- Public read (price history is market transparency).
  BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.recorded_at), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        id, project_id, old_price, new_price, change_pct,
        recorded_at, phase, trigger
      FROM public.price_history
      WHERE project_id = p_project_id
      ORDER BY recorded_at DESC
      LIMIT GREATEST(0, LEAST(p_limit, 1000))
    ) t;
  EXCEPTION WHEN OTHERS THEN v_result := '[]'::jsonb; END;
  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.get_price_history(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_price_history(UUID, INT) TO authenticated, anon;


-- ─── 5. Deal messages — chat fetch ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_deal_messages(p_deal_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_buyer UUID;
  v_seller UUID;
  v_result JSONB := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Authorize: caller must be a party or an admin.
  SELECT buyer_id, seller_id INTO v_buyer, v_seller
  FROM public.deals WHERE id = p_deal_id;

  IF v_buyer IS NULL OR (v_uid <> v_buyer AND v_uid <> v_seller AND NOT public.is_admin()) THEN
    RETURN '[]'::jsonb;
  END IF;

  BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        m.id, m.deal_id, m.sender_id,
        COALESCE(p.full_name, p.username, '—') AS sender_name,
        m.message_type::TEXT AS message_type,
        m.content, m.attachment_url,
        m.is_read, m.read_at, m.created_at
      FROM public.deal_messages m
      LEFT JOIN public.profiles p ON p.id = m.sender_id
      WHERE m.deal_id = p_deal_id
      ORDER BY m.created_at ASC
    ) t;
  EXCEPTION WHEN OTHERS THEN v_result := '[]'::jsonb; END;
  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.get_deal_messages(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_deal_messages(UUID) TO authenticated;


-- ─── 6. Deal messages — post a message ──────────────────────────
CREATE OR REPLACE FUNCTION public.post_deal_message(
  p_deal_id UUID,
  p_content TEXT,
  p_attachment_url TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_buyer UUID;
  v_seller UUID;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF (p_content IS NULL OR length(trim(p_content)) = 0)
     AND (p_attachment_url IS NULL OR length(trim(p_attachment_url)) = 0)
  THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'empty_message');
  END IF;

  SELECT buyer_id, seller_id INTO v_buyer, v_seller
  FROM public.deals WHERE id = p_deal_id;
  IF v_buyer IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'deal_not_found');
  END IF;
  IF v_uid <> v_buyer AND v_uid <> v_seller AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_party');
  END IF;

  INSERT INTO public.deal_messages (deal_id, sender_id, content, attachment_url)
  VALUES (p_deal_id, v_uid, NULLIF(trim(p_content), ''), NULLIF(trim(p_attachment_url), ''))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', TRUE, 'id', v_id);
END
$$;

REVOKE ALL ON FUNCTION public.post_deal_message(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_deal_message(UUID, TEXT, TEXT) TO authenticated;


-- ─── 7. FAQs — defensive read (table may have any schema) ───────
CREATE OR REPLACE FUNCTION public.get_active_faqs()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
BEGIN
  BEGIN
    -- Try the most-likely shape first (id, question, answer, ordering, is_active).
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.ordering), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        f.id,
        COALESCE(f.question, f.title, f.q, '—')   AS question,
        COALESCE(f.answer, f.body, f.a, '')       AS answer,
        COALESCE(f.category, '')                  AS category,
        COALESCE(f.ordering, f."order", 0)        AS ordering,
        COALESCE(f.is_active, TRUE)               AS is_active
      FROM public.faqs f
      WHERE COALESCE(f.is_active, TRUE) = TRUE
    ) t;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    -- Fall back to a column-agnostic dump.
    BEGIN
      SELECT COALESCE(jsonb_agg(row_to_json(f)), '[]'::jsonb)
      INTO v_result FROM public.faqs f LIMIT 100;
    EXCEPTION WHEN OTHERS THEN v_result := '[]'::jsonb; END;
  END;
  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.get_active_faqs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_faqs() TO authenticated, anon;


-- ─── 8. Distributions — defensive user-side reader ──────────────
CREATE OR REPLACE FUNCTION public.get_user_distributions(p_user_id UUID DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := COALESCE(p_user_id, auth.uid());
  v_result JSONB := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;

  -- Users can read their own; admins can read any.
  IF p_user_id IS NOT NULL AND p_user_id <> auth.uid() AND NOT public.is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.recorded_at DESC NULLS LAST), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT *
      FROM public.distributions d
      WHERE d.user_id = v_uid
      LIMIT 200
    ) t;
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    -- Schema doesn't have user_id — return empty rather than fail.
    v_result := '[]'::jsonb;
  END;
  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.get_user_distributions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_distributions(UUID) TO authenticated;


-- ─── Done ─────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.63 applied — orphan tables wired:';
  RAISE NOTICE '  ✓ get_market_engine_overview';
  RAISE NOTICE '  ✓ get_fund_transactions';
  RAISE NOTICE '  ✓ get_development_promises_for_project';
  RAISE NOTICE '  ✓ get_price_history';
  RAISE NOTICE '  ✓ get_deal_messages + post_deal_message';
  RAISE NOTICE '  ✓ get_active_faqs (defensive)';
  RAISE NOTICE '  ✓ get_user_distributions (defensive)';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
