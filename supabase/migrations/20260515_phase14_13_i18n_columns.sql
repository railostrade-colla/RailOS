-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.13 PART B7 — bilingual content + appearance prefs columns
-- Date: 2026-05-15
-- Idempotent. Single transaction. ⚠️ REVIEW BEFORE RUNNING.
--
-- 1. *_en columns for user-authored content that needs an English
--    variant (projects / news / discounts). NULL = fall back to the
--    Arabic original in the app layer.
-- 2. user_preferences gains font_size / density / animations so the
--    Phase-14.13 PART-A appearance prefs can sync cross-device
--    (localStorage stays the instant source of truth).
--
-- Safe: ADD COLUMN IF NOT EXISTS only; no data touched, no RLS
-- changed. Table/column names assume the existing public schema —
-- adjust if a target table name differs.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Bilingual content ──────────────────────────────────────────────
-- Real schema: projects(name, description), news(title, content),
-- discount_brands(brand_name, description). There is NO `discounts`
-- table — the discount content lives in `discount_brands`.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS name_en        TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS title_en   TEXT,
  ADD COLUMN IF NOT EXISTS content_en TEXT;

ALTER TABLE public.discount_brands
  ADD COLUMN IF NOT EXISTS brand_name_en  TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

-- 2. Appearance prefs on user_preferences (table added in the
--    20260515_phase14_13_theme_locale migration) ───────────────────
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS font_size  TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS density    TEXT NOT NULL DEFAULT 'comfortable',
  ADD COLUMN IF NOT EXISTS animations BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_preferences_font_size_chk') THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_font_size_chk
      CHECK (font_size IN ('small','medium','large'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_preferences_density_chk') THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_density_chk
      CHECK (density IN ('compact','comfortable'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verification (run after COMMIT — SELECT only):
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='user_preferences'
--   ORDER BY ordinal_position;
-- ═══════════════════════════════════════════════════════════════════
