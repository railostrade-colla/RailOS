-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.06 — Dynamic market-settings registry
-- Date: 2026-05-12
-- Idempotent. Single transaction.
--
-- Founder philosophy: "Zero Hardcoded Values" — every knob the market
-- engine reads must live in `public.market_settings`. Code never bakes
-- a percentage / threshold / hour into a constant; it always asks the
-- registry. This lets the founder tune the engine in real time
-- without a deployment, run A/B experiments by reverting to defaults,
-- and gives investors a transparent audit trail of every change.
--
-- What this migration creates:
--   1. `market_settings`        — the live registry (1 row per knob,
--                                 with metadata: type, category,
--                                 bounds, default, labels)
--   2. `market_settings_audit`  — append-only log of every UPDATE
--                                 (old → new, who, when, why)
--   3. 18 seed rows covering all knobs the new 3-layer engine will
--      need (sector caps, daily caps, yearly cap, manual-rise caps,
--      layer rewards, active-user window, cron hour)
--   4. 5 RPCs: get/get_all/update/reset/audit-log
--
-- Security model:
--   • RLS ENABLED on both tables — direct access blocked entirely.
--   • All reads + writes go through SECURITY DEFINER RPCs.
--   • Mutations (`update_market_setting`, `reset_market_setting`)
--     require `super_admin` role (checked inside the function).
--   • Reads (`get_market_setting`, `get_all_market_settings`) are
--     open to any authenticated user — they expose nothing sensitive
--     and the future engine triggers need to call get_market_setting.
--   • Audit log is super_admin-only (it reveals decision history).
--
-- ⚠ Trade-off note for the founder:
--   `market_settings_audit.changed_by` is NOT NULL with a FK to
--   `auth.users(id)`. This means a super_admin user CANNOT be
--   deleted while they have audit rows — Postgres blocks the DELETE
--   on the FK. This is intentional (audit immutability), but if the
--   founder ever needs to remove a super_admin, the audit rows must
--   be re-pointed first. The alternative (ON DELETE SET NULL +
--   nullable column) was rejected because it loses the actor link.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Tables ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.market_settings (
  key            TEXT PRIMARY KEY,
  value          NUMERIC NOT NULL,
  value_type     TEXT NOT NULL,
  category       TEXT NOT NULL,
  label_ar       TEXT NOT NULL,
  label_en       TEXT,
  description_ar TEXT,
  min_value      NUMERIC NOT NULL,
  max_value      NUMERIC NOT NULL,
  default_value  NUMERIC NOT NULL,
  enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT market_settings_value_in_range
    CHECK (value >= min_value AND value <= max_value),
  CONSTRAINT market_settings_default_in_range
    CHECK (default_value >= min_value AND default_value <= max_value),
  CONSTRAINT market_settings_bounds_ok
    CHECK (min_value <= max_value),
  CONSTRAINT market_settings_value_type_valid
    CHECK (value_type IN ('percent', 'days', 'hour', 'count', 'ratio'))
);

COMMENT ON TABLE public.market_settings IS
  'Dynamic registry of every tunable market-engine knob. All reads/writes via RPCs (RLS deny-all).';
COMMENT ON COLUMN public.market_settings.key IS
  'Stable identifier the code uses to look up the value (e.g. monthly_cap_agricultural).';
COMMENT ON COLUMN public.market_settings.value IS
  'Current live value. Must satisfy [min_value, max_value].';
COMMENT ON COLUMN public.market_settings.value_type IS
  'percent | days | hour | count | ratio — used by the UI to render the right input.';
COMMENT ON COLUMN public.market_settings.category IS
  'Logical grouping for the admin UI (sector_caps, daily_caps, yearly_cap, manual_rise, layers, active_user, cron).';
COMMENT ON COLUMN public.market_settings.default_value IS
  'Founder-blessed default. Reset button restores to this. NEVER mutated.';
COMMENT ON COLUMN public.market_settings.enabled IS
  'Soft-disable a knob without dropping it. Disabled rows are hidden from get_all_market_settings.';

CREATE INDEX IF NOT EXISTS idx_market_settings_category
  ON public.market_settings(category);


CREATE TABLE IF NOT EXISTS public.market_settings_audit (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key  TEXT NOT NULL REFERENCES public.market_settings(key) ON DELETE RESTRICT,
  old_value    NUMERIC NOT NULL,
  new_value    NUMERIC NOT NULL,
  changed_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason       TEXT,
  ip_address   INET,
  user_agent   TEXT
);

COMMENT ON TABLE public.market_settings_audit IS
  'Append-only audit trail. ON DELETE RESTRICT preserves history. Read via get_setting_audit_log.';

CREATE INDEX IF NOT EXISTS idx_market_settings_audit_key
  ON public.market_settings_audit(setting_key);
CREATE INDEX IF NOT EXISTS idx_market_settings_audit_date
  ON public.market_settings_audit(changed_at DESC);


-- ─── 2. Lock down both tables with RLS deny-all ───────────────
-- All access goes through SECURITY DEFINER RPCs. No direct
-- SELECT/INSERT/UPDATE/DELETE from authenticated. This is
-- defense-in-depth: even if an RPC is misconfigured later, a
-- client cannot bypass the audit + role check by hitting the
-- table directly.

ALTER TABLE public.market_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_settings_audit  ENABLE ROW LEVEL SECURITY;

-- No policies created = nothing matches = deny-all for non-owner roles.
-- SECURITY DEFINER functions run as postgres (table owner) and bypass
-- RLS, so they continue to work.


-- ─── 3. Seed default values (idempotent via ON CONFLICT) ──────
-- 18 rows covering every knob the new 3-layer engine needs.

INSERT INTO public.market_settings
  (key, value, value_type, category, label_ar, min_value, max_value, default_value, description_ar)
VALUES
  -- 📊 Monthly caps per sector (6 rows)
  ('monthly_cap_agricultural', 5.0,  'percent', 'sector_caps', 'سقف زراعي شهري',  1,  20, 5.0,
   'السقف الشهري الأعلى للمشاريع الزراعية'),
  ('monthly_cap_real_estate',  7.0,  'percent', 'sector_caps', 'سقف عقاري شهري',  1,  20, 7.0,
   'السقف الشهري الأعلى للمشاريع العقارية'),
  ('monthly_cap_industrial',   8.0,  'percent', 'sector_caps', 'سقف صناعي شهري',  1,  20, 8.0,
   'السقف الشهري الأعلى للمشاريع الصناعية'),
  ('monthly_cap_commercial',  10.0,  'percent', 'sector_caps', 'سقف تجاري شهري',  1,  20, 10.0,
   'السقف الشهري الأعلى للمشاريع التجارية'),
  ('monthly_cap_medical',     10.0,  'percent', 'sector_caps', 'سقف طبي شهري',    1,  20, 10.0,
   'السقف الشهري الأعلى للمشاريع الطبية'),
  ('monthly_cap_technology',  15.0,  'percent', 'sector_caps', 'سقف تقني شهري',   1,  25, 15.0,
   'السقف الشهري الأعلى للمشاريع التقنية'),

  -- ⏱ Daily-cap curve (linear interp from day 1 → day 30)
  ('daily_cap_start',           2.0, 'percent', 'daily_caps',  'السقف اليومي البداية', 0.5,  5, 2.0,
   'السقف اليومي في بداية الشهر (اليوم 1)'),
  ('daily_cap_end',             0.3, 'percent', 'daily_caps',  'السقف اليومي النهاية', 0.1,  2, 0.3,
   'السقف اليومي في نهاية الشهر (اليوم 30)'),

  -- 📅 Yearly cap
  ('yearly_cap',               80.0, 'percent', 'yearly_cap',  'السقف السنوي',         50, 200, 80.0,
   'الحد الأقصى للصعود التراكمي السنوي'),

  -- ✋ Manual-rise caps (separate from engine)
  ('manual_rise_monthly_cap',   5.0, 'percent', 'manual_rise', 'سقف الرفع اليدوي الشهري', 1, 20, 5.0,
   'السقف الشهري للرفع اليدوي (منفصل عن المحرك)'),
  ('manual_rise_daily_cap',     3.0, 'percent', 'manual_rise', 'سقف الرفع اليدوي اليومي', 0.5, 10, 3.0,
   'السقف اليومي للرفع اليدوي'),

  -- 🎯 3-layer engine knobs
  ('layer1_target_pairs_pct',  12.0, 'percent', 'layers', 'نسبة الأزواج الفريدة المستهدفة', 5, 30, 12.0,
   'نسبة الأزواج الفريدة من المستخدمين النشطين المطلوبة لتفعيل الطبقة 1'),
  ('layer1_max_reward',         1.5, 'percent', 'layers', 'مكافأة الطبقة 1 القصوى',       0.5, 5, 1.5,
   'أقصى مكافأة من الطبقة 1 (الأزواج الفريدة)'),
  ('layer2_max_reward',         0.5, 'percent', 'layers', 'مكافأة الطبقة 2 القصوى',       0.1, 3, 0.5,
   'أقصى مكافأة من الطبقة 2 (التوازن)'),
  ('layer3_max_reward',         2.0, 'percent', 'layers', 'مكافأة الطبقة 3 القصوى',       0.5, 5, 2.0,
   'أقصى مكافأة من الطبقة 3 (تجديد المشاركين)'),

  -- 👥 Active-user definition
  ('active_user_days',         30,   'days',    'active_user', 'فترة المستخدم النشط',  7, 90, 30,
   'عدد الأيام بدون نشاط قبل اعتبار المستخدم غير نشط'),

  -- ⏰ Cron job
  ('cron_job_hour',             0,   'hour',    'cron',        'ساعة تشغيل Cron Job',  0, 23, 0,
   'ساعة تشغيل الـ Cron Job اليومي (تنسيق 24 ساعة)')
ON CONFLICT (key) DO NOTHING;
-- DO NOTHING (not UPDATE) so re-runs never overwrite a tuned value.


-- ─── 4. RPCs ───────────────────────────────────────────────────

-- 4.1 get_market_setting — primary accessor for engine code.
-- Returns NULL when disabled or missing, so callers can decide
-- whether to fall back to a default or surface an error.
CREATE OR REPLACE FUNCTION public.get_market_setting(p_key TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value NUMERIC;
BEGIN
  IF p_key IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT value INTO v_value
    FROM public.market_settings
   WHERE key = p_key AND enabled = TRUE;
  RETURN v_value;  -- NULL if missing/disabled — caller decides
END $$;


-- 4.2 get_all_market_settings — admin UI list. Includes is_modified
-- so the UI can show a "•" dot on tuned knobs.
CREATE OR REPLACE FUNCTION public.get_all_market_settings()
RETURNS TABLE (
  key            TEXT,
  value          NUMERIC,
  value_type     TEXT,
  category       TEXT,
  label_ar       TEXT,
  description_ar TEXT,
  min_value      NUMERIC,
  max_value      NUMERIC,
  default_value  NUMERIC,
  updated_at     TIMESTAMPTZ,
  is_modified    BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.key, s.value, s.value_type, s.category,
    s.label_ar, s.description_ar,
    s.min_value, s.max_value, s.default_value,
    s.updated_at,
    (s.value <> s.default_value) AS is_modified
  FROM public.market_settings s
  WHERE s.enabled = TRUE
  ORDER BY s.category, s.key;
END $$;


-- 4.3 update_market_setting — the only write path.
-- Returns a jsonb result with success/error so the UI can show
-- a precise toast. Logs to audit on every real change (and never
-- lets an audit-write failure block the main UPDATE).
CREATE OR REPLACE FUNCTION public.update_market_setting(
  p_key       TEXT,
  p_new_value NUMERIC,
  p_reason    TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_role      TEXT;
  v_old_value NUMERIC;
  v_min       NUMERIC;
  v_max       NUMERIC;
  v_label     TEXT;
  v_enabled   BOOLEAN;
BEGIN
  -- 1. Auth
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  SELECT role::TEXT INTO v_role FROM public.profiles WHERE id = v_uid;
  IF COALESCE(v_role, '') <> 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_super_admin');
  END IF;

  -- 2. Input
  IF p_key IS NULL OR length(p_key) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_key');
  END IF;
  IF p_new_value IS NULL OR NOT (p_new_value = p_new_value) THEN
    -- NOT (x = x) catches NaN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_value');
  END IF;

  -- 3. Load + lock the row
  SELECT value, min_value, max_value, label_ar, enabled
    INTO v_old_value, v_min, v_max, v_label, v_enabled
    FROM public.market_settings
   WHERE key = p_key
   FOR UPDATE;

  IF v_old_value IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'setting_not_found');
  END IF;
  IF NOT v_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'setting_disabled');
  END IF;

  -- 4. Range check
  IF p_new_value < v_min OR p_new_value > v_max THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'value_out_of_range',
      'min',     v_min,
      'max',     v_max
    );
  END IF;

  -- 5. No-op short-circuit
  IF p_new_value = v_old_value THEN
    RETURN jsonb_build_object(
      'success',   true,
      'note',      'no_change',
      'old_value', v_old_value,
      'new_value', p_new_value,
      'label',     v_label
    );
  END IF;

  -- 6. Apply
  UPDATE public.market_settings
     SET value      = p_new_value,
         updated_at = NOW(),
         updated_by = v_uid
   WHERE key = p_key;

  -- 7. Audit (best-effort — never blocks the UPDATE)
  BEGIN
    INSERT INTO public.market_settings_audit
      (setting_key, old_value, new_value, changed_by, reason)
    VALUES (p_key, v_old_value, p_new_value, v_uid, NULLIF(trim(p_reason), ''));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'update_market_setting: audit insert failed for % (%): %',
      p_key, SQLSTATE, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success',   true,
    'old_value', v_old_value,
    'new_value', p_new_value,
    'label',     v_label
  );
END $$;


-- 4.4 reset_market_setting — convenience wrapper around update.
-- Inherits the super_admin check + audit log via the inner call.
CREATE OR REPLACE FUNCTION public.reset_market_setting(p_key TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default NUMERIC;
BEGIN
  SELECT default_value INTO v_default
    FROM public.market_settings
   WHERE key = p_key;
  IF v_default IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'setting_not_found');
  END IF;
  RETURN public.update_market_setting(p_key, v_default, 'استعادة القيمة الافتراضية');
END $$;


-- 4.5 get_setting_audit_log — super-admin-only history view.
-- p_key NULL → all settings, otherwise filtered.
CREATE OR REPLACE FUNCTION public.get_setting_audit_log(
  p_key   TEXT    DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  setting_key     TEXT,
  setting_label   TEXT,
  old_value       NUMERIC,
  new_value       NUMERIC,
  changed_by_name TEXT,
  changed_at      TIMESTAMPTZ,
  reason          TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;  -- silent empty result for unauth
  END IF;
  SELECT role::TEXT INTO v_role FROM public.profiles WHERE id = v_uid;
  IF COALESCE(v_role, '') <> 'super_admin' THEN
    RETURN;  -- silent empty result for non-admin
  END IF;

  RETURN QUERY
  SELECT
    a.setting_key,
    s.label_ar,
    a.old_value,
    a.new_value,
    p.full_name,
    a.changed_at,
    a.reason
  FROM public.market_settings_audit a
  JOIN public.market_settings s ON s.key = a.setting_key
  LEFT JOIN public.profiles    p ON p.id = a.changed_by
  WHERE p_key IS NULL OR a.setting_key = p_key
  ORDER BY a.changed_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 500));
END $$;


-- ─── 5. Grants ─────────────────────────────────────────────────
-- Revoke PUBLIC first so we have a clean baseline, then grant
-- only to authenticated.

REVOKE ALL ON FUNCTION public.get_market_setting(TEXT)                     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_all_market_settings()                    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_market_setting(TEXT, NUMERIC, TEXT)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_market_setting(TEXT)                   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_setting_audit_log(TEXT, INTEGER)         FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_market_setting(TEXT)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_market_settings()                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_market_setting(TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_market_setting(TEXT)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_setting_audit_log(TEXT, INTEGER)      TO authenticated;

-- Tables themselves — no grants. RLS deny-all is enough; only the
-- SECURITY DEFINER RPCs (running as postgres) can touch them.


NOTIFY pgrst, 'reload schema';

COMMIT;


DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.market_settings;
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 14.06 market-settings registry created.';
  RAISE NOTICE '  ✓ market_settings table (% rows seeded)', v_count;
  RAISE NOTICE '  ✓ market_settings_audit table (append-only)';
  RAISE NOTICE '  ✓ RLS deny-all on both tables';
  RAISE NOTICE '  ✓ 5 RPCs created (get / get_all / update / reset / audit)';
  RAISE NOTICE '  ✓ super_admin gate on update + reset + audit_log';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'NEXT: Phase 14.06 step 2 — lib/data/market-settings.ts';
  RAISE NOTICE '      Phase 14.06 step 3 — /admin/market-settings UI';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
