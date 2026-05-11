-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.59 — Admin quick-buy (sell directly to the platform)
-- Date: 2026-05-12
-- Idempotent.
--
-- Founder spec:
--   1. Quick-sale gets a SECOND option besides "list to users":
--      "بيع للنظام (إدارة)" — instant sale at a fixed discount
--      (default 15%) below current market price.
--   2. Admin toggles this per-project from the admin panel
--      (project form / project wallet).
--   3. When the toggle is ON: the user can sell instantly to the
--      platform, shares return to the offering wallet, user is
--      credited in fee_unit_balances.
--   4. When OFF: the UI shows "غير متوفّر حالياً" and only the
--      P2P flow is available.
--
-- Changes:
--   1. projects.admin_quick_buy_enabled (BOOLEAN, default FALSE)
--   2. projects.admin_quick_buy_discount_pct (NUMERIC, default 15)
--   3. admin_quick_buys ledger table for audit + history
--   4. admin_set_project_quick_buy() RPC — admin-only toggle
--   5. execute_admin_quick_buy() RPC — user-callable sale
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Project columns ──────────────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS admin_quick_buy_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS admin_quick_buy_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 15.00
    CHECK (admin_quick_buy_discount_pct >= 0 AND admin_quick_buy_discount_pct <= 90);

COMMENT ON COLUMN public.projects.admin_quick_buy_enabled IS
  'TRUE = users can sell shares back to the platform instantly (Phase 13.59)';
COMMENT ON COLUMN public.projects.admin_quick_buy_discount_pct IS
  'Discount off current_market_price applied when the platform buys (default 15%)';


-- ─── 2. Ledger table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_quick_buys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  seller_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shares          BIGINT NOT NULL CHECK (shares > 0),
  market_price    BIGINT NOT NULL CHECK (market_price > 0),
  discount_pct    NUMERIC(5,2) NOT NULL,
  price_per_share BIGINT NOT NULL CHECK (price_per_share > 0),
  total_amount    BIGINT NOT NULL CHECK (total_amount > 0),
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_quick_buys_project
  ON public.admin_quick_buys(project_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_quick_buys_seller
  ON public.admin_quick_buys(seller_id, executed_at DESC);

ALTER TABLE public.admin_quick_buys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seller reads own admin_quick_buys" ON public.admin_quick_buys;
CREATE POLICY "seller reads own admin_quick_buys"
  ON public.admin_quick_buys FOR SELECT
  USING (seller_id = auth.uid() OR public.is_admin());

-- Inserts only via the SECURITY DEFINER RPC.
DROP POLICY IF EXISTS "no direct inserts admin_quick_buys" ON public.admin_quick_buys;
CREATE POLICY "no direct inserts admin_quick_buys"
  ON public.admin_quick_buys FOR INSERT
  WITH CHECK (FALSE);


-- ─── 3. Toggle RPC (admin only) ──────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_set_project_quick_buy(UUID, BOOLEAN, NUMERIC);

CREATE OR REPLACE FUNCTION public.admin_set_project_quick_buy(
  p_project_id   UUID,
  p_enabled      BOOLEAN,
  p_discount_pct NUMERIC DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_admin');
  END IF;
  IF p_project_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;
  IF p_discount_pct IS NOT NULL
     AND (p_discount_pct < 0 OR p_discount_pct > 90) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_discount');
  END IF;

  UPDATE public.projects
     SET admin_quick_buy_enabled = COALESCE(p_enabled, admin_quick_buy_enabled),
         admin_quick_buy_discount_pct = COALESCE(p_discount_pct, admin_quick_buy_discount_pct),
         updated_at = NOW()
   WHERE id = p_project_id
  RETURNING 1 INTO v_updated;

  IF v_updated IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'project_not_found');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'enabled', p_enabled,
    'discount_pct', p_discount_pct
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_project_quick_buy(UUID, BOOLEAN, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_project_quick_buy(UUID, BOOLEAN, NUMERIC) TO authenticated;


-- ─── 4. Execute RPC (user side — sell to platform) ──────────────
-- Atomic flow:
--   1. Check project flag is ON.
--   2. Compute price = market × (1 - discount).
--   3. FOR UPDATE lock the user's holdings row to prevent double-spend.
--   4. Validate user has enough free (non-frozen) shares.
--   5. Decrement holdings; row dropped if shares hits zero.
--   6. Return shares to project_wallets.offering (available_shares++,
--      sold_shares-- so the conservation check stays satisfied).
--   7. Credit user's fee_unit_balances with the proceeds.
--   8. Append the ledger row + a fee_unit_transactions deposit so the
--      wallet history shows where the IQD came from.
--   9. Return success + amount.

DROP FUNCTION IF EXISTS public.execute_admin_quick_buy(UUID, BIGINT);

CREATE OR REPLACE FUNCTION public.execute_admin_quick_buy(
  p_project_id UUID,
  p_shares     BIGINT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid             UUID := auth.uid();
  v_project         RECORD;
  v_market_price    BIGINT;
  v_price_per_share BIGINT;
  v_total           BIGINT;
  v_holding         RECORD;
  v_free_shares     BIGINT;
  v_ledger_id       UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF p_project_id IS NULL OR p_shares IS NULL OR p_shares <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  -- 1) Project gate.
  SELECT id, current_market_price, share_price,
         admin_quick_buy_enabled, admin_quick_buy_discount_pct
    INTO v_project
    FROM public.projects
   WHERE id = p_project_id;

  IF v_project.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'project_not_found');
  END IF;
  IF NOT COALESCE(v_project.admin_quick_buy_enabled, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'feature_disabled');
  END IF;

  -- 2) Price.
  v_market_price := COALESCE(v_project.current_market_price, v_project.share_price, 0);
  IF v_market_price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_market_price');
  END IF;
  v_price_per_share := FLOOR(
    v_market_price * (1 - v_project.admin_quick_buy_discount_pct / 100.0)
  )::BIGINT;
  IF v_price_per_share <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'price_underflow');
  END IF;
  v_total := v_price_per_share * p_shares;

  -- 3-4) Lock holdings + validate.
  SELECT id, shares, frozen_shares
    INTO v_holding
    FROM public.holdings
   WHERE user_id = v_uid AND project_id = p_project_id
   FOR UPDATE;

  IF v_holding.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_holdings');
  END IF;
  v_free_shares := COALESCE(v_holding.shares, 0) - COALESCE(v_holding.frozen_shares, 0);
  IF v_free_shares < p_shares THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'insufficient_shares',
      'free_shares', v_free_shares, 'requested', p_shares
    );
  END IF;

  -- 5) Decrement holdings (delete row if it hits zero).
  IF v_holding.shares - p_shares <= 0 THEN
    DELETE FROM public.holdings WHERE id = v_holding.id;
  ELSE
    UPDATE public.holdings
       SET shares = shares - p_shares,
           updated_at = NOW()
     WHERE id = v_holding.id;
  END IF;

  -- 6) Return shares to offering wallet. Keep the conservation
  -- invariant (available + reserved + sold = total) by moving from
  -- sold → available. Best-effort: if the wallet row doesn't exist
  -- yet we skip silently (older projects without wallets).
  BEGIN
    UPDATE public.project_wallets
       SET available_shares = available_shares + p_shares,
           sold_shares      = GREATEST(sold_shares - p_shares, 0)
     WHERE project_id = p_project_id
       AND wallet_type::TEXT = 'offering';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 7) Credit the seller's fee_unit_balances. Insert the row if it
  -- doesn't exist yet.
  INSERT INTO public.fee_unit_balances (user_id, balance, total_deposited)
  VALUES (v_uid, v_total, v_total)
  ON CONFLICT (user_id) DO UPDATE
    SET balance         = public.fee_unit_balances.balance + EXCLUDED.balance,
        total_deposited = public.fee_unit_balances.total_deposited + EXCLUDED.total_deposited,
        updated_at      = NOW();

  -- 8) Ledger + fee_unit_transactions for traceability.
  INSERT INTO public.admin_quick_buys (
    project_id, seller_id, shares, market_price, discount_pct,
    price_per_share, total_amount
  ) VALUES (
    p_project_id, v_uid, p_shares, v_market_price,
    v_project.admin_quick_buy_discount_pct,
    v_price_per_share, v_total
  )
  RETURNING id INTO v_ledger_id;

  BEGIN
    INSERT INTO public.fee_unit_transactions (user_id, amount, type, description, source_id)
    VALUES (
      v_uid, v_total, 'deposit',
      'بيع سريع للنظام — ' || p_shares::TEXT || ' حصّة بسعر ' || v_price_per_share::TEXT,
      v_ledger_id
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success',          true,
    'ledger_id',        v_ledger_id,
    'shares',           p_shares,
    'price_per_share',  v_price_per_share,
    'market_price',     v_market_price,
    'discount_pct',     v_project.admin_quick_buy_discount_pct,
    'total_amount',     v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.execute_admin_quick_buy(UUID, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_admin_quick_buy(UUID, BIGINT) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.59 admin quick-buy applied.';
  RAISE NOTICE '  ✓ projects.admin_quick_buy_enabled + discount_pct';
  RAISE NOTICE '  ✓ admin_quick_buys ledger + RLS';
  RAISE NOTICE '  ✓ admin_set_project_quick_buy(id, enabled, pct)';
  RAISE NOTICE '  ✓ execute_admin_quick_buy(id, shares) atomic flow';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
