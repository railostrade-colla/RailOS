-- ═══════════════════════════════════════════════════════════════
-- Railos Database Schema - Part 1: Users & Authentication
-- ═══════════════════════════════════════════════════════════════

-- تفعيل UUID extension (إذا مش مفعل)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════════════

-- مستوى KYC
CREATE TYPE kyc_status AS ENUM (
  'not_submitted',    -- ما قدم
  'pending',          -- قيد المراجعة
  'approved',         -- موافق
  'rejected'          -- مرفوض
);

-- نوع وثيقة الهوية
CREATE TYPE id_document_type AS ENUM (
  'national_id',      -- بطاقة موحدة / هوية وطنية
  'passport',         -- جواز سفر
  'driver_license'    -- رخصة قيادة
);

-- دور المستخدم
CREATE TYPE user_role AS ENUM (
  'user',             -- مستخدم عادي
  'ambassador',       -- سفير
  'admin',            -- مدير
  'super_admin'       -- مدير عام
);

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 1: profiles - معلومات المستخدم
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.profiles (
  -- المعرف الأساسي (يطابق auth.users)
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- معلومات أساسية
  full_name TEXT,
  username TEXT UNIQUE,
  phone TEXT,
  avatar_url TEXT,

  -- الحالة والدور
  role user_role NOT NULL DEFAULT 'user',
  kyc_status kyc_status NOT NULL DEFAULT 'not_submitted',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  ban_reason TEXT,

  -- إحصائيات
  rating_average DECIMAL(3,2) DEFAULT 0.00 CHECK (rating_average >= 0 AND rating_average <= 5),
  rating_count INTEGER DEFAULT 0,
  trades_completed INTEGER DEFAULT 0,
  total_invested BIGINT DEFAULT 0,  -- بالدينار العراقي

  -- السفير
  is_ambassador BOOLEAN DEFAULT false,
  referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- التوقيتات
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,

  -- قيود
  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]+$')
);

-- فهارس للأداء
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_kyc_status ON public.profiles(kyc_status);
CREATE INDEX idx_profiles_referred_by ON public.profiles(referred_by);

COMMENT ON TABLE public.profiles IS 'ملفات المستخدمين الشخصية - امتداد لـ auth.users';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 2: kyc_submissions - طلبات التحقق
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- المعلومات الشخصية
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT NOT NULL,

  -- الوثائق
  document_type id_document_type NOT NULL,
  document_number TEXT NOT NULL,
  document_front_url TEXT NOT NULL,
  document_back_url TEXT,
  selfie_url TEXT NOT NULL,

  -- الحالة
  status kyc_status NOT NULL DEFAULT 'pending',
  review_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,

  -- التوقيتات
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kyc_user ON public.kyc_submissions(user_id);
CREATE INDEX idx_kyc_status ON public.kyc_submissions(status);
CREATE INDEX idx_kyc_submitted_at ON public.kyc_submissions(submitted_at DESC);

COMMENT ON TABLE public.kyc_submissions IS 'طلبات التحقق من الهوية';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 3: user_preferences - إعدادات المستخدم
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- اللغة
  language TEXT NOT NULL DEFAULT 'ar' CHECK (language IN ('ar', 'en')),

  -- الإشعارات
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,

  -- أنواع محددة
  notify_new_deal BOOLEAN DEFAULT true,
  notify_deal_update BOOLEAN DEFAULT true,
  notify_market_alerts BOOLEAN DEFAULT true,
  notify_ambassador_rewards BOOLEAN DEFAULT true,
  notify_news BOOLEAN DEFAULT true,

  -- الخصوصية
  show_stats_publicly BOOLEAN DEFAULT true,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_preferences IS 'إعدادات المستخدم';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 4: audit_log - سجل الإجراءات
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_action ON public.audit_log(action);
CREATE INDEX idx_audit_created_at ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_entity ON public.audit_log(entity_type, entity_id);

COMMENT ON TABLE public.audit_log IS 'سجل جميع الإجراءات المهمة في النظام';

-- ═══════════════════════════════════════════════════════════════
-- FUNCTION: تحديث updated_at تلقائياً
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers للتحديث التلقائي
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER kyc_submissions_updated_at
  BEFORE UPDATE ON public.kyc_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- FUNCTION: إنشاء profile تلقائياً عند التسجيل
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- إنشاء profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );

  -- إنشاء preferences افتراضية
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

-- Trigger: عند إنشاء مستخدم جديد في auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Policies: profiles
-- الكل يقدر يشوف الـ profiles
CREATE POLICY "Anyone can view profiles"
  ON public.profiles FOR SELECT
  USING (true);

-- المستخدم يعدل profile الخاص به فقط
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policies: kyc_submissions
-- المستخدم يشوف طلباته فقط
CREATE POLICY "Users can view own KYC submissions"
  ON public.kyc_submissions FOR SELECT
  USING (auth.uid() = user_id);

-- المستخدم ينشئ طلبات لنفسه فقط
CREATE POLICY "Users can create own KYC submissions"
  ON public.kyc_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policies: user_preferences
-- المستخدم يشوف ويعدل إعداداته فقط
CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policies: audit_log
-- المستخدم يشوف سجله فقط
CREATE POLICY "Users can view own audit log"
  ON public.audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- انتهى الجزء 1
-- ═══════════════════════════════════════════════════════════════
