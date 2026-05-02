-- ═══════════════════════════════════════════════════════════════════
-- Quick Sale System (نظام البيع السريع)
-- Subscription-gated marketplace with dynamic pricing
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. quick_sale_subscriptions
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quick_sale_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,                -- اختياري: اشتراك سنوي
  fee_paid BIGINT DEFAULT 10000,         -- 10,000 وحدة رسوم
  is_active BOOLEAN DEFAULT TRUE,
  cancelled_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_qs_subs_user ON quick_sale_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_qs_subs_active ON quick_sale_subscriptions(is_active);

-- ─────────────────────────────────────────────────────────────────
-- 2. quick_sale_listings
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quick_sale_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN ('sell', 'buy')),

  -- التسعير الديناميكي
  market_price BIGINT NOT NULL,           -- سعر السوق وقت الإنشاء
  discount_percent NUMERIC(5,2) NOT NULL, -- 15% للبيع، 3-10% للشراء
  final_price BIGINT NOT NULL,            -- السعر النهائي بعد الخصم

  -- الكميات
  total_shares INT NOT NULL,
  available_shares INT NOT NULL,
  is_unlimited BOOLEAN DEFAULT FALSE,

  -- الحالة
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'expired', 'cancelled')),

  -- ملاحظات
  note TEXT,

  -- meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  CONSTRAINT discount_range CHECK (
    (type = 'sell' AND discount_percent = 15) OR
    (type = 'buy' AND discount_percent BETWEEN 3 AND 10)
  )
);

CREATE INDEX IF NOT EXISTS idx_qsl_user ON quick_sale_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_qsl_project ON quick_sale_listings(project_id);
CREATE INDEX IF NOT EXISTS idx_qsl_status ON quick_sale_listings(status);
CREATE INDEX IF NOT EXISTS idx_qsl_type ON quick_sale_listings(type);

-- ─────────────────────────────────────────────────────────────────
-- 3. ALTER deals — quick_sale source + commission split
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'exchange'
    CHECK (source IN ('exchange', 'quick_sale', 'auction', 'admin')),
  ADD COLUMN IF NOT EXISTS quick_sale_listing_id UUID REFERENCES quick_sale_listings(id),
  ADD COLUMN IF NOT EXISTS buyer_commission BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_commission BIGINT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_deals_source ON deals(source);
CREATE INDEX IF NOT EXISTS idx_deals_qs_listing ON deals(quick_sale_listing_id);

-- ─────────────────────────────────────────────────────────────────
-- 4. RLS Policies
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE quick_sale_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_sale_listings ENABLE ROW LEVEL SECURITY;

-- اشتراكات
DROP POLICY IF EXISTS "Users see own subscription" ON quick_sale_subscriptions;
CREATE POLICY "Users see own subscription" ON quick_sale_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own subscription" ON quick_sale_subscriptions;
CREATE POLICY "Users insert own subscription" ON quick_sale_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own subscription" ON quick_sale_subscriptions;
CREATE POLICY "Users update own subscription" ON quick_sale_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- إعلانات: المشتركون النشطون فقط يرونها
DROP POLICY IF EXISTS "Subscribers see all listings" ON quick_sale_listings;
CREATE POLICY "Subscribers see all listings" ON quick_sale_listings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quick_sale_subscriptions
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "Subscribers create listings" ON quick_sale_listings;
CREATE POLICY "Subscribers create listings" ON quick_sale_listings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM quick_sale_subscriptions
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "Owner updates own listing" ON quick_sale_listings;
CREATE POLICY "Owner updates own listing" ON quick_sale_listings
  FOR UPDATE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────
-- 5. RPC: subscribe_to_quick_sale
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION subscribe_to_quick_sale(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_balance BIGINT;
  v_subscription_id UUID;
BEGIN
  -- التحقّق من الرصيد
  SELECT fee_units_balance INTO v_balance
  FROM profiles WHERE id = p_user_id;

  IF v_balance IS NULL OR v_balance < 10000 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'الرصيد غير كافٍ',
      'required', 10000,
      'balance', COALESCE(v_balance, 0)
    );
  END IF;

  -- التحقّق من اشتراك نشط
  IF EXISTS (
    SELECT 1 FROM quick_sale_subscriptions
    WHERE user_id = p_user_id AND is_active = TRUE
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'لديك اشتراك نشط بالفعل'
    );
  END IF;

  -- خصم الرسوم
  UPDATE profiles
  SET fee_units_balance = fee_units_balance - 10000
  WHERE id = p_user_id;

  -- إنشاء (أو إعادة تفعيل) الاشتراك
  INSERT INTO quick_sale_subscriptions (user_id, fee_paid, is_active, subscribed_at)
  VALUES (p_user_id, 10000, TRUE, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET is_active = TRUE,
        subscribed_at = NOW(),
        fee_paid = 10000,
        cancelled_at = NULL
  RETURNING id INTO v_subscription_id;

  -- سجلّ معاملة (إذا الجدول موجود)
  BEGIN
    INSERT INTO fee_unit_transactions (user_id, amount, type, description)
    VALUES (p_user_id, -10000, 'subscription', 'اشتراك البيع السريع');
  EXCEPTION WHEN undefined_table THEN
    -- الجدول غير موجود — تجاهل
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'subscription_id', v_subscription_id,
    'message', 'تم الاشتراك بنجاح'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────
-- 6. updated_at trigger
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION qsl_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS qsl_updated_at ON quick_sale_listings;
CREATE TRIGGER qsl_updated_at
  BEFORE UPDATE ON quick_sale_listings
  FOR EACH ROW
  EXECUTE FUNCTION qsl_set_updated_at();
