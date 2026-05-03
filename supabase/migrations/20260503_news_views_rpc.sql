-- ═══════════════════════════════════════════════════════════════════
-- increment_news_views(p_news_id) — bump views_count from clients
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Why an RPC instead of a direct UPDATE from the page?
--   • The `news` table is admin-authored — RLS lets users SELECT
--     published rows, but UPDATE is restricted (the row's author_id
--     check fails for end users).
--   • A SECURITY DEFINER function lets us narrowly scope the
--     mutation to a single column (`views_count`) and a single row
--     by id, without granting blanket UPDATE on the table.
--   • Failures (missing row, RLS, permissions) are swallowed by the
--     caller so a single bad row never breaks the news modal.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.increment_news_views(p_news_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.news
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = p_news_id
    -- Only count views on published rows. Non-published / archived
    -- news shouldn't accrue inflated view counts.
    AND is_published = TRUE;
END;
$$;

COMMENT ON FUNCTION public.increment_news_views(UUID) IS
  'Atomically increments news.views_count by 1 for a published row. '
  'SECURITY DEFINER so end users can call it from the news modal '
  'without holding direct UPDATE on the news table.';

-- Allow any authenticated user to call it.
GRANT EXECUTE ON FUNCTION public.increment_news_views(UUID) TO authenticated;
