-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.53 — Partners + realtime for friend graph
-- Date: 2026-05-11
-- Idempotent.
--
-- Founder spec:
--   1. الطلب يصل ويُقبل بدون تحديث الصفحة → realtime على
--      friend_requests + friendships
--   2. بعد القبول، الطرفان يرونها فوراً في قائمة الأصدقاء
--   3. صديق يمكن "ترقيته" إلى شريك → يظهر في تبويب الشركاء
--   4. صفحة إنشاء العقد تختار الشركاء من القائمة أو بإدخال ID
--
-- Changes:
--   1. ALTER friendships ADD COLUMN is_partner (default FALSE)
--   2. RPC mark_friend_as_partner(other_user_id, is_partner) —
--      SECURITY DEFINER, toggles the canonicalised row
--   3. Enable realtime publication on friend_requests + friendships
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. is_partner column ────────────────────────────────────────
ALTER TABLE public.friendships
  ADD COLUMN IF NOT EXISTS is_partner BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_friendships_partner
  ON public.friendships(user_id_a, user_id_b)
  WHERE is_partner = TRUE;

COMMENT ON COLUMN public.friendships.is_partner IS
  'TRUE = طرفا الصداقة شركاء — قابلون للاختيار في صفحة إنشاء العقد';


-- ─── 2. mark_friend_as_partner RPC ───────────────────────────────
-- Either side of a friendship can flip the partner flag on their
-- canonicalised row. Returns success/error JSON for clean client UX.

DROP FUNCTION IF EXISTS public.mark_friend_as_partner(UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.mark_friend_as_partner(
  p_other_user_id UUID,
  p_is_partner    BOOLEAN
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_a       UUID;
  v_b       UUID;
  v_updated INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF p_other_user_id IS NULL OR p_other_user_id = v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_user');
  END IF;

  v_a := LEAST(v_uid, p_other_user_id);
  v_b := GREATEST(v_uid, p_other_user_id);

  UPDATE public.friendships
     SET is_partner = COALESCE(p_is_partner, FALSE)
   WHERE user_id_a = v_a
     AND user_id_b = v_b
  RETURNING 1 INTO v_updated;

  IF v_updated IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_friends');
  END IF;

  RETURN jsonb_build_object('success', true, 'is_partner', p_is_partner);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_friend_as_partner(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_friend_as_partner(UUID, BOOLEAN) TO authenticated;


-- ─── 3. Realtime publication ─────────────────────────────────────
-- Add both tables to the `supabase_realtime` publication so the
-- community page can subscribe to INSERT/UPDATE/DELETE and refresh
-- live. ALTER PUBLICATION ... ADD TABLE is NOT idempotent; we
-- guard with a DO block that catches duplicate_object.

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- already in publication
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- Ensure REPLICA IDENTITY is FULL so realtime emits the full row
-- on UPDATE/DELETE (needed for filtering on user_id_a/b client-side).
ALTER TABLE public.friend_requests REPLICA IDENTITY FULL;
ALTER TABLE public.friendships     REPLICA IDENTITY FULL;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.53 partners + realtime applied.';
  RAISE NOTICE '  ✓ friendships.is_partner column';
  RAISE NOTICE '  ✓ mark_friend_as_partner(uid, bool) RPC';
  RAISE NOTICE '  ✓ Realtime on friend_requests + friendships';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
