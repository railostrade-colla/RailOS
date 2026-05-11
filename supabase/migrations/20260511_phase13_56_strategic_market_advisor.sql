-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.56 — Strategic Market Advisor RPC
-- Date: 2026-05-11
-- Idempotent.
--
-- Founder spec: a world-class economic advisor for the admin panel
-- that, in one round-trip, produces:
--   • snapshot of every meaningful market metric (users, active
--     users, KYC, deals, traded value, open demand, supply, …)
--   • composite health score 0-100 + Arabic label
--   • machine-readable "unlock conditions" — exactly how much
--     more activity is required for the next price rise
--   • prioritised, actionable advice (critical / high / medium /
--     good) with concrete next steps + expected impact
--
-- The output is rendered by `<StrategicAdvisorCard />` in both the
-- 🩺 صحة السوق strip (Monitor → السوق) and the 🔭 مراقبة السوق card
-- (Monitor → محرّك التسعير → الحركة الديناميكيّة).
--
-- All metrics live-aggregate from real tables; no caching. The RPC
-- is STABLE so PostgREST can dedupe within a single request.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_strategic_market_advisor()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg                    RECORD;

  -- People
  v_total_users            INT;
  v_active_users_24h       INT;
  v_active_users_7d        INT;
  v_active_users_30d       INT;
  v_kyc_approved           INT;
  v_kyc_pending            INT;
  v_kyc_not_submitted      INT;
  v_has_last_seen_at       BOOLEAN;

  -- Deals
  v_dealing_users_lifetime INT;
  v_dealing_users_7d       INT;
  v_deals_total            INT;
  v_deals_24h              INT;
  v_deals_7d               INT;
  v_traded_value_24h       NUMERIC;
  v_traded_value_7d        NUMERIC;
  v_avg_deal_size          NUMERIC;

  -- Demand / supply
  v_open_demand_value      NUMERIC;
  v_open_demand_count      INT;
  v_supply_shares          BIGINT;
  v_supply_value           NUMERIC;

  -- Strategic
  v_health_score           INT := 0;
  v_health_label           TEXT;
  v_advice                 JSONB := '[]'::JSONB;
  v_unlock                 JSONB;

  -- Helpers
  v_required_dealers       INT;
  v_demand_target_value    NUMERIC;
  v_demand_gap_value       NUMERIC;
  v_active_pct             NUMERIC;
  v_participation_pct      NUMERIC;
  v_kyc_rate_pct           NUMERIC;
BEGIN
  -- Engine knobs — may or may not be fully populated; we COALESCE.
  SELECT * INTO v_cfg FROM public.market_engine_config WHERE id = 1;
  IF v_cfg IS NULL THEN
    -- Synthesise sane defaults so the RPC keeps working on a
    -- fresh DB before Phase 13.47 is applied.
    v_cfg := ROW(
      1, TRUE, 10, 0, 0,
      30.00, 1.50, 40.00, 1.50,
      NOW(), NULL
    );
  END IF;

  -- Schema-tolerance: not every DB has `last_seen_at`. Without it
  -- "active users" can't be computed — fall back to 0 instead of
  -- erroring.
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='last_seen_at')
    INTO v_has_last_seen_at;

  -- ─── 1. People ──────────────────────────────────────────────
  SELECT COUNT(*)::INT INTO v_total_users
    FROM public.profiles
   WHERE COALESCE(role::TEXT, 'user') NOT IN ('admin', 'super_admin');

  IF v_has_last_seen_at THEN
    EXECUTE $f$
      SELECT
        COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '24 hours')::INT,
        COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '7 days')::INT,
        COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '30 days')::INT
      FROM public.profiles
      WHERE COALESCE(role::TEXT, 'user') NOT IN ('admin', 'super_admin')
    $f$ INTO v_active_users_24h, v_active_users_7d, v_active_users_30d;
  ELSE
    v_active_users_24h := 0;
    v_active_users_7d := 0;
    v_active_users_30d := 0;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE kyc_status::TEXT = 'approved')::INT,
    COUNT(*) FILTER (WHERE kyc_status::TEXT = 'pending')::INT,
    COUNT(*) FILTER (WHERE kyc_status::TEXT = 'not_submitted')::INT
  INTO v_kyc_approved, v_kyc_pending, v_kyc_not_submitted
  FROM public.profiles
   WHERE COALESCE(role::TEXT, 'user') NOT IN ('admin', 'super_admin');

  -- ─── 2. Deal metrics ────────────────────────────────────────
  SELECT COUNT(*)::INT INTO v_deals_total
    FROM public.deals WHERE status::TEXT = 'completed';

  SELECT COUNT(*)::INT INTO v_deals_24h
    FROM public.deals
   WHERE status::TEXT = 'completed'
     AND completed_at >= NOW() - INTERVAL '24 hours';

  SELECT COUNT(*)::INT INTO v_deals_7d
    FROM public.deals
   WHERE status::TEXT = 'completed'
     AND completed_at >= NOW() - INTERVAL '7 days';

  SELECT COALESCE(SUM(total_amount), 0)::NUMERIC INTO v_traded_value_24h
    FROM public.deals
   WHERE status::TEXT = 'completed'
     AND completed_at >= NOW() - INTERVAL '24 hours';

  SELECT COALESCE(SUM(total_amount), 0)::NUMERIC INTO v_traded_value_7d
    FROM public.deals
   WHERE status::TEXT = 'completed'
     AND completed_at >= NOW() - INTERVAL '7 days';

  IF v_deals_total > 0 THEN
    SELECT COALESCE(AVG(total_amount), 0)::NUMERIC INTO v_avg_deal_size
      FROM public.deals WHERE status::TEXT = 'completed';
  ELSE
    v_avg_deal_size := 0;
  END IF;

  SELECT COUNT(DISTINCT user_id)::INT INTO v_dealing_users_lifetime
    FROM (
      SELECT buyer_id  AS user_id FROM public.deals WHERE status::TEXT = 'completed'
      UNION
      SELECT seller_id AS user_id FROM public.deals WHERE status::TEXT = 'completed'
    ) u
   WHERE user_id IS NOT NULL;

  SELECT COUNT(DISTINCT user_id)::INT INTO v_dealing_users_7d
    FROM (
      SELECT buyer_id  AS user_id FROM public.deals
        WHERE status::TEXT = 'completed' AND completed_at >= NOW() - INTERVAL '7 days'
      UNION
      SELECT seller_id AS user_id FROM public.deals
        WHERE status::TEXT = 'completed' AND completed_at >= NOW() - INTERVAL '7 days'
    ) u
   WHERE user_id IS NOT NULL;

  -- ─── 3. Demand / supply ─────────────────────────────────────
  SELECT
    COUNT(*)::INT,
    COALESCE(SUM(total_amount), 0)::NUMERIC
  INTO v_open_demand_count, v_open_demand_value
  FROM public.deals
   WHERE status::TEXT IN (
     'pending_seller_approval',
     'accepted',
     'payment_submitted',
     'pending_payment'
   );

  BEGIN
    SELECT
      COALESCE(SUM(pw.available_shares), 0)::BIGINT,
      COALESCE(SUM(pw.available_shares * COALESCE(p.current_market_price, p.share_price, 0)), 0)::NUMERIC
    INTO v_supply_shares, v_supply_value
    FROM public.project_wallets pw
    JOIN public.projects p ON p.id = pw.project_id
    WHERE pw.wallet_type::TEXT = 'offering';
  EXCEPTION WHEN OTHERS THEN
    v_supply_shares := 0;
    v_supply_value := 0;
  END;

  -- ─── 4. Health score (0-100) ────────────────────────────────
  -- Composite: 40% participation + 30% supply/demand + 30% daily activity.
  IF v_total_users > 0 AND COALESCE(v_cfg.user_participation_required_pct, 30) > 0 THEN
    v_health_score := v_health_score + LEAST(40,
      ROUND((v_dealing_users_lifetime * 100.0 / v_total_users)
            / NULLIF(v_cfg.user_participation_required_pct, 0) * 40)
    )::INT;
  END IF;

  IF v_traded_value_24h > 0 AND COALESCE(v_cfg.supply_demand_balance_target_pct, 40) > 0 THEN
    v_health_score := v_health_score + LEAST(30,
      ROUND((v_open_demand_value * 100.0 / v_traded_value_24h)
            / NULLIF(v_cfg.supply_demand_balance_target_pct, 0) * 30)
    )::INT;
  END IF;

  IF COALESCE(v_cfg.min_deals_threshold, 0) > 0 THEN
    v_health_score := v_health_score + LEAST(30,
      ROUND(v_deals_24h * 30.0 / v_cfg.min_deals_threshold)
    )::INT;
  ELSIF v_deals_24h > 0 THEN
    v_health_score := v_health_score + LEAST(30, v_deals_24h * 5);
  END IF;

  v_health_score := LEAST(100, GREATEST(0, v_health_score));

  v_health_label := CASE
    WHEN v_health_score >= 75 THEN 'ممتاز'
    WHEN v_health_score >= 50 THEN 'جيّد'
    WHEN v_health_score >= 30 THEN 'متوسّط'
    WHEN v_health_score >= 10 THEN 'متدهور'
    ELSE 'حرج'
  END;

  -- ─── 5. Unlock conditions for next price rise ──────────────
  v_required_dealers    := CEIL(v_total_users * COALESCE(v_cfg.user_participation_required_pct, 30) / 100.0)::INT;
  v_demand_target_value := v_traded_value_24h * COALESCE(v_cfg.supply_demand_balance_target_pct, 40) / 100.0;
  v_demand_gap_value    := GREATEST(0, v_demand_target_value - v_open_demand_value);

  v_unlock := jsonb_build_array(
    jsonb_build_object(
      'key', 'participation',
      'title', 'مشاركة المستخدمين',
      'icon', '🤝',
      'current', v_dealing_users_lifetime,
      'target', v_required_dealers,
      'missing', GREATEST(0, v_required_dealers - v_dealing_users_lifetime),
      'unit', 'متداول',
      'pct_complete', CASE WHEN v_required_dealers > 0
        THEN LEAST(100, ROUND(v_dealing_users_lifetime * 100.0 / v_required_dealers, 1))
        ELSE 100 END,
      'unlock_rise_pct', COALESCE(v_cfg.participation_max_rise_pct, 1.5)
    ),
    jsonb_build_object(
      'key', 'demand',
      'title', 'توازن العرض والطلب',
      'icon', '⚖️',
      'current', ROUND(v_open_demand_value),
      'target', ROUND(v_demand_target_value),
      'missing', ROUND(v_demand_gap_value),
      'unit', 'IQD طلب',
      'pct_complete', CASE WHEN v_demand_target_value > 0
        THEN LEAST(100, ROUND(v_open_demand_value * 100.0 / v_demand_target_value, 1))
        ELSE 0 END,
      'unlock_rise_pct', COALESCE(v_cfg.supply_demand_max_rise_pct, 1.5)
    ),
    jsonb_build_object(
      'key', 'min_deals',
      'title', 'الحدّ الأدنى للصفقات اليوميّة',
      'icon', '📊',
      'current', v_deals_24h,
      'target', COALESCE(v_cfg.min_deals_threshold, 0),
      'missing', GREATEST(0, COALESCE(v_cfg.min_deals_threshold, 0) - v_deals_24h),
      'unit', 'صفقة',
      'pct_complete', CASE WHEN COALESCE(v_cfg.min_deals_threshold, 0) > 0
        THEN LEAST(100, ROUND(v_deals_24h * 100.0 / v_cfg.min_deals_threshold, 1))
        ELSE 100 END,
      'unlock_rise_pct', NULL
    )
  );

  -- ─── 6. Prioritised strategic advice ───────────────────────
  v_active_pct        := CASE WHEN v_total_users > 0 THEN v_active_users_7d * 100.0 / v_total_users ELSE 0 END;
  v_participation_pct := CASE WHEN v_total_users > 0 THEN v_dealing_users_lifetime * 100.0 / v_total_users ELSE 0 END;
  v_kyc_rate_pct      := CASE WHEN v_total_users > 0 THEN v_kyc_approved * 100.0 / v_total_users ELSE 0 END;

  -- 🛑 Critical — zero users on the platform
  IF v_total_users = 0 THEN
    v_advice := v_advice || jsonb_build_array(jsonb_build_object(
      'priority', 'critical', 'category', 'growth', 'icon', '🌱',
      'title', 'لا يوجد مستخدمون مسجَّلون بعد',
      'body', 'المنصّة فارغة. ابدأ بحملة تسجيل + مشاركة الرابط مع شبكتك.',
      'action', 'افتح التسجيل العام، انشر إعلان "أوّل 100 مستخدم بمكافأة"، شارك في مجموعات WhatsApp/Telegram.',
      'expected_impact', 'بناء قاعدة مستخدمين قابلة للتداول'
    ));
  END IF;

  -- 🛑 Critical — zero deals in 24h
  IF v_deals_24h = 0 AND v_total_users > 0 THEN
    v_advice := v_advice || jsonb_build_array(jsonb_build_object(
      'priority', 'critical', 'category', 'liquidity', 'icon', '🛑',
      'title', 'لا توجد صفقات خلال 24 ساعة',
      'body', format('السوق ساكن. لديك %s مستخدم لكن لا تداول.', v_total_users),
      'action', 'حدّث مشروعاً موجوداً (سعر، صور، أخبار)، أو أطلق مشروعاً جديداً جذّاباً، أو أرسل push يوم الاستثمار.',
      'expected_impact', 'تفعيل التداول الأساسي + رفع نقاط الصحة فوراً'
    ));
  END IF;

  -- 🛑 Critical — very low participation (<10%)
  IF v_total_users > 0 AND v_participation_pct < 10 THEN
    v_advice := v_advice || jsonb_build_array(jsonb_build_object(
      'priority', 'critical', 'category', 'participation', 'icon', '👥',
      'title', 'نسبة المشاركة أقلّ من 10%',
      'body', format('فقط %s من %s مستخدم أتمّوا صفقة (%s%%). الهدف: %s مستخدم.',
        v_dealing_users_lifetime, v_total_users, ROUND(v_participation_pct, 1), v_required_dealers),
      'action', format('تحتاج %s مستخدم إضافي لإتمام أوّل صفقة. قدّم حوافز: هدية رسوم مجانيّة عند الصفقة الأولى.',
        GREATEST(0, v_required_dealers - v_dealing_users_lifetime)),
      'expected_impact', format('فتح ارتفاع %s%% تلقائياً عند بلوغ الحدّ.', COALESCE(v_cfg.participation_max_rise_pct, 1.5))
    ));
  END IF;

  -- ⚠ High — demand below half target
  IF v_traded_value_24h > 0 AND v_open_demand_value < v_demand_target_value * 0.5 AND v_demand_target_value > 0 THEN
    v_advice := v_advice || jsonb_build_array(jsonb_build_object(
      'priority', 'high', 'category', 'liquidity', 'icon', '⚖️',
      'title', 'الطلب أقلّ من نصف الهدف',
      'body', format('قيمة الطلبات المعلّقة %s IQD، الهدف %s IQD.',
        ROUND(v_open_demand_value), ROUND(v_demand_target_value)),
      'action', format('شجّع المستخدمين على فتح طلبات شراء بقيمة إضافيّة %s IQD. روّج لأفضل المشاريع.',
        ROUND(v_demand_gap_value)),
      'expected_impact', format('فتح ارتفاع %s%% (تراكمي مع شرط المشاركة).',
        COALESCE(v_cfg.supply_demand_max_rise_pct, 1.5))
    ));
  END IF;

  -- ⚠ High — engagement low (<30% active in 7d)
  IF v_total_users > 0 AND v_active_users_7d * 100.0 / v_total_users < 30 AND v_has_last_seen_at THEN
    v_advice := v_advice || jsonb_build_array(jsonb_build_object(
      'priority', 'high', 'category', 'engagement', 'icon', '😴',
      'title', 'التفاعل اليومي منخفض',
      'body', format('فقط %s من %s نشطون خلال 7 أيام (%s%%).',
        v_active_users_7d, v_total_users, ROUND(v_active_pct, 1)),
      'action', 'أرسل إشعار push بفرص جديدة. حدّث صفحة الاكتشاف. أطلق "نشرة الأسبوع".',
      'expected_impact', 'زيادة الزيارات اليوميّة + معدّل تحويلها لصفقات'
    ));
  END IF;

  -- ⚠ Medium — KYC rate <30%
  IF v_total_users > 0 AND v_kyc_rate_pct < 30 THEN
    v_advice := v_advice || jsonb_build_array(jsonb_build_object(
      'priority', 'medium', 'category', 'compliance', 'icon', '🪪',
      'title', 'نسبة التوثيق KYC منخفضة',
      'body', format('%s/%s موثّق (%s%%). غير موثّقين = حدود تداول أقلّ.',
        v_kyc_approved, v_total_users, ROUND(v_kyc_rate_pct, 1)),
      'action', 'حفّز المستخدمين على إتمام التوثيق (هدية رسوم عند الإكمال). ذكّرهم برسالة دوريّة.',
      'expected_impact', 'فتح حدود استثمار أكبر + زيادة الصفقات الكبيرة'
    ));
  END IF;

  -- ⚠ Medium — demand > 2x supply (price-pump risk)
  IF v_supply_value > 0 AND v_open_demand_value > v_supply_value * 2 THEN
    v_advice := v_advice || jsonb_build_array(jsonb_build_object(
      'priority', 'medium', 'category', 'stability', 'icon', '🚧',
      'title', 'الطلب يتجاوز العرض المتاح',
      'body', format('قيمة الطلب %s IQD، قيمة العرض %s IQD (نسبة %sx).',
        ROUND(v_open_demand_value), ROUND(v_supply_value),
        ROUND(v_open_demand_value / NULLIF(v_supply_value, 0), 1)),
      'action', 'أطلق مشاريع جديدة أو وسّع عرض المشاريع الحاليّة (offering_shares).',
      'expected_impact', 'منع ضغط شراء يدفع السعر بشكل غير صحّي + توسيع قاعدة الاستثمار'
    ));
  END IF;

  -- 🟢 Good — everything aligned (health ≥ 75)
  IF v_health_score >= 75 THEN
    v_advice := v_advice || jsonb_build_array(jsonb_build_object(
      'priority', 'good', 'category', 'growth', 'icon', '🚀',
      'title', 'السوق في حالة ممتازة',
      'body', format('نقاط الصحة %s/100. كلّ المؤشّرات قويّة.', v_health_score),
      'action', 'فكّر برفع السقف اليومي قليلاً للسماح بنمو سعريّ أكبر. راقب التذبذب أسبوعياً.',
      'expected_impact', 'زيادة أرباح المستثمرين دون مخاطرة على استقرار المنصّة'
    ));
  END IF;

  -- ─── 7. Compose response ───────────────────────────────────
  RETURN jsonb_build_object(
    'success', TRUE,
    'generated_at', NOW(),
    'health_score', v_health_score,
    'health_label', v_health_label,
    'snapshot', jsonb_build_object(
      'total_users',             v_total_users,
      'active_users_24h',        v_active_users_24h,
      'active_users_7d',         v_active_users_7d,
      'active_users_30d',        v_active_users_30d,
      'kyc_approved',            v_kyc_approved,
      'kyc_pending',             v_kyc_pending,
      'kyc_not_submitted',       v_kyc_not_submitted,
      'dealing_users_lifetime',  v_dealing_users_lifetime,
      'dealing_users_7d',        v_dealing_users_7d,
      'deals_total',             v_deals_total,
      'deals_24h',               v_deals_24h,
      'deals_7d',                v_deals_7d,
      'traded_value_24h',        v_traded_value_24h,
      'traded_value_7d',         v_traded_value_7d,
      'avg_deal_size',           ROUND(v_avg_deal_size),
      'open_demand_count',       v_open_demand_count,
      'open_demand_value',       v_open_demand_value,
      'supply_shares',           v_supply_shares,
      'supply_value',            v_supply_value
    ),
    'unlock_conditions', v_unlock,
    'advice',            v_advice
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_strategic_market_advisor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_strategic_market_advisor() TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.56 strategic market advisor applied.';
  RAISE NOTICE '  ✓ get_strategic_market_advisor() → snapshot +';
  RAISE NOTICE '    health score + unlock conditions + advice';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
