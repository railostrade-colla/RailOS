-- ═══════════════════════════════════════════════════════════════════
-- Phase 12.8 — user presence (heartbeat + read)
-- Date: 2026-05-09
-- Idempotent.
--
-- Two RPCs:
--   1. touch_my_last_seen() — called every 30s by every authenticated
--      client to bump profiles.last_seen_at.
--   2. get_user_presence(user_id) — returns the user's last_seen_at +
--      a derived is_online flag (true when last_seen within 90 s).
--      Used by the deal page + the global request popup to render a
--      green dot or "آخر اتصال منذ X" next to a counter-party's name.
--
-- last_seen_at is already a column on profiles (Phase 1). No schema
-- change needed.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Heartbeat ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_my_last_seen()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.profiles
  SET last_seen_at = NOW()
  WHERE id = v_uid;
EXCEPTION WHEN OTHERS THEN
  -- never let a heartbeat failure surface to the client
  NULL;
END $$;

REVOKE ALL ON FUNCTION public.touch_my_last_seen() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_my_last_seen() TO authenticated;


-- ─── 2. Read presence for any user ──────────────────────────────
-- Returns { last_seen_at, is_online, seconds_ago } as a JSONB blob.
-- We expose this for any authenticated caller because the data is
-- already mostly-public (most apps show it next to messages).
CREATE OR REPLACE FUNCTION public.get_user_presence(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_last TIMESTAMPTZ;
  v_seconds BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'last_seen_at', NULL,
      'is_online', FALSE,
      'seconds_ago', NULL
    );
  END IF;

  SELECT last_seen_at INTO v_last
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_last IS NULL THEN
    RETURN jsonb_build_object(
      'last_seen_at', NULL,
      'is_online', FALSE,
      'seconds_ago', NULL
    );
  END IF;

  v_seconds := EXTRACT(EPOCH FROM (NOW() - v_last))::BIGINT;

  RETURN jsonb_build_object(
    'last_seen_at', v_last,
    'is_online',    v_seconds < 90,
    'seconds_ago',  v_seconds
  );
END $$;

REVOKE ALL ON FUNCTION public.get_user_presence(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_presence(UUID) TO authenticated;


-- ─── 3. Batch read presence for many users ─────────────────────
-- The deal page asks for the counter-party's presence; if we ever
-- want to render a chat list with N users we can use this without
-- N round-trips.
CREATE OR REPLACE FUNCTION public.get_users_presence(p_user_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result JSONB := '{}'::jsonb;
  v_row RECORD;
BEGIN
  IF v_uid IS NULL OR p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN v_result;
  END IF;

  FOR v_row IN
    SELECT
      p.id,
      p.last_seen_at,
      EXTRACT(EPOCH FROM (NOW() - p.last_seen_at))::BIGINT AS seconds_ago
    FROM public.profiles p
    WHERE p.id = ANY(p_user_ids)
  LOOP
    v_result := v_result || jsonb_build_object(
      v_row.id::text,
      jsonb_build_object(
        'last_seen_at', v_row.last_seen_at,
        'is_online',    COALESCE(v_row.seconds_ago < 90, FALSE),
        'seconds_ago',  v_row.seconds_ago
      )
    );
  END LOOP;

  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.get_users_presence(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_users_presence(UUID[]) TO authenticated;


DO $$ BEGIN
  RAISE NOTICE '✅ Phase 12.8 presence: heartbeat + read RPCs ready';
END $$;
