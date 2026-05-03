-- ═══════════════════════════════════════════════════════════════════
-- Phase 7 — Market admin RPCs (auctions + contracts)
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
-- All RPCs SECURITY DEFINER + is_admin() check.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- AUCTIONS
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_create_auction(
  p_project_id UUID,
  p_title TEXT,
  p_starting_price BIGINT,
  p_shares_offered INTEGER,
  p_min_increment BIGINT,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_type TEXT DEFAULT 'english'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;
  IF p_starting_price <= 0 OR p_shares_offered <= 0 OR p_min_increment <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_input');
  END IF;
  IF p_ends_at <= p_starts_at THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_dates');
  END IF;
  IF p_type NOT IN ('english', 'dutch') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_type');
  END IF;

  INSERT INTO public.auctions (
    project_id, title, type, starting_price, current_highest_bid,
    min_increment, shares_offered, starts_at, ends_at, status
  ) VALUES (
    p_project_id, p_title, p_type::auction_type, p_starting_price, 0,
    p_min_increment, p_shares_offered, p_starts_at, p_ends_at,
    CASE WHEN p_starts_at <= NOW() THEN 'active'::auction_status
         ELSE 'upcoming'::auction_status END
  )
  RETURNING id INTO v_auction_id;

  RETURN jsonb_build_object('success', TRUE, 'auction_id', v_auction_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_auction(
  UUID, TEXT, BIGINT, INTEGER, BIGINT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_cancel_auction(
  p_auction_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  UPDATE public.auctions
  SET status = 'ended'::auction_status
  WHERE id = p_auction_id AND status IN ('active', 'upcoming');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found_or_ended');
  END IF;

  -- p_reason is intentionally not stored on auctions (no column for it);
  -- in production we'd write to audit_log. For now, the success is enough.
  PERFORM p_reason;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_cancel_auction(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_end_auction_early(
  p_auction_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  UPDATE public.auctions
  SET status = 'ended'::auction_status, ends_at = NOW()
  WHERE id = p_auction_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_active');
  END IF;
  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_end_auction_early(UUID) TO authenticated;

-- ───────────────────────────────────────────────────────────────────
-- CONTRACTS
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_force_end_contract(
  p_contract_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  UPDATE public.partnership_contracts
  SET status = 'ended'::contract_status,
      ended_at = NOW(),
      cancellation_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_contract_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_active');
  END IF;
  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_force_end_contract(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_cancel_contract(
  p_contract_id UUID,
  p_reason TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  UPDATE public.partnership_contracts
  SET status = 'cancelled'::contract_status,
      cancelled_at = NOW(),
      cancellation_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_contract_id AND status IN ('pending', 'active');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cannot_cancel');
  END IF;
  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_cancel_contract(UUID, TEXT) TO authenticated;

-- Internal resolution: edit member share percentages. p_percents is
-- a jsonb object: { "<contract_member_id>": <new_percent>, ... }.
-- All percentages must sum to 100 across the member set.
CREATE OR REPLACE FUNCTION public.admin_resolve_contract_internally(
  p_contract_id UUID,
  p_percents jsonb,
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC := 0;
  v_key TEXT;
  v_value NUMERIC;
  v_count INT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  -- Sum all provided percentages
  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_percents) LOOP
    v_total := v_total + v_value::NUMERIC;
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'empty_input');
  END IF;
  IF ABS(v_total - 100) > 0.01 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'sum_not_100',
      'actual_sum', v_total);
  END IF;

  -- Apply each percentage
  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_percents) LOOP
    UPDATE public.contract_members
    SET share_percent = v_value::NUMERIC
    WHERE id = v_key::UUID
      AND contract_id = p_contract_id;
  END LOOP;

  -- Also bump the contract's updated_at to surface the change
  UPDATE public.partnership_contracts
  SET updated_at = NOW()
  WHERE id = p_contract_id;

  PERFORM p_notes;

  RETURN jsonb_build_object('success', TRUE, 'updated_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resolve_contract_internally(UUID, jsonb, TEXT) TO authenticated;
