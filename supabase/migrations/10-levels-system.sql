-- ═════════════════════════════════════════════════════════════════
-- Levels System — User levels with stats, disputes, reports tracking
-- شغّل هذا الملف في Supabase SQL Editor عند الإطلاق التجاري.
-- ═════════════════════════════════════════════════════════════════

-- ─────────────────────────────────
-- 1. إعدادات المستويات (قابلة للتعديل من الأدمن)
-- ─────────────────────────────────
DROP TABLE IF EXISTS level_settings CASCADE;

CREATE TABLE level_settings (
  id SERIAL PRIMARY KEY,
  level TEXT UNIQUE NOT NULL,
  display_name_ar TEXT NOT NULL,
  display_name_en TEXT,
  level_order INT NOT NULL,

  -- الشروط الأساسية
  min_volume BIGINT DEFAULT 0,
  min_total_trades INT DEFAULT 0,
  min_successful_trades INT DEFAULT 0,
  min_success_rate NUMERIC(5,2) DEFAULT 0,
  min_days_active INT DEFAULT 0,

  -- شروط النزاعات والبلاغات
  max_disputes_lost INT DEFAULT 999,
  max_reports_received INT DEFAULT 999,
  max_dispute_rate NUMERIC(5,2) DEFAULT 100,

  -- شروط KYC والتقييم
  required_kyc TEXT DEFAULT 'basic',
  min_rating NUMERIC(3,2) DEFAULT 0,

  -- المزايا
  monthly_trade_limit BIGINT DEFAULT 0,
  fee_discount NUMERIC(5,2) DEFAULT 0,
  benefits JSONB DEFAULT '[]'::jsonb,

  -- meta
  color TEXT DEFAULT '#60A5FA',
  icon TEXT DEFAULT '⭐',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID
);

-- البيانات الافتراضية
INSERT INTO level_settings (
  level, display_name_ar, level_order,
  min_volume, min_total_trades, min_successful_trades, min_success_rate, min_days_active,
  max_disputes_lost, max_reports_received, max_dispute_rate,
  required_kyc, min_rating,
  monthly_trade_limit,
  color, icon
) VALUES
  ('basic',    'أساسي',  1,
   0, 0, 0, 0, 0,
   999, 5, 100,
   'basic', 0,
   10000000,
   '#60A5FA', '🌱'),

  ('advanced', 'متقدّم', 2,
   100000000, 50, 45, 90, 30,
   2, 3, 5,
   'advanced', 4.0,
   50000000,
   '#4ADE80', '⚡'),

  ('pro',      'محترف',  3,
   250000000, 200, 190, 95, 90,
   1, 1, 2,
   'pro', 4.5,
   250000000,
   '#C084FC', '💎'),

  ('elite',    'النخبة', 4,
   500000000, 500, 490, 98, 180,
   0, 0, 1,
   'pro', 4.8,
   1000000000,
   '#FBBF24', '👑');


-- ─────────────────────────────────
-- 2. توسعة جدول profiles
-- ─────────────────────────────────
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS total_trade_volume BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_trades INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS successful_trades INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_trades INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancelled_trades INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS disputes_total INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS disputes_won INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS disputes_lost INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS reports_received INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS reports_against_others INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS days_active INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_trade_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_trade_at TIMESTAMPTZ,

-- المستوى والاستثناءات
ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'basic',
ADD COLUMN IF NOT EXISTS level_upgraded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS level_override TEXT,
ADD COLUMN IF NOT EXISTS level_override_reason TEXT,
ADD COLUMN IF NOT EXISTS level_overridden_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS level_overridden_by UUID,
ADD COLUMN IF NOT EXISTS level_locked BOOLEAN DEFAULT FALSE;


-- ─────────────────────────────────
-- 3. سجلّ تاريخ المستوى
-- ─────────────────────────────────
CREATE TABLE IF NOT EXISTS level_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  from_level TEXT,
  to_level TEXT,
  change_type TEXT, -- 'auto_upgrade', 'auto_downgrade', 'admin_override', 'admin_revert'
  reason TEXT,
  changed_by UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_level_history_user ON level_history(user_id);


-- ─────────────────────────────────
-- 4. View شامل للمستخدم
-- ─────────────────────────────────
CREATE OR REPLACE VIEW user_stats_view AS
SELECT
  p.id,
  p.full_name AS display_name,
  p.level,
  p.kyc_status,

  -- التداول
  p.total_trade_volume,
  p.total_trades,
  p.successful_trades,
  p.failed_trades,
  p.cancelled_trades,
  CASE
    WHEN p.total_trades > 0
    THEN ROUND((p.successful_trades::NUMERIC / p.total_trades * 100), 2)
    ELSE 0
  END AS success_rate,

  -- النزاعات
  p.disputes_total,
  p.disputes_won,
  p.disputes_lost,
  CASE
    WHEN p.total_trades > 0
    THEN ROUND((p.disputes_total::NUMERIC / p.total_trades * 100), 2)
    ELSE 0
  END AS dispute_rate,

  -- البلاغات
  p.reports_received,
  p.reports_against_others,

  -- التقييم
  p.rating_average,
  p.rating_count,

  -- الزمن
  p.days_active,
  p.first_trade_at,
  p.last_trade_at,
  EXTRACT(DAY FROM NOW() - p.created_at)::INT AS account_age_days,

  -- المستوى
  p.level_override,
  p.level_overridden_at,
  ls.color AS level_color,
  ls.icon AS level_icon,
  ls.display_name_ar AS level_name_ar,
  ls.monthly_trade_limit,
  ls.fee_discount

FROM profiles p
LEFT JOIN level_settings ls ON ls.level = p.level;


-- ─────────────────────────────────
-- 5. RPC: تحديث إحصائيات المستخدم بعد صفقة
-- ─────────────────────────────────
CREATE OR REPLACE FUNCTION update_user_stats_after_trade(
  p_user_id UUID,
  p_trade_amount BIGINT,
  p_trade_status TEXT
)
RETURNS void AS $$
DECLARE
  v_first_trade TIMESTAMPTZ;
BEGIN
  UPDATE profiles SET
    total_trade_volume = COALESCE(total_trade_volume, 0) + p_trade_amount,
    total_trades = COALESCE(total_trades, 0) + 1,
    successful_trades = CASE WHEN p_trade_status = 'completed' THEN COALESCE(successful_trades, 0) + 1 ELSE COALESCE(successful_trades, 0) END,
    failed_trades = CASE WHEN p_trade_status = 'failed' THEN COALESCE(failed_trades, 0) + 1 ELSE COALESCE(failed_trades, 0) END,
    cancelled_trades = CASE WHEN p_trade_status = 'cancelled' THEN COALESCE(cancelled_trades, 0) + 1 ELSE COALESCE(cancelled_trades, 0) END,
    last_trade_at = NOW(),
    first_trade_at = COALESCE(first_trade_at, NOW())
  WHERE id = p_user_id;

  SELECT first_trade_at INTO v_first_trade FROM profiles WHERE id = p_user_id;
  IF v_first_trade IS NOT NULL THEN
    UPDATE profiles
    SET days_active = EXTRACT(DAY FROM NOW() - v_first_trade)::INT
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────
-- 6. RPC: تحديث إحصائيات النزاعات
-- ─────────────────────────────────
CREATE OR REPLACE FUNCTION update_user_dispute_stats(
  p_user_id UUID,
  p_dispute_result TEXT  -- 'won', 'lost', 'open'
)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET
    disputes_total = COALESCE(disputes_total, 0) + 1,
    disputes_won = CASE WHEN p_dispute_result = 'won' THEN COALESCE(disputes_won, 0) + 1 ELSE COALESCE(disputes_won, 0) END,
    disputes_lost = CASE WHEN p_dispute_result = 'lost' THEN COALESCE(disputes_lost, 0) + 1 ELSE COALESCE(disputes_lost, 0) END
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────
-- 7. RPC: تحديث البلاغات
-- ─────────────────────────────────
CREATE OR REPLACE FUNCTION update_user_report_stats(
  p_reported_user_id UUID,
  p_reporter_user_id UUID
)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET
    reports_received = COALESCE(reports_received, 0) + 1
  WHERE id = p_reported_user_id;

  UPDATE profiles SET
    reports_against_others = COALESCE(reports_against_others, 0) + 1
  WHERE id = p_reporter_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────
-- 8. Trigger: pg_notify عند تغيير الإحصائيات
-- ─────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_level_check()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    NEW.total_trade_volume IS DISTINCT FROM OLD.total_trade_volume OR
    NEW.total_trades       IS DISTINCT FROM OLD.total_trades OR
    NEW.disputes_lost      IS DISTINCT FROM OLD.disputes_lost OR
    NEW.reports_received   IS DISTINCT FROM OLD.reports_received
  ) THEN
    PERFORM pg_notify('level_check', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_level_check ON profiles;
CREATE TRIGGER profiles_level_check
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_level_check();


-- ═════════════════════════════════════════════════════════════════
-- انتهى — جاهز للاستخدام
-- ═════════════════════════════════════════════════════════════════
