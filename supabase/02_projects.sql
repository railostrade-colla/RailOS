-- ═══════════════════════════════════════════════════════════════
-- Railos Database Schema - Part 2: Projects, Wallets & Holdings
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════════════

-- نوع المشروع
CREATE TYPE project_type AS ENUM (
  'real_estate',      -- عقاري
  'agriculture',      -- زراعي
  'industrial',       -- صناعي
  'commercial',       -- تجاري
  'tech',             -- تقني
  'other'             -- أخرى
);

-- حالة المشروع
CREATE TYPE project_status AS ENUM (
  'draft',            -- مسودة (قيد الإعداد من الأدمن)
  'coming_soon',      -- قريباً (معلن قبل الطرح)
  'active',           -- نشط (متاح للشراء)
  'sold_out',         -- مكتمل البيع
  'completed',        -- مشروع منتهٍ
  'cancelled'         -- ملغى
);

-- نوع المحفظة
CREATE TYPE wallet_type AS ENUM (
  'offering',         -- محفظة الطرح (للبيع الأولي)
  'ambassador',       -- محفظة السفير (مكافآت 2%)
  'reserve'           -- محفظة الاحتياطي (إدارة المشروع)
);

-- حالة الإعلان في السوق الثانوي
CREATE TYPE listing_status AS ENUM (
  'active',           -- نشط (قابل للشراء)
  'sold',             -- تم البيع
  'cancelled',        -- أُلغي من البائع
  'frozen'            -- مُجمد (في صفقة قيد التنفيذ)
);

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 1: projects - المشاريع
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- المعلومات الأساسية
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  short_description TEXT,
  project_type project_type NOT NULL,

  -- الصور
  cover_image_url TEXT,
  gallery_images TEXT[] DEFAULT '{}',

  -- الموقع
  location_address TEXT,
  location_city TEXT,
  location_coords POINT,

  -- الأسهم والتسعير (بالدينار العراقي)
  total_shares BIGINT NOT NULL CHECK (total_shares > 0),
  share_price BIGINT NOT NULL CHECK (share_price > 0),
  total_value BIGINT GENERATED ALWAYS AS (total_shares * share_price) STORED,

  -- توزيع المحافظ (نسب)
  offering_percentage DECIMAL(5,2) NOT NULL DEFAULT 90.00 CHECK (offering_percentage > 0 AND offering_percentage <= 100),
  ambassador_percentage DECIMAL(5,2) NOT NULL DEFAULT 2.00 CHECK (ambassador_percentage >= 0 AND ambassador_percentage <= 10),
  reserve_percentage DECIMAL(5,2) NOT NULL DEFAULT 8.00 CHECK (reserve_percentage >= 0 AND reserve_percentage <= 100),

  -- حد السوق الثانوي (كسعر أقصى لإعادة البيع)
  current_market_price BIGINT,

  -- الحالة
  status project_status NOT NULL DEFAULT 'draft',

  -- التوقيتات
  offering_start_date TIMESTAMPTZ,
  offering_end_date TIMESTAMPTZ,
  expected_completion_date DATE,

  -- الأدمن
  created_by UUID NOT NULL REFERENCES public.profiles(id),

  -- التوقيتات النظامية
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,

  -- قيود
  CONSTRAINT valid_percentages CHECK (offering_percentage + ambassador_percentage + reserve_percentage = 100),
  CONSTRAINT valid_offering_dates CHECK (offering_end_date IS NULL OR offering_start_date IS NULL OR offering_end_date > offering_start_date),
  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

-- فهارس
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_type ON public.projects(project_type);
CREATE INDEX idx_projects_slug ON public.projects(slug);
CREATE INDEX idx_projects_created_by ON public.projects(created_by);
CREATE INDEX idx_projects_offering_dates ON public.projects(offering_start_date, offering_end_date);

COMMENT ON TABLE public.projects IS 'المشاريع الاستثمارية';
COMMENT ON COLUMN public.projects.offering_percentage IS 'نسبة محفظة الطرح (للبيع الأولي)';
COMMENT ON COLUMN public.projects.ambassador_percentage IS 'نسبة محفظة السفير (مكافآت)';
COMMENT ON COLUMN public.projects.reserve_percentage IS 'نسبة محفظة الاحتياطي';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 2: project_wallets - المحافظ الثلاث لكل مشروع
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.project_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- نوع المحفظة
  wallet_type wallet_type NOT NULL,

  -- الأسهم
  total_shares BIGINT NOT NULL CHECK (total_shares >= 0),
  available_shares BIGINT NOT NULL CHECK (available_shares >= 0),
  reserved_shares BIGINT NOT NULL DEFAULT 0 CHECK (reserved_shares >= 0),
  sold_shares BIGINT NOT NULL DEFAULT 0 CHECK (sold_shares >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ضمان وجود محفظة واحدة فقط من كل نوع لكل مشروع
  UNIQUE(project_id, wallet_type),

  -- ضمان التناسق الحسابي
  CONSTRAINT shares_balance CHECK (available_shares + reserved_shares + sold_shares = total_shares)
);

CREATE INDEX idx_project_wallets_project ON public.project_wallets(project_id);
CREATE INDEX idx_project_wallets_type ON public.project_wallets(wallet_type);

COMMENT ON TABLE public.project_wallets IS 'المحافظ الثلاث لكل مشروع: طرح، سفير، احتياطي';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 3: holdings - ملكيات المستخدمين
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- المالك والمشروع
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- الأسهم
  shares BIGINT NOT NULL CHECK (shares >= 0),
  frozen_shares BIGINT NOT NULL DEFAULT 0 CHECK (frozen_shares >= 0),

  -- معلومات الشراء (متوسط)
  average_buy_price BIGINT NOT NULL CHECK (average_buy_price >= 0),
  total_invested BIGINT NOT NULL CHECK (total_invested >= 0),

  -- مصدر الحصص
  acquired_from_offering BIGINT NOT NULL DEFAULT 0,
  acquired_from_ambassador BIGINT NOT NULL DEFAULT 0,
  acquired_from_secondary BIGINT NOT NULL DEFAULT 0,

  -- التوقيتات
  first_acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- مستخدم واحد = سجل ملكية واحد لكل مشروع
  UNIQUE(user_id, project_id),

  -- الأسهم المجمدة لا تتجاوز المملوكة
  CONSTRAINT frozen_not_exceed CHECK (frozen_shares <= shares)
);

CREATE INDEX idx_holdings_user ON public.holdings(user_id);
CREATE INDEX idx_holdings_project ON public.holdings(project_id);
CREATE INDEX idx_holdings_user_project ON public.holdings(user_id, project_id);

COMMENT ON TABLE public.holdings IS 'ملكيات المستخدمين في كل مشروع';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 4: listings - إعلانات البيع في السوق الثانوي
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- البائع والمشروع
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- تفاصيل الإعلان
  shares_offered BIGINT NOT NULL CHECK (shares_offered > 0),
  shares_sold BIGINT NOT NULL DEFAULT 0 CHECK (shares_sold >= 0),
  price_per_share BIGINT NOT NULL CHECK (price_per_share > 0),

  -- الوصف الاختياري
  notes TEXT,
  is_quick_sell BOOLEAN NOT NULL DEFAULT false,

  -- الحالة
  status listing_status NOT NULL DEFAULT 'active',

  -- التوقيتات
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,

  -- المشتري (إذا تم البيع)
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- قيود
  CONSTRAINT shares_sold_not_exceed CHECK (shares_sold <= shares_offered),
  CONSTRAINT buyer_set_if_sold CHECK (
    (status = 'sold' AND buyer_id IS NOT NULL) OR
    (status != 'sold')
  )
);

CREATE INDEX idx_listings_seller ON public.listings(seller_id);
CREATE INDEX idx_listings_project ON public.listings(project_id);
CREATE INDEX idx_listings_status ON public.listings(status);
CREATE INDEX idx_listings_quick_sell ON public.listings(is_quick_sell) WHERE is_quick_sell = true;
CREATE INDEX idx_listings_active ON public.listings(project_id, status) WHERE status = 'active';

COMMENT ON TABLE public.listings IS 'إعلانات بيع الحصص في السوق الثانوي';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 5: project_updates - تحديثات المشاريع
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.project_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- المحتوى
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',

  -- نسبة الإنجاز
  progress_percentage INTEGER CHECK (progress_percentage >= 0 AND progress_percentage <= 100),

  -- التوقيتات
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_updates_project ON public.project_updates(project_id);
CREATE INDEX idx_project_updates_created_at ON public.project_updates(created_at DESC);

COMMENT ON TABLE public.project_updates IS 'تحديثات دورية عن المشاريع';

-- ═══════════════════════════════════════════════════════════════
-- FUNCTION: إنشاء المحافظ الثلاث تلقائياً عند إنشاء مشروع
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_project_wallets()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  offering_shares BIGINT;
  ambassador_shares BIGINT;
  reserve_shares BIGINT;
BEGIN
  -- حساب الأسهم لكل محفظة
  offering_shares := FLOOR(NEW.total_shares * NEW.offering_percentage / 100);
  ambassador_shares := FLOOR(NEW.total_shares * NEW.ambassador_percentage / 100);
  reserve_shares := NEW.total_shares - offering_shares - ambassador_shares;  -- الباقي للاحتياطي

  -- إنشاء محفظة الطرح
  INSERT INTO public.project_wallets (project_id, wallet_type, total_shares, available_shares)
  VALUES (NEW.id, 'offering', offering_shares, offering_shares);

  -- إنشاء محفظة السفير
  INSERT INTO public.project_wallets (project_id, wallet_type, total_shares, available_shares)
  VALUES (NEW.id, 'ambassador', ambassador_shares, ambassador_shares);

  -- إنشاء محفظة الاحتياطي
  INSERT INTO public.project_wallets (project_id, wallet_type, total_shares, available_shares)
  VALUES (NEW.id, 'reserve', reserve_shares, reserve_shares);

  -- تحديث سعر السوق الحالي ليساوي سعر الطرح
  NEW.current_market_price := NEW.share_price;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_created
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.create_project_wallets();

-- ═══════════════════════════════════════════════════════════════
-- Triggers للتحديث التلقائي
-- ═══════════════════════════════════════════════════════════════

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER project_wallets_updated_at
  BEFORE UPDATE ON public.project_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER holdings_updated_at
  BEFORE UPDATE ON public.holdings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER project_updates_updated_at
  BEFORE UPDATE ON public.project_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

-- Policies: projects
-- الكل يشوف المشاريع المنشورة (ليس المسودات)
CREATE POLICY "Anyone can view published projects"
  ON public.projects FOR SELECT
  USING (status != 'draft' OR created_by = auth.uid());

-- فقط الأدمن ينشئ مشاريع
CREATE POLICY "Admins can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- فقط الأدمن يحدث المشاريع
CREATE POLICY "Admins can update projects"
  ON public.projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Policies: project_wallets
-- الكل يشوف محافظ المشاريع المنشورة
CREATE POLICY "Anyone can view project wallets"
  ON public.project_wallets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND status != 'draft'
    )
  );

-- Policies: holdings
-- المستخدم يشوف حصصه فقط
CREATE POLICY "Users can view own holdings"
  ON public.holdings FOR SELECT
  USING (auth.uid() = user_id);

-- Policies: listings
-- الكل يشوف الإعلانات النشطة
CREATE POLICY "Anyone can view active listings"
  ON public.listings FOR SELECT
  USING (status IN ('active', 'sold'));

-- البائع ينشئ إعلان
CREATE POLICY "Sellers can create listings"
  ON public.listings FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

-- البائع يعدل إعلانه
CREATE POLICY "Sellers can update own listings"
  ON public.listings FOR UPDATE
  USING (auth.uid() = seller_id);

-- Policies: project_updates
-- الكل يشوف تحديثات المشاريع المنشورة
CREATE POLICY "Anyone can view project updates"
  ON public.project_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND status != 'draft'
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- انتهى الجزء 2
-- ═══════════════════════════════════════════════════════════════
