-- ═══════════════════════════════════════════════════════════════════
-- Phase 12 — Market Engine + Dynamic Commissions + Transfers + Protection
-- Date: 2026-05-09
-- Idempotent: safe to re-run (uses IF NOT EXISTS / ON CONFLICT DO NOTHING).
--
-- Establishes 13 tables that drive:
--   • The two-phase market engine (initial / permanent / frozen).
--   • Dynamic commission management (8 types, admin-controlled, with
--     paused-until auto-restore).
--   • The weekly-tiered share-transfer system.
--   • Protection telemetry (lineage, trust scores, activity scores).
--   • Railos monthly dividends.
--   • Admin decision log.
--
-- One single migration so a fresh DB gets the full Phase 12 schema in
-- one paste. Functions + triggers live in companion migrations
-- (..._phase12_market_engine_functions.sql and ..._triggers.sql).
-- ═══════════════════════════════════════════════════════════════════

-- 1. Daily engine log
CREATE TABLE IF NOT EXISTS public.market_engine_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  engine_mode TEXT CHECK (engine_mode IN ('initial','permanent','frozen')),
  condition1_score NUMERIC(5,4),
  condition2_hold_score NUMERIC(5,4),
  condition2_balance_score NUMERIC(5,4),
  condition2_score NUMERIC(5,4),
  distinct_pairs_today INTEGER DEFAULT 0,
  total_holders INTEGER,
  trades_count_today INTEGER DEFAULT 0,
  monthly_accumulated NUMERIC(5,4),
  monthly_cap NUMERIC(5,4),
  daily_rise NUMERIC(5,4) DEFAULT 0,
  is_frozen BOOLEAN DEFAULT FALSE,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, date)
);
CREATE INDEX IF NOT EXISTS idx_engine_log_project_date
  ON public.market_engine_log(project_id, date DESC);

-- 2. Engine settings (global by default; per-project override possible)
CREATE TABLE IF NOT EXISTS public.market_engine_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT CHECK (scope IN ('global','project')) DEFAULT 'global',
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  engine_mode TEXT CHECK (engine_mode IN ('initial','permanent')) DEFAULT 'initial',
  initial_rise_per_trade NUMERIC(5,4) DEFAULT 0.006,
  initial_max_trades_per_day INTEGER DEFAULT 5,
  c1_target_pair_ratio NUMERIC(4,3) DEFAULT 0.20,
  c2_target_hold_ratio NUMERIC(4,3) DEFAULT 0.40,
  c1_max_rise NUMERIC(5,4) DEFAULT 0.015,
  c2_max_rise NUMERIC(5,4) DEFAULT 0.015,
  daily_cap NUMERIC(5,4) DEFAULT 0.03,
  free_transfer_max_value NUMERIC(20,2) DEFAULT 5000000,
  min_account_age_days INTEGER DEFAULT 30,
  circular_detection_window_days INTEGER DEFAULT 7,
  mutual_transfer_window_days INTEGER DEFAULT 30,
  mutual_transfer_penalty_days INTEGER DEFAULT 90,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  UNIQUE(scope, project_id)
);

-- Seed: one global default row.
INSERT INTO public.market_engine_settings (scope, engine_mode, notes)
SELECT 'global', 'initial', 'Phase 12 initial seed'
WHERE NOT EXISTS (
  SELECT 1 FROM public.market_engine_settings WHERE scope = 'global' AND project_id IS NULL
);

-- 3. Dynamic commissions (THE core new system)
CREATE TABLE IF NOT EXISTS public.commission_settings (
  commission_type TEXT PRIMARY KEY CHECK (commission_type IN (
    'trade', 'auction', 'quick_sell',
    'contract_creation', 'contract_auction',
    'transfer_first', 'transfer_second', 'transfer_third'
  )),
  display_name_ar TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  current_rate NUMERIC(5,4) NOT NULL,
  default_rate NUMERIC(5,4) NOT NULL,
  paused_until DATE,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by UUID REFERENCES public.profiles(id),
  notes TEXT
);

INSERT INTO public.commission_settings
  (commission_type, display_name_ar, current_rate, default_rate) VALUES
  ('trade',              'التبادل (Buy/Sell)',                       0.02,  0.02),
  ('auction',            'المزاد العادي',                            0.02,  0.02),
  ('quick_sell',         'البيع السريع',                             0.02,  0.02),
  ('contract_creation',  'إنشاء العقد',                              0.002, 0.002),
  ('contract_auction',   'إحالة العقد',                              0.02,  0.02),
  ('transfer_first',     'الإرسال - الفئة 1 (الأول أسبوعياً)',       0.00,  0.00),
  ('transfer_second',    'الإرسال - الفئة 2 (الثاني)',               0.01,  0.01),
  ('transfer_third',     'الإرسال - الفئة 3 (الثالث+)',              0.02,  0.02)
ON CONFLICT (commission_type) DO NOTHING;

-- 4. Sector caps (monthly ceiling per sector)
CREATE TABLE IF NOT EXISTS public.market_sector_caps (
  sector TEXT PRIMARY KEY,
  monthly_cap_percent NUMERIC(5,4) NOT NULL,
  display_name_ar TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by UUID REFERENCES public.profiles(id)
);

INSERT INTO public.market_sector_caps (sector, monthly_cap_percent, display_name_ar) VALUES
  ('agricultural', 0.05, 'زراعي'),
  ('agriculture',  0.05, 'زراعي'),
  ('real_estate',  0.07, 'عقاري'),
  ('industrial',   0.08, 'صناعي'),
  ('commercial',   0.10, 'تجاري'),
  ('medical',      0.10, 'طبي'),
  ('services',     0.10, 'خدمات'),
  ('tech',         0.15, 'تقني')
ON CONFLICT (sector) DO NOTHING;

-- 5. Manual freezes
CREATE TABLE IF NOT EXISTS public.market_manual_freezes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  freeze_reason TEXT NOT NULL,
  freeze_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  freeze_end_date DATE,
  triggered_by_user_id UUID NOT NULL REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_freeze_active
  ON public.market_manual_freezes(project_id) WHERE resolved_at IS NULL;

-- 6. Share transfers (separate table — does NOT use the legacy share_transfers
--    schema from Phase 8 if it exists. We extend with engine fields).
-- Migration-safe: ADD COLUMN IF NOT EXISTS for fields we need on top of any
-- pre-existing share_transfers table.
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.share_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id),
    recipient_id UUID NOT NULL REFERENCES public.profiles(id),
    project_id UUID NOT NULL REFERENCES public.projects(id),
    shares_count INTEGER NOT NULL CHECK (shares_count > 0),
    market_value NUMERIC(20,2) NOT NULL,
    commission_type TEXT NOT NULL,
    commission_rate NUMERIC(5,4) NOT NULL,
    commission_amount NUMERIC(20,2) NOT NULL,
    transfer_number_in_week INTEGER NOT NULL,
    week_start_date DATE NOT NULL,
    is_mutual_pattern_penalty BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending','completed','cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT no_self_transfer CHECK (sender_id <> recipient_id)
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- Defensive backfill for legacy share_transfers tables (Phase 8 schema).
DO $$
BEGIN
  ALTER TABLE public.share_transfers ADD COLUMN IF NOT EXISTS market_value NUMERIC(20,2);
  ALTER TABLE public.share_transfers ADD COLUMN IF NOT EXISTS commission_type TEXT;
  ALTER TABLE public.share_transfers ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4);
  ALTER TABLE public.share_transfers ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(20,2);
  ALTER TABLE public.share_transfers ADD COLUMN IF NOT EXISTS transfer_number_in_week INTEGER;
  ALTER TABLE public.share_transfers ADD COLUMN IF NOT EXISTS week_start_date DATE;
  ALTER TABLE public.share_transfers ADD COLUMN IF NOT EXISTS is_mutual_pattern_penalty BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_transfers_sender_week
  ON public.share_transfers(sender_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_transfers_pair
  ON public.share_transfers(sender_id, recipient_id, created_at DESC);

-- 7. Weekly transfer counter
CREATE TABLE IF NOT EXISTS public.weekly_transfer_counter (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  transfers_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Share lineage (for circular-trade detection)
CREATE TABLE IF NOT EXISTS public.share_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES public.profiles(id),
  to_user_id UUID NOT NULL REFERENCES public.profiles(id),
  shares_count INTEGER NOT NULL,
  source_type TEXT CHECK (source_type IN ('trade','transfer','quick_sell','auction','contract')),
  source_id UUID,
  is_circular BOOLEAN DEFAULT FALSE,
  detected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lineage_project_user
  ON public.share_lineage(project_id, from_user_id, to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lineage_circular
  ON public.share_lineage(project_id, created_at DESC) WHERE is_circular = TRUE;

-- 9. Account trust score
CREATE TABLE IF NOT EXISTS public.account_trust_score (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_age_days INTEGER NOT NULL,
  kyc_complete BOOLEAN DEFAULT FALSE,
  trust_score NUMERIC(4,3) DEFAULT 0,
  has_alerts BOOLEAN DEFAULT FALSE,
  last_computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. User activity scores (per project per month)
CREATE TABLE IF NOT EXISTS public.user_activity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  trade_count INTEGER DEFAULT 0,
  qualified_trades INTEGER DEFAULT 0,
  unique_partners INTEGER DEFAULT 0,
  total_volume NUMERIC(20,2) DEFAULT 0,
  a_i NUMERIC(4,3) DEFAULT 0,
  bai NUMERIC(4,3) DEFAULT 1,
  cluster_penalty NUMERIC(4,3) DEFAULT 0,
  final_score NUMERIC(4,3) DEFAULT 0,
  profit_rate NUMERIC(5,4) DEFAULT 0.02,
  category TEXT CHECK (category IN ('idle','weak','medium','active','professional','elite')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, project_id, month)
);
CREATE INDEX IF NOT EXISTS idx_activity_user_month
  ON public.user_activity_scores(user_id, month DESC);

-- 11. Railos eligibility
CREATE TABLE IF NOT EXISTS public.railos_eligibility_tracking (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  holding_start_date DATE,
  current_streak_days INTEGER DEFAULT 0,
  last_sell_date DATE,
  is_currently_eligible BOOLEAN DEFAULT FALSE,
  last_dividend_received_at TIMESTAMPTZ,
  total_dividends_received NUMERIC(20,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Railos monthly dividends
CREATE TABLE IF NOT EXISTS public.railos_dividend_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  distribution_month DATE NOT NULL,
  eligible_shares INTEGER NOT NULL,
  dividend_amount NUMERIC(20,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, distribution_month)
);

-- 13. Admin market decisions log
CREATE TABLE IF NOT EXISTS public.admin_market_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  decision_type TEXT NOT NULL,
  decision_target TEXT,
  before_state JSONB,
  after_state JSONB,
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_decisions_type_date
  ON public.admin_market_decisions(decision_type, created_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.market_engine_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_engine_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_sector_caps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_manual_freezes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_transfer_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_lineage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_trust_score ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.railos_eligibility_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.railos_dividend_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_market_decisions ENABLE ROW LEVEL SECURITY;

-- Drop & re-create policies (idempotent).
DROP POLICY IF EXISTS "admin_all_engine_log" ON public.market_engine_log;
DROP POLICY IF EXISTS "public_read_engine_log" ON public.market_engine_log;
CREATE POLICY "admin_all_engine_log" ON public.market_engine_log FOR ALL USING (public.is_admin());
CREATE POLICY "public_read_engine_log" ON public.market_engine_log FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "admin_all_settings" ON public.market_engine_settings;
DROP POLICY IF EXISTS "public_read_settings" ON public.market_engine_settings;
CREATE POLICY "admin_all_settings" ON public.market_engine_settings FOR ALL USING (public.is_admin());
CREATE POLICY "public_read_settings" ON public.market_engine_settings FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "admin_all_commissions" ON public.commission_settings;
DROP POLICY IF EXISTS "public_read_commissions" ON public.commission_settings;
CREATE POLICY "admin_all_commissions" ON public.commission_settings FOR ALL USING (public.is_admin());
CREATE POLICY "public_read_commissions" ON public.commission_settings FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "admin_all_caps" ON public.market_sector_caps;
DROP POLICY IF EXISTS "public_read_caps" ON public.market_sector_caps;
CREATE POLICY "admin_all_caps" ON public.market_sector_caps FOR ALL USING (public.is_admin());
CREATE POLICY "public_read_caps" ON public.market_sector_caps FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "admin_all_freezes" ON public.market_manual_freezes;
DROP POLICY IF EXISTS "public_read_freezes" ON public.market_manual_freezes;
CREATE POLICY "admin_all_freezes" ON public.market_manual_freezes FOR ALL USING (public.is_admin());
CREATE POLICY "public_read_freezes" ON public.market_manual_freezes FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "users_see_own_transfers" ON public.share_transfers;
DROP POLICY IF EXISTS "users_create_transfers" ON public.share_transfers;
CREATE POLICY "users_see_own_transfers" ON public.share_transfers
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id OR public.is_admin());
CREATE POLICY "users_create_transfers" ON public.share_transfers
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "users_own_counter" ON public.weekly_transfer_counter;
CREATE POLICY "users_own_counter" ON public.weekly_transfer_counter
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "admin_all_lineage" ON public.share_lineage;
CREATE POLICY "admin_all_lineage" ON public.share_lineage FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "users_own_trust" ON public.account_trust_score;
CREATE POLICY "users_own_trust" ON public.account_trust_score
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "users_own_activity" ON public.user_activity_scores;
CREATE POLICY "users_own_activity" ON public.user_activity_scores
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "users_own_eligibility" ON public.railos_eligibility_tracking;
CREATE POLICY "users_own_eligibility" ON public.railos_eligibility_tracking
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "users_own_dividends" ON public.railos_dividend_distributions;
CREATE POLICY "users_own_dividends" ON public.railos_dividend_distributions
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "admin_all_decisions" ON public.admin_market_decisions;
CREATE POLICY "admin_all_decisions" ON public.admin_market_decisions FOR ALL USING (public.is_admin());

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 12 tables migration applied:';
  RAISE NOTICE '  ✓ 13 tables created (or upgraded if pre-existing)';
  RAISE NOTICE '  ✓ commission_settings seeded with 8 default types';
  RAISE NOTICE '  ✓ market_sector_caps seeded with 6+ sectors';
  RAISE NOTICE '  ✓ market_engine_settings seeded with global default';
  RAISE NOTICE '  ✓ RLS policies configured';
  RAISE NOTICE 'Next: apply ..._market_engine_functions.sql + ..._triggers.sql';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
