-- ═══════════════════════════════════════════════════════════════════
-- notification_preferences  — per-user push/email + per-type toggles
-- Date: 2026-05-02
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Master switches
  push_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,

  -- Per-category toggles (mirror notification_type families)
  deals_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  projects_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  kyc_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  level_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  auctions_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  council_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  support_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  disputes_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  system_enabled    BOOLEAN NOT NULL DEFAULT TRUE,

  -- Quiet hours (Iraqi local time by convention; clients may translate)
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start   TIME    NOT NULL DEFAULT '22:00',
  quiet_hours_end     TIME    NOT NULL DEFAULT '07:00',

  -- Sound + vibration
  sound_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  vibration_enabled BOOLEAN NOT NULL DEFAULT TRUE,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own preferences" ON public.notification_preferences;
CREATE POLICY "Users manage own preferences"
ON public.notification_preferences
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ─── Default-row trigger ─────────────────────────────────────
-- Inserts a row with defaults whenever a new profile is created.
CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_preferences_on_signup ON public.profiles;
CREATE TRIGGER create_preferences_on_signup
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.create_default_notification_preferences();

-- Backfill: insert default rows for existing profiles that don't have one
INSERT INTO public.notification_preferences (user_id)
SELECT p.id
FROM public.profiles p
LEFT JOIN public.notification_preferences np ON np.user_id = p.id
WHERE np.user_id IS NULL;

COMMENT ON TABLE public.notification_preferences IS 'Per-user notification preferences (push/email + 9 categories + quiet hours)';
