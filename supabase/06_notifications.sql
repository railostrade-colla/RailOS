-- ═══════════════════════════════════════════════════════════════
-- Railos Database Schema - Part 6: Notifications, News & Ads
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════════════

-- نوع الإشعار
CREATE TYPE notification_type AS ENUM (
  -- KYC
  'kyc_approved',
  'kyc_rejected',
  -- الصفقات
  'deal_request_received',        -- طلب شراء جديد (للبائع)
  'deal_accepted',                -- البائع قبل الطلب
  'deal_rejected',                -- البائع رفض الطلب
  'payment_submitted',            -- المشتري رفع إثبات دفع
  'deal_completed',               -- الصفقة اكتملت
  'deal_cancelled',               -- صفقة ملغاة
  'deal_disputed',                -- نزاع على صفقة
  -- السوق
  'new_project',                  -- مشروع جديد
  'project_update',               -- تحديث مشروع
  'new_listing_match',            -- إعلان يطابق اهتمامك
  -- السفير
  'ambassador_approved',          -- وافق الأدمن على طلب السفير
  'ambassador_reward_earned',     -- حصلت على مكافأة سفير
  -- وحدات الرسوم
  'fee_request_approved',         -- تم الموافقة على طلب شحن
  'fee_request_rejected',         -- رُفض طلب الشحن
  'low_balance_warning',          -- تحذير: رصيدك منخفض
  -- اشتراكات
  'subscription_expiring',        -- اشتراكك ينتهي قريباً
  'subscription_expired',         -- انتهى اشتراكك
  -- عام
  'system_announcement',          -- إعلان عام من المنصة
  'news_published'                -- خبر جديد
);

-- أولوية الإشعار
CREATE TYPE notification_priority AS ENUM (
  'low',              -- منخفض (خبر عام)
  'normal',           -- عادي (تحديثات)
  'high',             -- مهم (صفقة، دفع)
  'urgent'            -- عاجل (نزاع، أمان)
);

-- نوع الخبر
CREATE TYPE news_type AS ENUM (
  'announcement',     -- إعلان عام
  'market_update',    -- تحديث سوق
  'project_news',     -- خبر عن مشروع
  'platform_update',  -- تحديث المنصة
  'educational'       -- محتوى تعليمي
);

-- نوع التفاعل
CREATE TYPE reaction_type AS ENUM (
  'like',             -- 👍
  'love',             -- ❤️
  'celebrate',        -- 🎉
  'applause',         -- 👏
  'fire'              -- 🔥
);

-- موقع الإعلان (البانر)
CREATE TYPE ad_placement AS ENUM (
  'home_top',         -- أعلى الصفحة الرئيسية
  'home_middle',      -- وسط الصفحة الرئيسية
  'market_banner',    -- بانر في السوق
  'deals_banner',     -- بانر في الصفقات
  'profile_banner'    -- بانر في الملف الشخصي
);

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 1: notifications - الإشعارات
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- محتوى الإشعار
  notification_type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority notification_priority NOT NULL DEFAULT 'normal',

  -- الرابط (اختياري - للتوجيه عند النقر)
  link_url TEXT,

  -- البيانات الإضافية (مرنة)
  metadata JSONB DEFAULT '{}',

  -- أيقونة مخصصة (اختياري)
  icon_name TEXT,

  -- حالة القراءة
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,

  -- قنوات التوصيل (إذا أُرسل عبر email أو push)
  sent_via_email BOOLEAN NOT NULL DEFAULT false,
  sent_via_push BOOLEAN NOT NULL DEFAULT false,

  -- التوقيتات
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ  -- إشعارات مؤقتة (اختياري)
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_type ON public.notifications(notification_type);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_priority ON public.notifications(priority);

COMMENT ON TABLE public.notifications IS 'إشعارات المستخدمين داخل التطبيق';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 2: news - الأخبار
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.news (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- المحتوى
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  summary TEXT,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  gallery_images TEXT[] DEFAULT '{}',

  -- التصنيف
  news_type news_type NOT NULL,
  tags TEXT[] DEFAULT '{}',

  -- المشروع المرتبط (اختياري)
  related_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,

  -- النشر
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,

  -- الإحصائيات
  views_count INTEGER NOT NULL DEFAULT 0,
  reactions_count INTEGER NOT NULL DEFAULT 0,

  -- المؤلف (الأدمن)
  author_id UUID NOT NULL REFERENCES public.profiles(id),

  -- التوقيتات
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX idx_news_published ON public.news(is_published, published_at DESC);
CREATE INDEX idx_news_type ON public.news(news_type);
CREATE INDEX idx_news_slug ON public.news(slug);
CREATE INDEX idx_news_project ON public.news(related_project_id);
CREATE INDEX idx_news_pinned ON public.news(is_pinned) WHERE is_pinned = true;

COMMENT ON TABLE public.news IS 'الأخبار والتحديثات من إدارة المنصة';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 3: news_reactions - تفاعلات الأخبار
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.news_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  news_id UUID NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type reaction_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- مستخدم واحد = تفاعل واحد فقط لكل خبر
  UNIQUE(news_id, user_id)
);

CREATE INDEX idx_news_reactions_news ON public.news_reactions(news_id);
CREATE INDEX idx_news_reactions_user ON public.news_reactions(user_id);

COMMENT ON TABLE public.news_reactions IS 'تفاعلات المستخدمين مع الأخبار';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 4: ads - الإعلانات الخارجية (بانرات)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- المحتوى
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT NOT NULL,

  -- الموقع في التطبيق
  placement ad_placement NOT NULL,

  -- الترتيب والأولوية (للبانرات المتعددة في نفس المكان)
  display_order INTEGER NOT NULL DEFAULT 0,

  -- الحالة
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- الإحصائيات
  impressions_count INTEGER NOT NULL DEFAULT 0,
  clicks_count INTEGER NOT NULL DEFAULT 0,

  -- التوقيتات
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,

  -- المؤلف (الأدمن)
  created_by UUID NOT NULL REFERENCES public.profiles(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_dates CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX idx_ads_placement ON public.ads(placement);
CREATE INDEX idx_ads_active ON public.ads(is_active, placement) WHERE is_active = true;
CREATE INDEX idx_ads_dates ON public.ads(starts_at, ends_at);

COMMENT ON TABLE public.ads IS 'الإعلانات الخارجية (بانرات) في التطبيق';

-- ═══════════════════════════════════════════════════════════════
-- FUNCTION: تحديث عدد التفاعلات عند إضافة تفاعل
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_news_reactions_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.news
    SET reactions_count = reactions_count + 1
    WHERE id = NEW.news_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.news
    SET reactions_count = GREATEST(reactions_count - 1, 0)
    WHERE id = OLD.news_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_reaction_change
  AFTER INSERT OR DELETE ON public.news_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_news_reactions_count();

-- ═══════════════════════════════════════════════════════════════
-- FUNCTION: تعيين published_at عند نشر الخبر
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_news_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_published = true AND (OLD.is_published IS NULL OR OLD.is_published = false) THEN
    NEW.published_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_news_publish
  BEFORE UPDATE ON public.news
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_news_publish();

-- ═══════════════════════════════════════════════════════════════
-- Triggers للتحديث التلقائي
-- ═══════════════════════════════════════════════════════════════

CREATE TRIGGER news_updated_at
  BEFORE UPDATE ON public.news
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER ads_updated_at
  BEFORE UPDATE ON public.ads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

-- Policies: notifications
-- المستخدم يشوف إشعاراته فقط
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- المستخدم يعدل إشعاراته (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- المستخدم يحذف إشعاراته
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Policies: news
-- الكل يشوف الأخبار المنشورة
CREATE POLICY "Anyone can view published news"
  ON public.news FOR SELECT
  USING (is_published = true);

-- الأدمن ينشئ أخبار
CREATE POLICY "Admins can create news"
  ON public.news FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- الأدمن يعدل الأخبار
CREATE POLICY "Admins can update news"
  ON public.news FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Policies: news_reactions
-- الكل يشوف التفاعلات
CREATE POLICY "Anyone can view reactions"
  ON public.news_reactions FOR SELECT
  USING (true);

-- المستخدم يضيف تفاعل
CREATE POLICY "Users can add reactions"
  ON public.news_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- المستخدم يحذف تفاعله
CREATE POLICY "Users can delete own reactions"
  ON public.news_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Policies: ads
-- الكل يشوف الإعلانات النشطة فقط
CREATE POLICY "Anyone can view active ads"
  ON public.ads FOR SELECT
  USING (
    is_active = true
    AND starts_at <= NOW()
    AND (ends_at IS NULL OR ends_at > NOW())
  );

-- الأدمن ينشئ إعلانات
CREATE POLICY "Admins can create ads"
  ON public.ads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- الأدمن يعدل الإعلانات
CREATE POLICY "Admins can update ads"
  ON public.ads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 🎉 انتهت المرحلة 2 بالكامل - قاعدة البيانات جاهزة!
-- ═══════════════════════════════════════════════════════════════
