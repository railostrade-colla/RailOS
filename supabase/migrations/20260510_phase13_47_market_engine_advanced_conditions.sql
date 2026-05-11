-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.47 — Two new dynamic-price conditions + market-watch advisor
-- Date: 2026-05-10
-- Idempotent.
--
-- Founder spec (verbatim, paraphrased):
--   1. شرط مشاركة المستخدمين: إذا 30% من إجمالي المستخدمين
--      أتمّوا صفقة → 100% تحقّق → يفتح ارتفاع 1.5%.
--      أقل من ذلك → ارتفاع متناسب (مثلاً 50% تحقّق = 0.75%).
--
--   2. شرط توازن العرض/الطلب: إذا قيمة الطلبات المعلّقة بلغت
--      40% من قيمة الحصص المتداولة → 100% تحقّق → يفتح
--      ارتفاع 1.5%. أقل → ارتفاع متناسب.
--
--   3. حقل "مراقبة السوق" يقرأ تقدّم كلا الشرطين ويُولّد نصائح
--      من نوع "السوق بحاجة إلى N صفقات إضافية" / "تحتاج موازنة
--      العرض والطلب" — مرشد استراتيجي.
--
-- This migration:
--   1. Extends market_engine_config with 4 new columns:
--        user_participation_required_pct
--        participation_max_rise_pct
--        supply_demand_balance_target_pct
--        supply_demand_max_rise_pct
--   2. Replaces set_market_engine_state RPC with the 8-arg version.
--   3. Replaces the trigger so combined rise =
--        (participation_progress × participation_max_rise_pct)
--      + (supply_demand_progress × supply_demand_max_rise_pct)
--      Capped to ±daily_pct_cap.
--   4. Adds get_market_watch_advice() RPC returning live progress
--      + advisory messages for the admin panel.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Extend market_engine_config ──────────────────────────────
ALTER TABLE public.market_engine_config
  ADD COLUMN IF NOT EXISTS user_participation_required_pct NUMERIC(5,2)
    NOT NULL DEFAULT 30.00 CHECK (user_participation_required_pct > 0 AND user_participation_required_pct <= 100);

ALTER TABLE public.market_engine_config
  ADD COLUMN IF NOT EXISTS participation_max_rise_pct NUMERIC(5,2)
    NOT NULL DEFAULT 1.50 CHECK (participation_max_rise_pct >= 0 AND participation_max_rise_pct <= 100);

ALTER TABLE public.market_engine_config
  ADD COLUMN IF NOT EXISTS supply_demand_balance_target_pct NUMERIC(5,2)
    NOT NULL DEFAULT 40.00 CHECK (supply_demand_balance_target_pct > 0 AND supply_demand_balance_target_pct <= 200);

ALTER TABLE public.market_engine_config
  ADD COLUMN IF NOT EXISTS supply_demand_max_rise_pct NUMERIC(5,2)
    NOT NULL DEFAULT 1.50 CHECK (supply_demand_max_rise_pct >= 0 AND supply_demand_max_rise_pct <= 100);


-- ─── 2. Replace set_market_engine_state RPC ──────────────────────
-- Drop both possible old signatures so the new one binds cleanly.
DROP FUNCTION IF EXISTS public.set_market_engine_state(BOOLEAN, NUMERIC, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.set_market_engine_state(
  BOOLEAN, NUMERIC, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, NUMERIC
);

CREATE OR REPLACE FUNCTION public.set_market_engine_state(
  p_enabled                          BOOLEAN,
  p_daily_pct_cap                    NUMERIC DEFAULT NULL,
  p_cooldown_minutes                 INTEGER DEFAULT NULL,
  p_min_deals_threshold              INTEGER DEFAULT NULL,
  p_user_participation_required_pct  NUMERIC DEFAULT NULL,
  p_participation_max_rise_pct       NUMERIC DEFAULT NULL,
  p_supply_demand_balance_target_pct NUMERIC DEFAULT NULL,
  p_supply_demand_max_rise_pct       NUMERIC DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  UPDATE public.market_engine_config
     SET enabled                          = COALESCE(p_enabled, enabled),
         daily_pct_cap                    = COALESCE(p_daily_pct_cap, daily_pct_cap),
         cooldown_minutes                 = COALESCE(p_cooldown_minutes, cooldown_minutes),
         min_deals_threshold              = COALESCE(p_min_deals_threshold, min_deals_threshold),
         user_participation_required_pct  = COALESCE(p_user_participation_required_pct, user_participation_required_pct),
         participation_max_rise_pct       = COALESCE(p_participation_max_rise_pct, participation_max_rise_pct),
         supply_demand_balance_target_pct = COALESCE(p_supply_demand_balance_target_pct, supply_demand_balance_target_pct),
         supply_demand_max_rise_pct       = COALESCE(p_supply_demand_max_rise_pct, supply_demand_max_rise_pct),
         updated_at                       = NOW(),
         updated_by                       = v_uid
   WHERE id = 1;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.set_market_engine_state(
  BOOLEAN, NUMERIC, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, NUMERIC
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_market_engine_state(
  BOOLEAN, NUMERIC, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, NUMERIC
) TO authenticated;


-- ─── 3. Helper — compute the two condition progresses ─────────────
-- progress_participation = clamp(distinct_dealing_users / total_users
--                                / required_pct%, 0, 1)
-- progress_supply_demand = clamp(pending_demand_value / traded_value
--                                / target_pct%, 0, 1)
--
-- Window: last 24 hours for "fresh" market activity. The participation
-- condition uses lifetime distinct dealers because cumulative engagement
-- is the founder's intent ("X% of total users completed a deal").
--
-- Returns: jsonb with all the raw numbers + the two progress ratios.

CREATE OR REPLACE FUNCTION public.compute_market_condition_progress()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg                  RECORD;
  v_total_users          INTEGER;
  v_dealing_users        INTEGER;
  v_required_dealers     INTEGER;
  v_traded_value_24h     NUMERIC;
  v_pending_demand_value NUMERIC;
  v_demand_ratio_pct     NUMERIC;
  v_part_progress        NUMERIC;
  v_sd_progress          NUMERIC;
BEGIN
  SELECT * INTO v_cfg FROM public.market_engine_config WHERE id = 1;
  IF v_cfg IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_config');
  END IF;

  -- Total platform users — count active investor accounts.
  SELECT COUNT(*)::INTEGER INTO v_total_users
    FROM public.profiles
   WHERE COALESCE(role, 'user') NOT IN ('admin', 'super_admin');

  IF v_total_users IS NULL OR v_total_users <= 0 THEN
    v_total_users := 0;
  END IF;

  -- Distinct users who completed at least one deal (lifetime).
  SELECT COUNT(DISTINCT user_id)::INTEGER INTO v_dealing_users
    FROM (
      SELECT buyer_id  AS user_id FROM public.deals WHERE status = 'completed'
      UNION
      SELECT seller_id AS user_id FROM public.deals WHERE status = 'completed'
    ) u
   WHERE user_id IS NOT NULL;

  v_dealing_users    := COALESCE(v_dealing_users, 0);
  v_required_dealers := CEIL(v_total_users * v_cfg.user_participation_required_pct / 100.0)::INTEGER;

  -- Traded value (last 24h) — sum of completed deals' total_amount.
  SELECT COALESCE(SUM(total_amount), 0)::NUMERIC INTO v_traded_value_24h
    FROM public.deals
   WHERE status = 'completed'
     AND completed_at >= NOW() - INTERVAL '24 hours';

  -- Pending demand value — sum of total_amount on deals awaiting
  -- completion (pending / submitted). This is the "open buy interest".
  SELECT COALESCE(SUM(total_amount), 0)::NUMERIC INTO v_pending_demand_value
    FROM public.deals
   WHERE status IN ('pending', 'submitted');

  -- Demand-to-supply ratio as a percentage.
  IF v_traded_value_24h > 0 THEN
    v_demand_ratio_pct := (v_pending_demand_value * 100.0) / v_traded_value_24h;
  ELSE
    v_demand_ratio_pct := 0;
  END IF;

  -- Two progress ratios in [0, 1].
  IF v_cfg.user_participation_required_pct > 0 AND v_total_users > 0 THEN
    v_part_progress := LEAST(
      1.0,
      (v_dealing_users * 100.0 / v_total_users) / v_cfg.user_participation_required_pct
    );
  ELSE
    v_part_progress := 0;
  END IF;

  IF v_cfg.supply_demand_balance_target_pct > 0 THEN
    v_sd_progress := LEAST(1.0, v_demand_ratio_pct / v_cfg.supply_demand_balance_target_pct);
  ELSE
    v_sd_progress := 0;
  END IF;

  RETURN jsonb_build_object(
    'success',                  TRUE,
    'total_users',              v_total_users,
    'dealing_users',            v_dealing_users,
    'required_dealers',         v_required_dealers,
    'participation_pct',        ROUND(
      CASE WHEN v_total_users > 0
           THEN v_dealing_users * 100.0 / v_total_users
           ELSE 0 END, 2),
    'participation_target_pct', v_cfg.user_participation_required_pct,
    'participation_progress',   ROUND(v_part_progress, 4),
    'participation_unlock_pct', ROUND(v_part_progress * v_cfg.participation_max_rise_pct, 4),
    'traded_value_24h',         v_traded_value_24h,
    'pending_demand_value',     v_pending_demand_value,
    'demand_ratio_pct',         ROUND(v_demand_ratio_pct, 2),
    'demand_target_pct',        v_cfg.supply_demand_balance_target_pct,
    'supply_demand_progress',   ROUND(v_sd_progress, 4),
    'supply_demand_unlock_pct', ROUND(v_sd_progress * v_cfg.supply_demand_max_rise_pct, 4),
    'combined_unlock_pct',      ROUND(
      v_part_progress * v_cfg.participation_max_rise_pct
      + v_sd_progress * v_cfg.supply_demand_max_rise_pct, 4)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_market_condition_progress() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_market_condition_progress() TO authenticated;


-- ─── 4. get_market_watch_advice — admin-facing advisor RPC ───────
CREATE OR REPLACE FUNCTION public.get_market_watch_advice()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_progress jsonb;
  v_messages jsonb := '[]'::jsonb;
  v_health   TEXT  := 'good';
  v_part_progress NUMERIC;
  v_sd_progress   NUMERIC;
  v_required_dealers INTEGER;
  v_dealing_users    INTEGER;
  v_demand_ratio_pct NUMERIC;
  v_demand_target    NUMERIC;
  v_traded_value_24h NUMERIC;
  v_total_users      INTEGER;
BEGIN
  v_progress := public.compute_market_condition_progress();

  IF NOT (v_progress->>'success')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'success',  FALSE,
      'error',    v_progress->>'error',
      'messages', '[]'::jsonb
    );
  END IF;

  v_part_progress    := (v_progress->>'participation_progress')::NUMERIC;
  v_sd_progress      := (v_progress->>'supply_demand_progress')::NUMERIC;
  v_required_dealers := (v_progress->>'required_dealers')::INTEGER;
  v_dealing_users    := (v_progress->>'dealing_users')::INTEGER;
  v_demand_ratio_pct := (v_progress->>'demand_ratio_pct')::NUMERIC;
  v_demand_target    := (v_progress->>'demand_target_pct')::NUMERIC;
  v_traded_value_24h := (v_progress->>'traded_value_24h')::NUMERIC;
  v_total_users      := (v_progress->>'total_users')::INTEGER;

  -- Participation advice
  IF v_total_users = 0 THEN
    v_messages := v_messages || jsonb_build_array(jsonb_build_object(
      'kind',     'warn',
      'icon',     '👥',
      'title',    'لا يوجد مستخدمون بعد',
      'body',     'سجِّل مستخدمين قبل تقييم نشاط السوق.'
    ));
    v_health := 'warn';
  ELSIF v_part_progress < 1.0 THEN
    v_messages := v_messages || jsonb_build_array(jsonb_build_object(
      'kind',     'info',
      'icon',     '🤝',
      'title',    'مشاركة المستخدمين دون الهدف',
      'body',     format(
        'السوق يحتاج %s مستخدم إضافي للوصول إلى نسبة المشاركة المطلوبة (الحالي %s، المطلوب %s).',
        GREATEST(v_required_dealers - v_dealing_users, 0),
        v_dealing_users,
        v_required_dealers
      )
    ));
    IF v_part_progress < 0.5 THEN v_health := 'warn'; END IF;
  ELSE
    v_messages := v_messages || jsonb_build_array(jsonb_build_object(
      'kind',     'good',
      'icon',     '✅',
      'title',    'مشاركة المستخدمين مكتملة',
      'body',     format(
        'تجاوز عدد المتداولين الحدّ المطلوب (%s من %s). شرط الارتفاع الأول مفتوح بالكامل.',
        v_dealing_users, v_required_dealers
      )
    ));
  END IF;

  -- Supply / demand advice
  IF v_traded_value_24h <= 0 THEN
    v_messages := v_messages || jsonb_build_array(jsonb_build_object(
      'kind',     'warn',
      'icon',     '📉',
      'title',    'لا تداول خلال 24 ساعة',
      'body',     'لا توجد صفقات مكتملة في آخر 24 ساعة — لا يمكن قياس توازن العرض والطلب.'
    ));
    v_health := 'warn';
  ELSIF v_sd_progress < 1.0 THEN
    v_messages := v_messages || jsonb_build_array(jsonb_build_object(
      'kind',     'info',
      'icon',     '⚖️',
      'title',    'العرض والطلب غير متوازنَين',
      'body',     format(
        'قيمة الطلب الحالي %s%% من قيمة التداول، الهدف %s%%. السوق يحتاج طلباً إضافياً لرفع التوازن.',
        TRIM(TRAILING '0' FROM TRIM(TRAILING '.' FROM v_demand_ratio_pct::TEXT)),
        TRIM(TRAILING '0' FROM TRIM(TRAILING '.' FROM v_demand_target::TEXT))
      )
    ));
    IF v_sd_progress < 0.5 THEN v_health := 'warn'; END IF;
  ELSE
    v_messages := v_messages || jsonb_build_array(jsonb_build_object(
      'kind',     'good',
      'icon',     '✅',
      'title',    'توازن العرض والطلب محقَّق',
      'body',     format(
        'الطلب يُمثّل %s%% من قيمة التداول، تجاوز الهدف %s%%.',
        TRIM(TRAILING '0' FROM TRIM(TRAILING '.' FROM v_demand_ratio_pct::TEXT)),
        TRIM(TRAILING '0' FROM TRIM(TRAILING '.' FROM v_demand_target::TEXT))
      )
    ));
  END IF;

  -- Combined verdict
  IF v_part_progress >= 1.0 AND v_sd_progress >= 1.0 THEN
    v_messages := v_messages || jsonb_build_array(jsonb_build_object(
      'kind',     'good',
      'icon',     '🚀',
      'title',    'كلا الشرطين محقَّق — الارتفاع الكامل مفتوح',
      'body',     format(
        'الصفقة التالية ستفتح ارتفاعاً مجمَّعاً قدره %s%% (مع مراعاة السقف اليومي).',
        TRIM(TRAILING '0' FROM TRIM(TRAILING '.' FROM (v_progress->>'combined_unlock_pct')))
      )
    ));
    v_health := 'great';
  END IF;

  RETURN jsonb_build_object(
    'success',  TRUE,
    'health',   v_health,
    'progress', v_progress,
    'messages', v_messages
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_market_watch_advice() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_market_watch_advice() TO authenticated;


-- ─── 5. Replace the trigger — proportional combined rise ─────────
-- The new model:
--   • If the deal price > market price, we ignore it; instead the
--     trigger applies a combined proportional rise:
--       rise = participation_progress × participation_max_rise_pct
--            + supply_demand_progress × supply_demand_max_rise_pct
--   • That rise is capped at ±daily_pct_cap as before.
--   • If the deal price < market price (sell pressure), the old
--     "follow the deal price down" path still applies, capped by
--     daily_pct_cap.
-- Cooldown + min_deals_threshold + enabled flag still gate the trigger.

CREATE OR REPLACE FUNCTION public.trg_update_market_price_on_deal_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg            RECORD;
  v_old_price      BIGINT;
  v_deal_price     BIGINT;
  v_new_price      BIGINT;
  v_pct            NUMERIC;
  v_today_deals    INTEGER;
  v_last_change    TIMESTAMPTZ;
  v_progress       jsonb;
  v_part_progress  NUMERIC;
  v_sd_progress    NUMERIC;
  v_combined_rise  NUMERIC;
BEGIN
  -- Only act when a deal flips into 'completed'.
  IF NEW.status IS DISTINCT FROM 'completed' THEN RETURN NEW; END IF;
  IF OLD.status = 'completed' THEN RETURN NEW; END IF;
  IF NEW.shares IS NULL OR NEW.shares <= 0 THEN RETURN NEW; END IF;
  IF NEW.total_amount IS NULL OR NEW.total_amount <= 0 THEN RETURN NEW; END IF;

  SELECT * INTO v_cfg FROM public.market_engine_config WHERE id = 1;
  IF v_cfg IS NULL OR NOT v_cfg.enabled THEN RETURN NEW; END IF;

  v_deal_price := ROUND(NEW.total_amount::NUMERIC / NEW.shares);

  SELECT COALESCE(current_market_price, share_price, 0) INTO v_old_price
    FROM public.projects WHERE id = NEW.project_id FOR UPDATE;

  IF v_old_price IS NULL OR v_old_price <= 0 THEN
    UPDATE public.projects SET current_market_price = v_deal_price, updated_at = NOW()
     WHERE id = NEW.project_id;
    RETURN NEW;
  END IF;

  -- Cooldown gate.
  IF v_cfg.cooldown_minutes > 0 THEN
    SELECT updated_at INTO v_last_change FROM public.projects WHERE id = NEW.project_id;
    IF v_last_change IS NOT NULL
       AND v_last_change > NOW() - (v_cfg.cooldown_minutes || ' minutes')::INTERVAL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Min deals threshold.
  IF v_cfg.min_deals_threshold > 0 THEN
    SELECT COUNT(*) INTO v_today_deals
      FROM public.deals
     WHERE project_id = NEW.project_id
       AND status = 'completed'
       AND completed_at::DATE = CURRENT_DATE;
    IF COALESCE(v_today_deals, 0) < v_cfg.min_deals_threshold THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Decide direction.
  IF v_deal_price >= v_old_price THEN
    -- UP path — ignore deal price. Use combined proportional rise.
    v_progress := public.compute_market_condition_progress();
    v_part_progress := COALESCE((v_progress->>'participation_progress')::NUMERIC, 0);
    v_sd_progress   := COALESCE((v_progress->>'supply_demand_progress')::NUMERIC, 0);
    v_combined_rise := v_part_progress * v_cfg.participation_max_rise_pct
                     + v_sd_progress   * v_cfg.supply_demand_max_rise_pct;

    -- No conditions met → no rise.
    IF v_combined_rise <= 0 THEN
      RETURN NEW;
    END IF;

    -- Cap at daily_pct_cap.
    IF v_combined_rise > v_cfg.daily_pct_cap THEN
      v_combined_rise := v_cfg.daily_pct_cap;
    END IF;

    v_new_price := ROUND(v_old_price * (1 + v_combined_rise / 100.0));
  ELSE
    -- DOWN path — follow the deal price, capped by daily_pct_cap.
    v_pct := ABS(((v_deal_price - v_old_price) * 100.0) / NULLIF(v_old_price, 0));
    IF v_pct > v_cfg.daily_pct_cap THEN
      v_new_price := ROUND(v_old_price * (1 - v_cfg.daily_pct_cap / 100.0));
    ELSE
      v_new_price := v_deal_price;
    END IF;
  END IF;

  IF v_new_price = v_old_price THEN
    RETURN NEW;
  END IF;

  UPDATE public.projects
     SET current_market_price = v_new_price,
         updated_at = NOW()
   WHERE id = NEW.project_id;

  BEGIN
    INSERT INTO public.price_history(
      project_id, old_price, new_price,
      change_pct, recorded_at, phase, trigger
    ) VALUES (
      NEW.project_id, v_old_price, v_new_price,
      ROUND(((v_new_price - v_old_price) * 100.0) / NULLIF(v_old_price, 1), 2),
      NOW(), 'live', 'deal_completed'
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_market_price_on_deal_complete ON public.deals;

CREATE TRIGGER trg_update_market_price_on_deal_complete
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_update_market_price_on_deal_complete();


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.47 advanced market conditions applied.';
  RAISE NOTICE '  ✓ +4 columns on market_engine_config';
  RAISE NOTICE '  ✓ set_market_engine_state(8 args) replaces old 4-arg';
  RAISE NOTICE '  ✓ compute_market_condition_progress()';
  RAISE NOTICE '  ✓ get_market_watch_advice()';
  RAISE NOTICE '  ✓ Trigger applies combined proportional rise';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
