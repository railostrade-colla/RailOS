-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.06b — Add `engine_enabled` master switch
-- Date: 2026-05-12
-- Idempotent. Single statement (no transaction needed for one INSERT).
--
-- Why a separate migration:
--   Migration 14.06 has already been deployed to production. Founder
--   noticed during seed review that we lacked a single master switch
--   to halt the 3-layer engine entirely from the admin panel. Rather
--   than edit a deployed file, we add the row in a new migration.
--
-- Design:
--   • category   = 'engine_control' (new category, joins the 7 existing
--                  ones for a total of 8 — no CHECK constraint on
--                  category, so no schema change needed)
--   • value_type = 'count' (already in the CHECK list from 14.06)
--   • Value semantics: 1 = engine ON, 0 = engine OFF
--   • min/max = 0/1 so the range validator in update_market_setting
--               doubles as a boolean guard
--   • default = 1 → engine starts ON when the founder resets
--
-- The UI for category='engine_control' will render this knob as a
-- two-state switch (ON / OFF) rather than a free numeric input.
-- That's a Step-3 (UI) concern, not a schema concern.
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO public.market_settings
  (key, value, value_type, category, label_ar, label_en,
   description_ar, min_value, max_value, default_value)
VALUES
  ('engine_enabled',
   1,
   'count',
   'engine_control',
   'حالة المحرك',
   'Engine master switch',
   'مفتاح رئيسي لتشغيل/إيقاف محرك التسعير الديناميكي بالكامل. القيمة 1 = مفعّل، 0 = موقّف.',
   0,
   1,
   1)
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';


DO $$
DECLARE
  v_total      INTEGER;
  v_engine_val NUMERIC;
BEGIN
  SELECT COUNT(*)            INTO v_total      FROM public.market_settings;
  SELECT value                INTO v_engine_val FROM public.market_settings
                                                 WHERE key = 'engine_enabled';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 14.06b — engine_enabled added.';
  RAISE NOTICE '  ✓ Total market_settings rows: %', v_total;
  RAISE NOTICE '  ✓ engine_enabled value: %', v_engine_val;
  RAISE NOTICE '  ✓ Category ''engine_control'' now active';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'NEXT: Step 2 — lib/data/market-settings.ts wrapper';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
