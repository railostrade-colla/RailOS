-- ═══════════════════════════════════════════════════════════════
-- Railos Database Schema - Part 5: Fee Units & Subscriptions
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════════════

-- حالة طلب شحن الوحدات
CREATE TYPE fee_unit_request_status AS ENUM (
  'pending',          -- قيد المراجعة
  'approved',         -- موافق (تمت إضافة الوحدات)
  'rejected',         -- مرفوض
  'cancelled'         -- ألغاه المستخدم
);

-- نوع حركة الوحدات
CREATE TYPE transaction_type AS ENUM (
  'deposit',          -- إيداع (من الأدمن بعد موافقة على طلب)
  'withdrawal',       -- سحب (خصم رسوم صفقة)
  'subscription',     -- خصم اشتراك Quick Sell
  'bonus',            -- هدية ترحيبية أو عرض
  'refund',           -- استرجاع (في حالة إلغاء صفقة)
  'adjustment'        -- تعديل يدوي من الأدمن
);

-- حالة الاشتراك
CREATE TYPE subscription_status AS ENUM (
  'active',           -- نشط
  'expired',          -- منتهي (يحتاج تجديد)
  'cancelled'         -- ألغاه المستخدم
);

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 1: fee_unit_balances - أرصدة وحدات الرسوم
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.fee_unit_balances (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- الأرصدة (بالوحدات = بالدينار)
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  reserved_balance BIGINT NOT NULL DEFAULT 0 CHECK (reserved_balance >= 0),

  -- إحصائيات
  total_deposited BIGINT NOT NULL DEFAULT 0,
  total_withdrawn BIGINT NOT NULL DEFAULT 0,
  total_bonus_received BIGINT NOT NULL DEFAULT 0,

  -- التوقيتات
  last_transaction_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fee_balances_balance ON public.fee_unit_balances(balance);

COMMENT ON TABLE public.fee_unit_balances IS 'أرصدة وحدات الرسوم لكل مستخدم (1 وحدة = 1 دينار)';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 2: fee_unit_requests - طلبات شحن الوحدات
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.fee_unit_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- تفاصيل الطلب
  amount_requested BIGINT NOT NULL CHECK (amount_requested > 0),
  payment_method payment_method NOT NULL,
  transaction_reference TEXT,

  -- إثبات التحويل
  proof_image_url TEXT NOT NULL,
  notes TEXT,

  -- الحالة
  status fee_unit_request_status NOT NULL DEFAULT 'pending',

  -- المراجعة من الأدمن
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  rejection_reason TEXT,

  -- مبلغ معتمد (قد يختلف عن المطلوب لو تحقق الأدمن من مبلغ مختلف)
  amount_approved BIGINT CHECK (amount_approved IS NULL OR amount_approved >= 0),

  -- التوقيتات
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fee_requests_user ON public.fee_unit_requests(user_id);
CREATE INDEX idx_fee_requests_status ON public.fee_unit_requests(status);
CREATE INDEX idx_fee_requests_submitted_at ON public.fee_unit_requests(submitted_at DESC);

COMMENT ON TABLE public.fee_unit_requests IS 'طلبات شحن وحدات الرسوم من المستخدمين';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 3: fee_unit_transactions - سجل حركات الوحدات
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.fee_unit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- نوع ومبلغ الحركة
  transaction_type transaction_type NOT NULL,
  amount BIGINT NOT NULL,  -- موجب للإيداع، سالب للخصم

  -- الرصيد بعد الحركة (للمراجعة السريعة)
  balance_after BIGINT NOT NULL CHECK (balance_after >= 0),

  -- الارتباط بالمصدر
  source_type TEXT,  -- 'deal', 'subscription', 'request', 'manual'
  source_id UUID,    -- UUID للـ deal أو subscription أو request

  -- وصف الحركة
  description TEXT,

  -- المنفذ (الأدمن في حالة manual)
  executed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user ON public.fee_unit_transactions(user_id);
CREATE INDEX idx_transactions_type ON public.fee_unit_transactions(transaction_type);
CREATE INDEX idx_transactions_source ON public.fee_unit_transactions(source_type, source_id);
CREATE INDEX idx_transactions_created_at ON public.fee_unit_transactions(created_at DESC);

COMMENT ON TABLE public.fee_unit_transactions IS 'سجل كامل لكل حركات وحدات الرسوم';

-- ═══════════════════════════════════════════════════════════════
-- JEDOL 4: quick_sell_subscriptions - اشتراكات البيع السريع
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.quick_sell_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- تفاصيل الاشتراك
  amount_paid BIGINT NOT NULL DEFAULT 25000 CHECK (amount_paid > 0),

  -- الحالة
  status subscription_status NOT NULL DEFAULT 'active',

  -- التوقيتات
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  cancelled_at TIMESTAMPTZ,
  auto_renew BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON public.quick_sell_subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.quick_sell_subscriptions(status);
CREATE INDEX idx_subscriptions_active ON public.quick_sell_subscriptions(user_id, expires_at) WHERE status = 'active';

COMMENT ON TABLE public.quick_sell_subscriptions IS 'اشتراكات البيع السريع (25,000 د.ع/شهر)';

-- ═══════════════════════════════════════════════════════════════
-- FUNCTION: إنشاء رصيد وحدات تلقائياً عند تسجيل المستخدم
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_fee_balance_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- إنشاء سجل رصيد مع هدية ترحيبية (1000 وحدة = 1000 دينار)
  INSERT INTO public.fee_unit_balances (user_id, balance, total_bonus_received)
  VALUES (NEW.id, 1000, 1000);

  -- تسجيل الحركة
  INSERT INTO public.fee_unit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    description
  ) VALUES (
    NEW.id,
    'bonus',
    1000,
    1000,
    'هدية ترحيبية للمستخدمين الجدد'
  );

  RETURN NEW;
END;
$$;

-- ملاحظة: هذا التريغر يعمل على جدول profiles (ليس auth.users)
-- لأن profile يُنشأ تلقائياً عند تسجيل المستخدم في auth
CREATE TRIGGER on_profile_created_fee_balance
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_fee_balance_on_signup();

-- ═══════════════════════════════════════════════════════════════
-- FUNCTION: تحديث الرصيد عند الموافقة على طلب شحن
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_fee_request_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  approved_amount BIGINT;
  new_balance BIGINT;
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- استخدام المبلغ المعتمد أو المطلوب
    approved_amount := COALESCE(NEW.amount_approved, NEW.amount_requested);

    -- تحديث الرصيد
    UPDATE public.fee_unit_balances
    SET
      balance = balance + approved_amount,
      total_deposited = total_deposited + approved_amount,
      last_transaction_at = NOW()
    WHERE user_id = NEW.user_id
    RETURNING balance INTO new_balance;

    -- تسجيل الحركة
    INSERT INTO public.fee_unit_transactions (
      user_id,
      transaction_type,
      amount,
      balance_after,
      source_type,
      source_id,
      description,
      executed_by
    ) VALUES (
      NEW.user_id,
      'deposit',
      approved_amount,
      new_balance,
      'request',
      NEW.id,
      'شحن وحدات بعد موافقة الأدمن',
      NEW.reviewed_by
    );

    NEW.reviewed_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_fee_request_approved
  BEFORE UPDATE ON public.fee_unit_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_fee_request_approval();

-- ═══════════════════════════════════════════════════════════════
-- FUNCTION: إلغاء اشتراك Quick Sell المنتهي
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_subscription_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- تحديث الاشتراكات المنتهية
  IF NEW.expires_at < NOW() AND NEW.status = 'active' THEN
    NEW.status = 'expired';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_subscription_status
  BEFORE UPDATE ON public.quick_sell_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_subscription_expiry();

-- ═══════════════════════════════════════════════════════════════
-- Triggers للتحديث التلقائي
-- ═══════════════════════════════════════════════════════════════

CREATE TRIGGER fee_unit_balances_updated_at
  BEFORE UPDATE ON public.fee_unit_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER fee_unit_requests_updated_at
  BEFORE UPDATE ON public.fee_unit_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER quick_sell_subscriptions_updated_at
  BEFORE UPDATE ON public.quick_sell_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.fee_unit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_unit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_unit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_sell_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies: fee_unit_balances
-- المستخدم يشوف رصيده فقط
CREATE POLICY "Users can view own balance"
  ON public.fee_unit_balances FOR SELECT
  USING (auth.uid() = user_id);

-- Policies: fee_unit_requests
-- المستخدم يشوف طلباته
CREATE POLICY "Users can view own requests"
  ON public.fee_unit_requests FOR SELECT
  USING (auth.uid() = user_id);

-- المستخدم ينشئ طلب
CREATE POLICY "Users can create requests"
  ON public.fee_unit_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- المستخدم يلغي طلبه (فقط لو pending)
CREATE POLICY "Users can cancel pending requests"
  ON public.fee_unit_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

-- Policies: fee_unit_transactions
-- المستخدم يشوف سجل حركاته
CREATE POLICY "Users can view own transactions"
  ON public.fee_unit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Policies: quick_sell_subscriptions
-- المستخدم يشوف اشتراكاته
CREATE POLICY "Users can view own subscriptions"
  ON public.quick_sell_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- المستخدم ينشئ اشتراك (لنفسه فقط)
CREATE POLICY "Users can create own subscriptions"
  ON public.quick_sell_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- المستخدم يلغي اشتراكه
CREATE POLICY "Users can cancel own subscriptions"
  ON public.quick_sell_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- انتهى الجزء 5
-- ═══════════════════════════════════════════════════════════════
