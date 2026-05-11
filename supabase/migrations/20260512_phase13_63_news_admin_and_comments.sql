-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.63 — News admin CRUD + comments + storage bucket
-- Date: 2026-05-12
-- Idempotent.
--
-- Founder spec:
--   1. Admin → Content → جديد تبويب "الأخبار" (يحلّ محلّ تبويب
--      الصفحات القانونيّة) لنشر الأخبار، يدعم رفع صورة + التحكّم
--      بالحالة.
--   2. الأخبار المنشورة تظهر في الصفحة الرئيسيّة + صفحة السوق
--      (موجود — هذا فقط عن ال CRUD الإداري).
--   3. كلّ خبر يدعم تفاعلاً بالإعجاب (موجود) + تعليقات (جديد).
--
-- Changes:
--   1. news-images storage bucket (public) + RLS
--   2. news_comments table + RLS + indexes + counter trigger
--   3. Counter column news.comments_count + trigger
--   4. admin_create_news / admin_update_news / admin_delete_news RPCs
--   5. submit_news_comment / delete_news_comment RPCs
--   6. Realtime publication on news + news_reactions + news_comments
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. news-images storage bucket ──────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('news-images', 'news-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- Anyone can read; only admins can upload (enforced via the
-- admin_create_news / admin_update_news RPCs which use service-side
-- uploads; admins also can upload directly from the panel via these
-- policies).
DROP POLICY IF EXISTS "news-images public read" ON storage.objects;
CREATE POLICY "news-images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'news-images');

DROP POLICY IF EXISTS "news-images admin write" ON storage.objects;
CREATE POLICY "news-images admin write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'news-images' AND public.is_admin());

DROP POLICY IF EXISTS "news-images admin update" ON storage.objects;
CREATE POLICY "news-images admin update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'news-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'news-images' AND public.is_admin());

DROP POLICY IF EXISTS "news-images admin delete" ON storage.objects;
CREATE POLICY "news-images admin delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'news-images' AND public.is_admin());


-- ─── 2. comments_count on news + comments table ────────────────
ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS comments_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.news_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id     UUID NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 2000),
  is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_comments_news
  ON public.news_comments(news_id, created_at DESC)
  WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_news_comments_user
  ON public.news_comments(user_id, created_at DESC);

ALTER TABLE public.news_comments ENABLE ROW LEVEL SECURITY;

-- Read: anyone authenticated (news is public content).
DROP POLICY IF EXISTS "anyone reads news comments" ON public.news_comments;
CREATE POLICY "anyone reads news comments"
  ON public.news_comments FOR SELECT
  USING (TRUE);

-- Insert: through RPC only (no direct INSERT).
DROP POLICY IF EXISTS "no direct insert news comments" ON public.news_comments;
CREATE POLICY "no direct insert news comments"
  ON public.news_comments FOR INSERT
  WITH CHECK (FALSE);

-- Update/Delete: through RPC only.
DROP POLICY IF EXISTS "no direct update news comments" ON public.news_comments;
CREATE POLICY "no direct update news comments"
  ON public.news_comments FOR UPDATE
  USING (FALSE);

DROP POLICY IF EXISTS "no direct delete news comments" ON public.news_comments;
CREATE POLICY "no direct delete news comments"
  ON public.news_comments FOR DELETE
  USING (FALSE);


-- Counter trigger — keeps news.comments_count in sync with
-- non-deleted rows.
CREATE OR REPLACE FUNCTION public.trg_news_comments_count_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT NEW.is_deleted THEN
      UPDATE public.news
         SET comments_count = comments_count + 1,
             updated_at = NOW()
       WHERE id = NEW.news_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
      UPDATE public.news
         SET comments_count = GREATEST(0, comments_count - 1),
             updated_at = NOW()
       WHERE id = NEW.news_id;
    ELSIF OLD.is_deleted = TRUE AND NEW.is_deleted = FALSE THEN
      UPDATE public.news
         SET comments_count = comments_count + 1,
             updated_at = NOW()
       WHERE id = NEW.news_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF NOT OLD.is_deleted THEN
      UPDATE public.news
         SET comments_count = GREATEST(0, comments_count - 1),
             updated_at = NOW()
       WHERE id = OLD.news_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_news_comments_count_update ON public.news_comments;
CREATE TRIGGER trg_news_comments_count_update
  AFTER INSERT OR UPDATE OR DELETE ON public.news_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_news_comments_count_update();


-- ─── 3. Admin CRUD RPCs ────────────────────────────────────────

DROP FUNCTION IF EXISTS public.admin_create_news(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION public.admin_create_news(
  p_title              TEXT,
  p_content            TEXT,
  p_summary            TEXT DEFAULT NULL,
  p_news_type          TEXT DEFAULT 'announcement',
  p_cover_image_url    TEXT DEFAULT NULL,
  p_related_project_id UUID DEFAULT NULL,
  p_is_pinned          BOOLEAN DEFAULT FALSE,
  p_publish            BOOLEAN DEFAULT TRUE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_news_id UUID;
  v_slug    TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_admin');
  END IF;
  IF p_title IS NULL OR LENGTH(TRIM(p_title)) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_title');
  END IF;
  IF p_content IS NULL OR LENGTH(TRIM(p_content)) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_content');
  END IF;

  -- Slug — derive from title + short UUID to guarantee uniqueness.
  v_slug := LOWER(REGEXP_REPLACE(LEFT(p_title, 50), '[^a-zA-Z0-9؀-ۿ]+', '-', 'g'));
  v_slug := TRIM(BOTH '-' FROM v_slug) || '-' || SUBSTR(gen_random_uuid()::TEXT, 1, 6);

  INSERT INTO public.news (
    title, slug, summary, content, news_type,
    cover_image_url, related_project_id,
    is_pinned, is_published, published_at,
    author_id, created_at, updated_at
  ) VALUES (
    TRIM(p_title), v_slug,
    NULLIF(TRIM(COALESCE(p_summary, '')), ''),
    p_content,
    p_news_type::news_type,
    NULLIF(TRIM(COALESCE(p_cover_image_url, '')), ''),
    p_related_project_id,
    COALESCE(p_is_pinned, FALSE),
    COALESCE(p_publish, TRUE),
    CASE WHEN COALESCE(p_publish, TRUE) THEN NOW() ELSE NULL END,
    v_uid, NOW(), NOW()
  )
  RETURNING id INTO v_news_id;

  RETURN jsonb_build_object('success', true, 'news_id', v_news_id, 'slug', v_slug);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_news(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_news(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN) TO authenticated;


DROP FUNCTION IF EXISTS public.admin_update_news(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION public.admin_update_news(
  p_news_id            UUID,
  p_title              TEXT DEFAULT NULL,
  p_content            TEXT DEFAULT NULL,
  p_summary            TEXT DEFAULT NULL,
  p_news_type          TEXT DEFAULT NULL,
  p_cover_image_url    TEXT DEFAULT NULL,
  p_related_project_id UUID DEFAULT NULL,
  p_is_pinned          BOOLEAN DEFAULT NULL,
  p_is_published       BOOLEAN DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_updated INT;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_admin');
  END IF;
  IF p_news_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  UPDATE public.news
     SET title             = COALESCE(NULLIF(TRIM(p_title), ''), title),
         content           = COALESCE(p_content, content),
         summary           = CASE
                               WHEN p_summary IS NULL THEN summary
                               WHEN TRIM(p_summary) = '' THEN NULL
                               ELSE TRIM(p_summary) END,
         news_type         = COALESCE(p_news_type::news_type, news_type),
         cover_image_url   = CASE
                               WHEN p_cover_image_url IS NULL THEN cover_image_url
                               WHEN TRIM(p_cover_image_url) = '' THEN NULL
                               ELSE TRIM(p_cover_image_url) END,
         related_project_id = COALESCE(p_related_project_id, related_project_id),
         is_pinned         = COALESCE(p_is_pinned, is_pinned),
         is_published      = COALESCE(p_is_published, is_published),
         published_at      = CASE
                               WHEN p_is_published IS TRUE AND published_at IS NULL THEN NOW()
                               ELSE published_at END,
         updated_at        = NOW()
   WHERE id = p_news_id
  RETURNING 1 INTO v_updated;

  IF v_updated IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_news(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_news(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, BOOLEAN) TO authenticated;


DROP FUNCTION IF EXISTS public.admin_delete_news(UUID);

CREATE OR REPLACE FUNCTION public.admin_delete_news(p_news_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_deleted INT;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_admin');
  END IF;

  DELETE FROM public.news WHERE id = p_news_id
  RETURNING 1 INTO v_deleted;

  IF v_deleted IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_news(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_news(UUID) TO authenticated;


-- ─── 4. Comment RPCs (user-callable) ────────────────────────────

DROP FUNCTION IF EXISTS public.submit_news_comment(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.submit_news_comment(
  p_news_id UUID,
  p_content TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_clean     TEXT;
  v_comment_id UUID;
  v_news      RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF p_news_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;
  v_clean := TRIM(COALESCE(p_content, ''));
  IF LENGTH(v_clean) < 1 OR LENGTH(v_clean) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_content');
  END IF;

  SELECT id, is_published INTO v_news FROM public.news WHERE id = p_news_id;
  IF v_news.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'news_not_found');
  END IF;
  IF NOT v_news.is_published THEN
    RETURN jsonb_build_object('success', false, 'error', 'news_not_published');
  END IF;

  INSERT INTO public.news_comments (news_id, user_id, content)
  VALUES (p_news_id, v_uid, v_clean)
  RETURNING id INTO v_comment_id;

  RETURN jsonb_build_object('success', true, 'comment_id', v_comment_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_news_comment(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_news_comment(UUID, TEXT) TO authenticated;


DROP FUNCTION IF EXISTS public.delete_news_comment(UUID);

CREATE OR REPLACE FUNCTION public.delete_news_comment(p_comment_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_comment RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  SELECT id, user_id, is_deleted INTO v_comment
    FROM public.news_comments WHERE id = p_comment_id;
  IF v_comment.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_comment.is_deleted THEN
    RETURN jsonb_build_object('success', true); -- idempotent
  END IF;
  IF v_comment.user_id <> v_uid AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  UPDATE public.news_comments
     SET is_deleted = TRUE, updated_at = NOW()
   WHERE id = p_comment_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_news_comment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_news_comment(UUID) TO authenticated;


-- ─── 5. Realtime publication ───────────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.news;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.news_comments;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.news_reactions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.news           REPLICA IDENTITY FULL;
ALTER TABLE public.news_comments  REPLICA IDENTITY FULL;
ALTER TABLE public.news_reactions REPLICA IDENTITY FULL;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.63 news admin + comments applied.';
  RAISE NOTICE '  ✓ news-images bucket + admin RLS';
  RAISE NOTICE '  ✓ news.comments_count + news_comments table';
  RAISE NOTICE '  ✓ admin_create_news / admin_update_news / admin_delete_news';
  RAISE NOTICE '  ✓ submit_news_comment / delete_news_comment';
  RAISE NOTICE '  ✓ Realtime on news + news_comments + news_reactions';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
