-- ═══════════════════════════════════════════════════════════════
-- Railos Database Schema - Part 3: Deals, Chat, Disputes & Ratings
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════════════

-- نوع الصفقة
CREATE TYPE deal_type AS ENUM (
  'primary',          -- من محفظة الطرح (شراء أولي)
  'secondary',        -- بين المستخدمين (إعلان)
  'quick_sell'        -- بيع سريع
);

-- حالة الصفقة
CREATE TYPE deal_status AS ENUM (
  'pending_seller_approval',  -- بانتظار موافقة البائع
  'rejected',                 -- رفض البائع
  'accepted',                 -- قبل البائع (الأسهم مجمدة، غرفة الدردشة مفتوحة)
  'payment_submitted',        -- المشتري رفع إثبات الدفع
  'completed',                -- البائع ضغط "إطلاق الحصص"
  'cancelled',                -- ألغى أحد الطرفين
  'disputed',                 -- في نزاع
  'expired'                   -- انتهت المهلة
);

-- نوع الرسالة
CREATE TYPE message_type AS ENUM (
  'text',             -- نص عادي
  'image',            -- صورة
  'payment_proof',    -- إثبات دفع
  'system'            -- رسالة نظام (مثلاً: "تم إطلاق الحصص")
);

-- حالة النزاع
CREATE TYPE dispute_status AS ENUM (
  'open',             -- مفتوح
  'under_review',     -- قيد المراجعة
  'resolved_buyer',   -- حُل لصالح المشتري
  'resolved_seller',  -- حُل لصالح البائع
  'closed'            -- أُغلق بدون حل
);

-- طريقة الدفع
CREATE TYPE payment_method AS ENUM (
  'zain_cash',
  'master_card',
  'bank_transfer',
  'other'
);

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 1: deals - الصفقات
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- الأطراف
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,

  -- المشروع والإعلان
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,

  -- نوع وتفاصيل الصفقة
  deal_type deal_type NOT NULL,
  shares BIGINT NOT NULL CHECK (shares > 0),
  price_per_share BIGINT NOT NULL CHECK (price_per_share > 0),
  total_amount BIGINT GENERATED ALWAYS AS (shares * price_per_share) STORED,

  -- الرسوم (يدفعها البائع - كنسبة)
  fee_percentage DECIMAL(5,2) DEFAULT 1.00 CHECK (fee_percentage >= 0 AND fee_percentage <= 10),
  fee_amount BIGINT GENERATED ALWAYS AS (
    FLOOR((shares * price_per_share * fee_percentage) / 100)
  ) STORED,

  -- الحالة
  status deal_status NOT NULL DEFAULT 'pending_seller_approval',

  -- ملاحظات
  buyer_notes TEXT,
  seller_notes TEXT,
  cancellation_reason TEXT,

  -- التوقيتات
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  payment_submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),

  -- قيود
  CONSTRAINT different_parties CHECK (buyer_id != seller_id)
);

CREATE INDEX idx_deals_buyer ON public.deals(buyer_id);
CREATE INDEX idx_deals_seller ON public.deals(seller_id);
CREATE INDEX idx_deals_project ON public.deals(project_id);
CREATE INDEX idx_deals_status ON public.deals(status);
CREATE INDEX idx_deals_created_at ON public.deals(created_at DESC);
CREATE INDEX idx_deals_active ON public.deals(buyer_id, seller_id, status)
  WHERE status IN ('pending_seller_approval', 'accepted', 'payment_submitted');

COMMENT ON TABLE public.deals IS 'الصفقات بين المشترين والبائعين';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 2: deal_messages - رسائل غرفة الصفقة
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.deal_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- المحتوى
  message_type message_type NOT NULL DEFAULT 'text',
  content TEXT,
  attachment_url TEXT,

  -- حالة القراءة
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,

  -- التوقيتات
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- قيد: يجب وجود محتوى أو مرفق
  CONSTRAINT content_or_attachment CHECK (content IS NOT NULL OR attachment_url IS NOT NULL)
);

CREATE INDEX idx_deal_messages_deal ON public.deal_messages(deal_id);
CREATE INDEX idx_deal_messages_sender ON public.deal_messages(sender_id);
CREATE INDEX idx_deal_messages_created_at ON public.deal_messages(created_at DESC);
CREATE INDEX idx_deal_messages_unread ON public.deal_messages(deal_id, is_read) WHERE is_read = false;

COMMENT ON TABLE public.deal_messages IS 'رسائل غرفة الصفقة (دردشة البائع والمشتري)';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 3: payment_proofs - إثباتات الدفع
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.payment_proofs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,

  -- تفاصيل الدفع
  payment_method payment_method NOT NULL,
  amount_paid BIGINT NOT NULL CHECK (amount_paid > 0),
  transaction_reference TEXT,

  -- الإثبات
  proof_image_url TEXT NOT NULL,
  notes TEXT,

  -- التوقيتات
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_proofs_deal ON public.payment_proofs(deal_id);

COMMENT ON TABLE public.payment_proofs IS 'إثباتات الدفع المرفوعة من المشتري';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 4: disputes - النزاعات
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,

  -- من فتح النزاع
  opened_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',

  -- الحالة والحل
  status dispute_status NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- التوقيتات
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disputes_deal ON public.disputes(deal_id);
CREATE INDEX idx_disputes_status ON public.disputes(status);
CREATE INDEX idx_disputes_opened_by ON public.disputes(opened_by);

COMMENT ON TABLE public.disputes IS 'النزاعات بين البائع والمشتري';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 5: ratings - تقييمات الصفقات
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,

  -- من قيّم من
  rater_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rated_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- التقييم
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment TEXT,

  -- القوالب الجاهزة (مصفوفة من النصوص المختارة)
  quick_tags TEXT[] DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- تقييم واحد فقط لكل شخص في كل صفقة
  UNIQUE(deal_id, rater_id),

  -- لا تقيّم نفسك
  CONSTRAINT no_self_rating CHECK (rater_id != rated_user_id)
);

CREATE INDEX idx_ratings_deal ON public.ratings(deal_id);
CREATE INDEX idx_ratings_rated_user ON public.ratings(rated_user_id);
CREATE INDEX idx_ratings_rater ON public.ratings(rater_id);

COMMENT ON TABLE public.ratings IS 'تقييمات الصفقات بين الأطراف';

-- ═══════════════════════════════════════════════════════════════
-- FUNCTION: تحديث متوسط تقييم المستخدم تلقائياً
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_user_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET
    rating_average = (
      SELECT COALESCE(AVG(stars)::DECIMAL(3,2), 0)
      FROM public.ratings
      WHERE rated_user_id = NEW.rated_user_id
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM public.ratings
      WHERE rated_user_id = NEW.rated_user_id
    )
  WHERE id = NEW.rated_user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_rating_created
  AFTER INSERT ON public.ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_rating();

-- ═══════════════════════════════════════════════════════════════
-- FUNCTION: زيادة عداد الصفقات عند إكمالها
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.increment_trades_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- زيادة عداد الصفقات للبائع والمشتري
    UPDATE public.profiles
    SET trades_completed = trades_completed + 1
    WHERE id IN (NEW.buyer_id, NEW.seller_id);

    -- تعيين وقت الإكمال
    NEW.completed_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_deal_completed
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.increment_trades_on_completion();

-- ═══════════════════════════════════════════════════════════════
-- Triggers للتحديث التلقائي
-- ═══════════════════════════════════════════════════════════════

CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Policies: deals
-- المستخدم يشوف صفقاته فقط (بائع أو مشتري)
CREATE POLICY "Users can view own deals"
  ON public.deals FOR SELECT
  USING (auth.uid() IN (buyer_id, seller_id));

-- المشتري ينشئ طلب شراء
CREATE POLICY "Buyers can create deals"
  ON public.deals FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- أطراف الصفقة يقدرون يحدثونها (لتغيير الحالة)
CREATE POLICY "Deal parties can update deals"
  ON public.deals FOR UPDATE
  USING (auth.uid() IN (buyer_id, seller_id));

-- Policies: deal_messages
-- أطراف الصفقة يشوفون الرسائل
CREATE POLICY "Deal parties can view messages"
  ON public.deal_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deals
      WHERE id = deal_id AND auth.uid() IN (buyer_id, seller_id)
    )
  );

-- أطراف الصفقة يرسلون رسائل
CREATE POLICY "Deal parties can send messages"
  ON public.deal_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.deals
      WHERE id = deal_id AND auth.uid() IN (buyer_id, seller_id)
    )
  );

-- Policies: payment_proofs
-- أطراف الصفقة يشوفون الإثبات
CREATE POLICY "Deal parties can view payment proofs"
  ON public.payment_proofs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deals
      WHERE id = deal_id AND auth.uid() IN (buyer_id, seller_id)
    )
  );

-- المشتري فقط يرفع إثبات
CREATE POLICY "Buyers can submit payment proofs"
  ON public.payment_proofs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deals
      WHERE id = deal_id AND auth.uid() = buyer_id
    )
  );

-- Policies: disputes
-- أطراف الصفقة يشوفون النزاع
CREATE POLICY "Deal parties can view disputes"
  ON public.disputes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deals
      WHERE id = deal_id AND auth.uid() IN (buyer_id, seller_id)
    )
  );

-- أطراف الصفقة يفتحون نزاع
CREATE POLICY "Deal parties can open disputes"
  ON public.disputes FOR INSERT
  WITH CHECK (
    auth.uid() = opened_by AND
    EXISTS (
      SELECT 1 FROM public.deals
      WHERE id = deal_id AND auth.uid() IN (buyer_id, seller_id)
    )
  );

-- Policies: ratings
-- الكل يشوف التقييمات (شفافية)
CREATE POLICY "Anyone can view ratings"
  ON public.ratings FOR SELECT
  USING (true);

-- أطراف الصفقة المكتملة يقيّمون
CREATE POLICY "Deal parties can rate completed deals"
  ON public.ratings FOR INSERT
  WITH CHECK (
    auth.uid() = rater_id AND
    EXISTS (
      SELECT 1 FROM public.deals
      WHERE id = deal_id
        AND status = 'completed'
        AND auth.uid() IN (buyer_id, seller_id)
        AND rated_user_id IN (buyer_id, seller_id)
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- انتهى الجزء 3
-- ═══════════════════════════════════════════════════════════════
