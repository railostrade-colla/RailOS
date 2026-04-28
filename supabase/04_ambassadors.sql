-- ═══════════════════════════════════════════════════════════════
-- Railos Database Schema - Part 4: Ambassadors & Referrals
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════════════

-- حالة طلب السفير
CREATE TYPE ambassador_application_status AS ENUM (
  'pending',          -- قيد المراجعة
  'approved',         -- موافق
  'rejected',         -- مرفوض
  'revoked'           -- تم إلغاء حالة السفير
);

-- حالة رابط الإحالة
CREATE TYPE referral_link_status AS ENUM (
  'active',           -- نشط
  'expired',          -- منتهي الصلاحية (بعد شهر)
  'revoked'           -- ملغى يدوياً
);

-- حالة المكافأة
CREATE TYPE reward_status AS ENUM (
  'pending',          -- معلقة
  'granted',          -- تم منحها
  'cancelled'         -- ملغاة (في حالة إلغاء الصفقة مثلاً)
);

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 1: ambassadors - السفراء
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.ambassadors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- حالة السفير
  application_status ambassador_application_status NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT false,

  -- نسبة المكافأة (2% أو أقل - يحددها الأدمن)
  reward_percentage DECIMAL(4,2) NOT NULL DEFAULT 1.00 CHECK (reward_percentage >= 0.5 AND reward_percentage <= 2.00),

  -- تفاصيل التقديم
  application_reason TEXT,
  application_experience TEXT,
  social_media_links JSONB DEFAULT '{}',

  -- الموافقة والإلغاء
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  admin_notes TEXT,

  -- إحصائيات السفير
  total_referrals INTEGER NOT NULL DEFAULT 0,
  successful_referrals INTEGER NOT NULL DEFAULT 0,  -- الذين استثمروا
  total_rewards_earned BIGINT NOT NULL DEFAULT 0,   -- بالأسهم

  -- التوقيتات
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ambassadors_user ON public.ambassadors(user_id);
CREATE INDEX idx_ambassadors_status ON public.ambassadors(application_status);
CREATE INDEX idx_ambassadors_active ON public.ambassadors(is_active) WHERE is_active = true;

COMMENT ON TABLE public.ambassadors IS 'السفراء المعتمدون للمنصة';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 2: referral_links - روابط الإحالة
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.referral_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,

  -- الكود الفريد (مثال: AMB-abc123)
  code TEXT UNIQUE NOT NULL,

  -- وصف اختياري من السفير
  description TEXT,
  campaign_name TEXT,

  -- الحالة والإحصائيات
  status referral_link_status NOT NULL DEFAULT 'active',
  clicks_count INTEGER NOT NULL DEFAULT 0,
  signups_count INTEGER NOT NULL DEFAULT 0,
  conversions_count INTEGER NOT NULL DEFAULT 0,  -- الذين استثمروا

  -- التوقيتات (صلاحية شهر)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  renewed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,

  CONSTRAINT code_format CHECK (code ~ '^[A-Z]{3}-[a-zA-Z0-9]{6,12}$')
);

CREATE INDEX idx_referral_links_ambassador ON public.referral_links(ambassador_id);
CREATE INDEX idx_referral_links_code ON public.referral_links(code);
CREATE INDEX idx_referral_links_active ON public.referral_links(status, expires_at) WHERE status = 'active';

COMMENT ON TABLE public.referral_links IS 'روابط الإحالة الخاصة بالسفراء';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 3: referrals - عمليات الإحالة
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- الأطراف
  ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  referral_link_id UUID NOT NULL REFERENCES public.referral_links(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- تتبع التحويل
  has_invested BOOLEAN NOT NULL DEFAULT false,
  first_investment_deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  first_investment_at TIMESTAMPTZ,
  first_investment_amount BIGINT,  -- بالدينار

  -- معلومات التسجيل
  signup_ip INET,
  signup_user_agent TEXT,

  -- التوقيتات
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- شخص واحد = إحالة واحدة فقط
  UNIQUE(referred_user_id)
);

CREATE INDEX idx_referrals_ambassador ON public.referrals(ambassador_id);
CREATE INDEX idx_referrals_referred_user ON public.referrals(referred_user_id);
CREATE INDEX idx_referrals_link ON public.referrals(referral_link_id);
CREATE INDEX idx_referrals_converted ON public.referrals(has_invested) WHERE has_invested = true;

COMMENT ON TABLE public.referrals IS 'عمليات الإحالة بين السفراء والمستخدمين الجدد';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 4: ambassador_rewards - مكافآت السفراء
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.ambassador_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- الأطراف
  ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- تفاصيل المكافأة
  investment_amount BIGINT NOT NULL CHECK (investment_amount > 0),
  reward_percentage DECIMAL(4,2) NOT NULL,
  reward_shares BIGINT NOT NULL CHECK (reward_shares > 0),

  -- الحالة
  status reward_status NOT NULL DEFAULT 'pending',

  -- ملاحظات
  notes TEXT,

  -- التوقيتات
  granted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- مكافأة واحدة لكل (ambassador, referral) - أول استثمار فقط
  UNIQUE(ambassador_id, referral_id)
);

CREATE INDEX idx_ambassador_rewards_ambassador ON public.ambassador_rewards(ambassador_id);
CREATE INDEX idx_ambassador_rewards_project ON public.ambassador_rewards(project_id);
CREATE INDEX idx_ambassador_rewards_status ON public.ambassador_rewards(status);
CREATE INDEX idx_ambassador_rewards_created_at ON public.ambassador_rewards(created_at DESC);

COMMENT ON TABLE public.ambassador_rewards IS 'مكافآت السفراء على الاستثمارات الأولى للمحالين';

-- ═══════════════════════════════════════════════════════════════
-- FUNCTION: توليد كود فريد لرابط الإحالة
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- توليد كود: AMB-xxxxxxxx (8 أحرف عشوائية)
    new_code := 'AMB-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);

    -- التحقق من عدم التكرار
    SELECT EXISTS(SELECT 1 FROM public.referral_links WHERE code = new_code) INTO code_exists;

    EXIT WHEN NOT code_exists;
  END LOOP;

  RETURN new_code;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- FUNCTION: تحديث حالة السفير عند الموافقة
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_ambassador_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- تحديث is_active وحالة الـ profile
  IF NEW.application_status = 'approved' AND OLD.application_status != 'approved' THEN
    NEW.is_active = true;
    NEW.approved_at = NOW();

    -- تحديث is_ambassador في profile
    UPDATE public.profiles
    SET is_ambassador = true
    WHERE id = NEW.user_id;

  ELSIF NEW.application_status = 'revoked' AND OLD.application_status != 'revoked' THEN
    NEW.is_active = false;
    NEW.revoked_at = NOW();

    -- تحديث is_ambassador في profile
    UPDATE public.profiles
    SET is_ambassador = false
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_ambassador_status_change
  BEFORE UPDATE ON public.ambassadors
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ambassador_status();

-- ═══════════════════════════════════════════════════════════════
-- FUNCTION: زيادة عداد النقرات على الرابط
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.increment_referral_signups()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- زيادة عداد التسجيلات في referral_link
  UPDATE public.referral_links
  SET signups_count = signups_count + 1
  WHERE id = NEW.referral_link_id;

  -- زيادة إجمالي الإحالات في السفير
  UPDATE public.ambassadors
  SET total_referrals = total_referrals + 1
  WHERE id = NEW.ambassador_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_referral_created
  AFTER INSERT ON public.referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_referral_signups();

-- ═══════════════════════════════════════════════════════════════
-- FUNCTION: تحديث الإحصائيات عند تحويل (استثمار) المحال
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_referral_conversion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- عند تحديث has_invested من false إلى true
  IF NEW.has_invested = true AND OLD.has_invested = false THEN
    -- زيادة عداد التحويلات في الرابط
    UPDATE public.referral_links
    SET conversions_count = conversions_count + 1
    WHERE id = NEW.referral_link_id;

    -- زيادة عداد الإحالات الناجحة للسفير
    UPDATE public.ambassadors
    SET successful_referrals = successful_referrals + 1
    WHERE id = NEW.ambassador_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_referral_conversion
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW
  WHEN (NEW.has_invested = true AND OLD.has_invested = false)
  EXECUTE FUNCTION public.handle_referral_conversion();

-- ═══════════════════════════════════════════════════════════════
-- FUNCTION: تحديث إجمالي مكافآت السفير عند منح مكافأة
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_ambassador_total_rewards()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'granted' AND (OLD.status IS NULL OR OLD.status != 'granted') THEN
    UPDATE public.ambassadors
    SET total_rewards_earned = total_rewards_earned + NEW.reward_shares
    WHERE id = NEW.ambassador_id;

    NEW.granted_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_reward_granted
  BEFORE UPDATE ON public.ambassador_rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ambassador_total_rewards();

-- ═══════════════════════════════════════════════════════════════
-- Triggers للتحديث التلقائي
-- ═══════════════════════════════════════════════════════════════

CREATE TRIGGER ambassadors_updated_at
  BEFORE UPDATE ON public.ambassadors
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER referral_links_updated_at
  BEFORE UPDATE ON public.referral_links
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER ambassador_rewards_updated_at
  BEFORE UPDATE ON public.ambassador_rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_rewards ENABLE ROW LEVEL SECURITY;

-- Policies: ambassadors
-- السفير يشوف سجله
CREATE POLICY "Users can view own ambassador record"
  ON public.ambassadors FOR SELECT
  USING (auth.uid() = user_id);

-- المستخدم يقدم طلب سفير
CREATE POLICY "Users can apply to be ambassador"
  ON public.ambassadors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policies: referral_links
-- السفير يشوف روابطه
CREATE POLICY "Ambassadors can view own links"
  ON public.referral_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ambassadors
      WHERE id = ambassador_id AND user_id = auth.uid()
    )
  );

-- السفير ينشئ روابط
CREATE POLICY "Ambassadors can create links"
  ON public.referral_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ambassadors
      WHERE id = ambassador_id
        AND user_id = auth.uid()
        AND is_active = true
    )
  );

-- السفير يعدل روابطه
CREATE POLICY "Ambassadors can update own links"
  ON public.referral_links FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.ambassadors
      WHERE id = ambassador_id AND user_id = auth.uid()
    )
  );

-- Policies: referrals
-- السفير يشوف إحالاته
CREATE POLICY "Ambassadors can view own referrals"
  ON public.referrals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ambassadors
      WHERE id = ambassador_id AND user_id = auth.uid()
    )
  );

-- المحال يشوف إحالته
CREATE POLICY "Referred users can view own referral"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referred_user_id);

-- Policies: ambassador_rewards
-- السفير يشوف مكافآته
CREATE POLICY "Ambassadors can view own rewards"
  ON public.ambassador_rewards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ambassadors
      WHERE id = ambassador_id AND user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- انتهى الجزء 4
-- ═══════════════════════════════════════════════════════════════
