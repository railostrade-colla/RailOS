-- ═══════════════════════════════════════════════════════════════════
-- Phase 12.7 — payment_methods on profiles
-- Date: 2026-05-09
-- Idempotent.
--
-- The founder's exchange model has money moving OUTSIDE the app.
-- The buyer transfers the deal amount directly to the seller's bank
-- account / mobile wallet / mastercard, then uploads a proof image
-- inside the deal. For that flow to work, the seller's payment
-- methods must be visible to the counter-party once a deal opens.
--
-- Design:
--   profiles.payment_methods JSONB DEFAULT '[]'
--     → an array of { type, label, value, is_primary } objects.
--   Frontend renders + lets users edit. RLS keeps it tied to the
--   row owner (profile policies already cover this).
--
-- A small RPC `get_user_payment_methods(uid)` returns the methods of
-- a given user — used by the deal page so the buyer doesn't need a
-- profile-level read of the seller (which would leak unrelated
-- profile fields). Read access is gated to actual deal participants.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Schema column ────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb;
EXCEPTION WHEN undefined_table THEN
  RAISE WARNING 'public.profiles missing — payment_methods not added';
END $$;

-- Optional gen_index for fast `?` containment queries (admin search).
CREATE INDEX IF NOT EXISTS idx_profiles_payment_methods_gin
  ON public.profiles USING GIN (payment_methods);

COMMENT ON COLUMN public.profiles.payment_methods IS
  'Array of payment methods the user accepts for off-platform settlement.
   Shape: [{ "type": "phone"|"bank"|"mastercard"|"other",
             "label": "زين كاش / TBI / ماستركارد ...",
             "value": "07901234567 / 1234567890",
             "is_primary": boolean }]';


-- ─── 2. Convenience RPC: own payment methods ────────────────────
-- Frontend uses this to render the list on the profile/edit page.
-- A simple SELECT works too, but having an RPC means we can later
-- audit-log mutations without schema churn.

CREATE OR REPLACE FUNCTION public.get_my_payment_methods()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_methods JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  SELECT COALESCE(payment_methods, '[]'::jsonb)
    INTO v_methods FROM public.profiles WHERE id = v_uid;
  RETURN COALESCE(v_methods, '[]'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.get_my_payment_methods() TO authenticated;


-- ─── 3. Save payment methods (whole-array replace) ──────────────
-- Validates the input shape so a bad client can't store garbage.
-- Limits: max 10 methods per profile, value ≤ 60 chars, type in
-- the allowed set.

CREATE OR REPLACE FUNCTION public.set_my_payment_methods(p_methods JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_count INT;
  v_method JSONB;
  v_type TEXT;
  v_value TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  IF p_methods IS NULL OR jsonb_typeof(p_methods) <> 'array' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'must_be_array');
  END IF;

  v_count := jsonb_array_length(p_methods);
  IF v_count > 10 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'too_many', 'max', 10);
  END IF;

  -- Per-element validation
  FOR v_method IN SELECT * FROM jsonb_array_elements(p_methods)
  LOOP
    v_type := v_method->>'type';
    v_value := v_method->>'value';
    IF v_type NOT IN ('phone', 'bank', 'mastercard', 'other') THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'bad_type', 'value', v_type);
    END IF;
    IF v_value IS NULL OR length(trim(v_value)) = 0 THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'empty_value');
    END IF;
    IF length(v_value) > 60 THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'value_too_long', 'max', 60);
    END IF;
  END LOOP;

  UPDATE public.profiles
  SET payment_methods = p_methods,
      updated_at = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object('success', TRUE, 'count', v_count);
END $$;
GRANT EXECUTE ON FUNCTION public.set_my_payment_methods(JSONB) TO authenticated;


-- ─── 4. Read counter-party's methods (gated by deal membership) ─
-- The buyer needs to see the seller's payment methods on the deal
-- page so they can transfer money externally. This RPC checks that
-- the caller IS a party of an active deal with the target user
-- before returning. No deal → empty result. Keeps payment_methods
-- private from the rest of the platform.

CREATE OR REPLACE FUNCTION public.get_counterparty_payment_methods(p_deal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_deal RECORD;
  v_other UUID;
  v_methods JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT id, buyer_id, seller_id, status
    INTO v_deal FROM public.deals WHERE id = p_deal_id;
  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;
  IF v_deal.buyer_id <> v_uid AND v_deal.seller_id <> v_uid THEN
    RETURN '[]'::jsonb;
  END IF;
  IF v_deal.status NOT IN ('accepted', 'payment_submitted', 'completed', 'disputed') THEN
    RETURN '[]'::jsonb;
  END IF;

  v_other := CASE WHEN v_deal.buyer_id = v_uid
    THEN v_deal.seller_id
    ELSE v_deal.buyer_id
  END;

  SELECT COALESCE(payment_methods, '[]'::jsonb)
    INTO v_methods FROM public.profiles WHERE id = v_other;
  RETURN COALESCE(v_methods, '[]'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.get_counterparty_payment_methods(UUID)
  TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 12.7 payment-methods migration applied:';
  RAISE NOTICE '  ✓ profiles.payment_methods JSONB column';
  RAISE NOTICE '  ✓ get_my_payment_methods()';
  RAISE NOTICE '  ✓ set_my_payment_methods(jsonb)';
  RAISE NOTICE '  ✓ get_counterparty_payment_methods(deal_id)';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
