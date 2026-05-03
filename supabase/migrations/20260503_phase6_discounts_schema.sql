-- ═══════════════════════════════════════════════════════════════════
-- Phase 6.1 — Discounts program schema
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Two tables:
--   1. discount_brands  — admin-curated catalogue of partner deals
--   2. user_coupons     — claimed coupons (UNIQUE per user+discount)
--
-- One RPC: claim_discount(p_discount_id) — atomically validates
-- level + max_uses + window, then INSERTs a user_coupon and bumps
-- the brand's used_count. Wrapping in a function avoids races
-- where two clicks would over-claim the last available coupon.
-- ═══════════════════════════════════════════════════════════════════

-- ─── ENUMs ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE discount_category AS ENUM (
    'restaurants', 'clothing', 'electronics',
    'services', 'travel', 'groceries'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE coupon_status AS ENUM ('active', 'used', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1. discount_brands ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.discount_brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_name TEXT NOT NULL,
  brand_logo_emoji TEXT NOT NULL DEFAULT '🛍️',
  category discount_category NOT NULL,

  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 99),
  description TEXT NOT NULL,
  conditions TEXT[] NOT NULL DEFAULT '{}',
  branches TEXT[] NOT NULL DEFAULT '{}',

  -- profiles.level enum string — basic|advanced|pro|elite from migration 10.
  required_level TEXT NOT NULL DEFAULT 'basic'
    CHECK (required_level IN ('basic', 'advanced', 'pro', 'elite')),

  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  max_uses INTEGER NOT NULL CHECK (max_uses > 0),
  cover_color TEXT NOT NULL DEFAULT 'blue'
    CHECK (cover_color IN ('red', 'blue', 'purple', 'orange', 'green', 'yellow')),

  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT discount_brand_dates CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_discount_brands_category ON public.discount_brands(category);
CREATE INDEX IF NOT EXISTS idx_discount_brands_active ON public.discount_brands(is_active, ends_at);

COMMENT ON TABLE public.discount_brands IS 'كتالوج الخصومات الحصرية للمشتركين';

-- ─── 2. user_coupons ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  discount_id UUID NOT NULL REFERENCES public.discount_brands(id) ON DELETE CASCADE,

  code TEXT NOT NULL UNIQUE,
  barcode TEXT NOT NULL,

  status coupon_status NOT NULL DEFAULT 'active',
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,

  -- One coupon per (user, discount) — anti-fraud.
  UNIQUE(user_id, discount_id)
);

CREATE INDEX IF NOT EXISTS idx_user_coupons_user ON public.user_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_coupons_status ON public.user_coupons(status);
CREATE INDEX IF NOT EXISTS idx_user_coupons_discount ON public.user_coupons(discount_id);

COMMENT ON TABLE public.user_coupons IS 'القسائم المُطالَب بها من قِبَل المستخدمين';

-- ─── Helpers: code + barcode generation ──────────────────────
CREATE OR REPLACE FUNCTION public.generate_coupon_code(p_brand_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  v_prefix := 'RAIL' || UPPER(LEFT(REGEXP_REPLACE(p_brand_name, '[^a-zA-Z0-9]', '', 'g'), 4));
  IF length(v_prefix) < 8 THEN
    v_prefix := RPAD(v_prefix, 8, 'X');
  END IF;

  LOOP
    v_code := v_prefix || '-' || UPPER(SUBSTR(MD5(random()::TEXT || clock_timestamp()::TEXT), 1, 5));
    SELECT EXISTS(SELECT 1 FROM public.user_coupons WHERE code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_barcode()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_barcode TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..12 LOOP
    v_barcode := v_barcode || (FLOOR(random() * 10))::TEXT;
  END LOOP;
  RETURN v_barcode;
END;
$$;

-- ─── RPC: claim_discount ─────────────────────────────────────
-- Validates window + level + max_uses, then inserts user_coupon
-- atomically. Returns JSONB { success, coupon? , error? }.
CREATE OR REPLACE FUNCTION public.claim_discount(p_discount_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_brand RECORD;
  v_user_level TEXT;
  v_level_rank INT;
  v_required_rank INT;
  v_code TEXT;
  v_barcode TEXT;
  v_coupon_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  -- Lock the brand row to prevent over-claiming under concurrent calls.
  SELECT * INTO v_brand FROM public.discount_brands
  WHERE id = p_discount_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;

  IF NOT v_brand.is_active THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'inactive');
  END IF;
  IF v_brand.starts_at > NOW() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_started');
  END IF;
  IF v_brand.ends_at <= NOW() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'expired');
  END IF;
  IF v_brand.used_count >= v_brand.max_uses THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'fully_claimed');
  END IF;

  -- Level gate. We rank levels so 'pro' implies 'advanced' implies 'basic'.
  SELECT level INTO v_user_level FROM public.profiles WHERE id = v_uid;
  v_level_rank := CASE COALESCE(v_user_level, 'basic')
    WHEN 'basic'    THEN 1
    WHEN 'advanced' THEN 2
    WHEN 'pro'      THEN 3
    WHEN 'elite'    THEN 4
    ELSE 1
  END;
  v_required_rank := CASE v_brand.required_level
    WHEN 'basic'    THEN 1
    WHEN 'advanced' THEN 2
    WHEN 'pro'      THEN 3
    WHEN 'elite'    THEN 4
    ELSE 1
  END;
  IF v_level_rank < v_required_rank THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'insufficient_level',
      'required', v_brand.required_level,
      'current', COALESCE(v_user_level, 'basic')
    );
  END IF;

  -- Already claimed?
  IF EXISTS (
    SELECT 1 FROM public.user_coupons
    WHERE user_id = v_uid AND discount_id = p_discount_id
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'already_claimed');
  END IF;

  v_code := public.generate_coupon_code(v_brand.brand_name);
  v_barcode := public.generate_barcode();

  INSERT INTO public.user_coupons (
    user_id, discount_id, code, barcode, status, expires_at
  ) VALUES (
    v_uid, p_discount_id, v_code, v_barcode, 'active', v_brand.ends_at
  ) RETURNING id INTO v_coupon_id;

  -- Bump the brand's used_count.
  UPDATE public.discount_brands
  SET used_count = used_count + 1,
      updated_at = NOW()
  WHERE id = p_discount_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'coupon_id', v_coupon_id,
    'code', v_code,
    'barcode', v_barcode
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_discount(UUID) TO authenticated;

-- ─── updated_at triggers ─────────────────────────────────────
DROP TRIGGER IF EXISTS discount_brands_updated_at ON public.discount_brands;
CREATE TRIGGER discount_brands_updated_at
  BEFORE UPDATE ON public.discount_brands
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.discount_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

-- discount_brands: SELECT (active+within window OR admin), admin manages
DROP POLICY IF EXISTS "View active discounts or admin sees all"
  ON public.discount_brands;
CREATE POLICY "View active discounts or admin sees all"
ON public.discount_brands FOR SELECT
USING (
  (is_active = TRUE AND starts_at <= NOW() AND ends_at > NOW())
  OR public.is_admin()
);

DROP POLICY IF EXISTS "Admins manage discounts" ON public.discount_brands;
CREATE POLICY "Admins manage discounts"
ON public.discount_brands FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- user_coupons: SELECT self+admin, INSERT only via RPC, UPDATE self (mark used)
DROP POLICY IF EXISTS "Users view own coupons" ON public.user_coupons;
CREATE POLICY "Users view own coupons"
ON public.user_coupons FOR SELECT
USING (user_id = auth.uid() OR public.is_admin());

-- INSERT policy: only allow self-insertion. The RPC runs as
-- SECURITY DEFINER so it bypasses this; but client-direct
-- INSERTs still must be self-only as a defence-in-depth.
DROP POLICY IF EXISTS "Users insert own coupons" ON public.user_coupons;
CREATE POLICY "Users insert own coupons"
ON public.user_coupons FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users mark own coupon used" ON public.user_coupons;
CREATE POLICY "Users mark own coupon used"
ON public.user_coupons FOR UPDATE
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins delete coupons" ON public.user_coupons;
CREATE POLICY "Admins delete coupons"
ON public.user_coupons FOR DELETE
USING (public.is_admin());
