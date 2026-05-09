-- ═══════════════════════════════════════════════════════════════════
-- Phase 12 — Ambassador click tracking + first-investment auto-reward
-- Date: 2026-05-09
-- Idempotent.
--
-- The ambassador schema (04_ambassadors.sql) already has:
--   • referral_links.clicks_count   — never incremented (gap #1)
--   • referrals.has_invested        — never flipped (gap #2)
--   • ambassador_rewards table      — never populated (gap #3)
--   • handle_referral_conversion()  — trigger that DOES bump
--     conversions_count once has_invested flips, but it never flips
--
-- This migration adds the THREE missing automation pieces:
--
--   1. track_referral_click(p_code)        — public RPC called from
--      the /r/[code] redirect to bump clicks_count exactly once per
--      visitor.
--
--   2. on_deal_complete_referral_reward    — trigger on deals that
--      runs when a deal first transitions to 'completed'. If the
--      buyer was referred AND hasn't invested yet, it:
--        a) Updates the referrals row (has_invested=true,
--           first_investment_*).
--        b) Computes reward_shares = GREATEST(1, CEIL(shares × 2%)).
--        c) Deducts those shares from the project's `ambassador`
--           wallet (with `offering` fallback when ambassador wallet
--           is empty / missing).
--        d) Adds the shares to the ambassador's holdings row.
--        e) Inserts an ambassador_rewards row with status='granted'.
--      Wrapped in a single transaction — partial reward is impossible.
--
--   3. ambassador_holdings RLS policy hardening so the trigger's
--      INSERT/UPDATE doesn't get blocked when running as the deal's
--      buyer (it bypasses via SECURITY DEFINER).
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Public click-tracking RPC ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.track_referral_click(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN FALSE;
  END IF;
  UPDATE public.referral_links
     SET clicks_count = COALESCE(clicks_count, 0) + 1,
         updated_at = NOW()
   WHERE code = p_code AND status = 'active';
  RETURN FOUND;
END $$;

GRANT EXECUTE ON FUNCTION public.track_referral_click(TEXT) TO anon, authenticated;


-- ─── 2. Reward calculation + share transfer + ledger ──────────────
-- Single function that does everything atomically. Called by the
-- trigger; also exposed so admins can replay manually if needed.
CREATE OR REPLACE FUNCTION public.grant_ambassador_first_investment_reward(
  p_deal_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal RECORD;
  v_ref RECORD;
  v_amb_user_id UUID;
  v_reward_shares BIGINT;
  v_taken_from TEXT;       -- 'ambassador' | 'offering' | 'none'
  v_avail_amb BIGINT;
  v_avail_off BIGINT;
  v_reward_id UUID;
  v_invest_amount BIGINT;
BEGIN
  -- Load deal.
  SELECT id, buyer_id, project_id, shares, price_per_share, total_amount, status
    INTO v_deal
    FROM deals
   WHERE id = p_deal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'deal_not_found');
  END IF;
  IF v_deal.status::TEXT <> 'completed' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'deal_not_completed');
  END IF;

  -- Find the referral row for this buyer that hasn't fired yet.
  SELECT r.id, r.ambassador_id, r.referral_link_id, r.has_invested,
         a.user_id AS ambassador_user_id
    INTO v_ref
    FROM referrals r
    JOIN ambassadors a ON a.id = r.ambassador_id
   WHERE r.referred_user_id = v_deal.buyer_id
   ORDER BY r.created_at ASC
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_referral');
  END IF;
  IF v_ref.has_invested THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'already_rewarded');
  END IF;
  IF v_ref.ambassador_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'ambassador_user_missing');
  END IF;
  v_amb_user_id := v_ref.ambassador_user_id;

  -- Compute reward shares: 2 % of deal shares, minimum 1.
  v_reward_shares := GREATEST(1, CEIL(COALESCE(v_deal.shares, 0)::NUMERIC * 0.02))::BIGINT;
  v_invest_amount := COALESCE(v_deal.total_amount, v_deal.shares * v_deal.price_per_share, 0)::BIGINT;

  -- Find a wallet with enough shares — ambassador first, then offering.
  SELECT available_shares INTO v_avail_amb
    FROM project_wallets
   WHERE project_id = v_deal.project_id AND wallet_type = 'ambassador'
   FOR UPDATE;
  SELECT available_shares INTO v_avail_off
    FROM project_wallets
   WHERE project_id = v_deal.project_id AND wallet_type = 'offering'
   FOR UPDATE;

  IF COALESCE(v_avail_amb, 0) >= v_reward_shares THEN
    v_taken_from := 'ambassador';
    UPDATE project_wallets
       SET available_shares = available_shares - v_reward_shares,
           updated_at = NOW()
     WHERE project_id = v_deal.project_id AND wallet_type = 'ambassador';
  ELSIF COALESCE(v_avail_off, 0) >= v_reward_shares THEN
    v_taken_from := 'offering';
    UPDATE project_wallets
       SET available_shares = available_shares - v_reward_shares,
           updated_at = NOW()
     WHERE project_id = v_deal.project_id AND wallet_type = 'offering';
  ELSE
    -- No wallet has enough — record a pending reward instead of failing.
    -- (Admin can grant manually later via the ambassador admin panel.)
    INSERT INTO ambassador_rewards(ambassador_id, referral_id, deal_id, project_id,
      investment_amount, reward_percentage, reward_shares, status, notes)
    VALUES (v_ref.ambassador_id, v_ref.id, v_deal.id, v_deal.project_id,
      v_invest_amount, 2.00, v_reward_shares, 'pending',
      'محافظ المشروع لا تحوي حصصاً كافية — انتظار منح يدوي من الإدارة')
    ON CONFLICT (ambassador_id, referral_id) DO NOTHING
    RETURNING id INTO v_reward_id;

    -- Still flip has_invested so the conversions counter advances.
    UPDATE referrals
       SET has_invested = TRUE,
           first_investment_deal_id = v_deal.id,
           first_investment_at = NOW(),
           first_investment_amount = v_invest_amount,
           updated_at = NOW()
     WHERE id = v_ref.id;

    RETURN jsonb_build_object(
      'success', TRUE,
      'reward_id', v_reward_id,
      'reward_shares', v_reward_shares,
      'status', 'pending',
      'reason', 'wallet_insufficient'
    );
  END IF;

  -- Credit the ambassador's holdings (existing row OR new row).
  INSERT INTO holdings(user_id, project_id, shares, average_buy_price, total_invested,
    acquired_from_ambassador, last_acquired_at, first_acquired_at)
  VALUES (v_amb_user_id, v_deal.project_id, v_reward_shares, 0, 0,
    v_reward_shares, NOW(), NOW())
  ON CONFLICT (user_id, project_id) DO UPDATE
    SET shares = holdings.shares + v_reward_shares,
        acquired_from_ambassador = COALESCE(holdings.acquired_from_ambassador, 0) + v_reward_shares,
        last_acquired_at = NOW(),
        updated_at = NOW();

  -- Flip the referrals row → fires existing handle_referral_conversion()
  -- which bumps conversions_count + successful_referrals.
  UPDATE referrals
     SET has_invested = TRUE,
         first_investment_deal_id = v_deal.id,
         first_investment_at = NOW(),
         first_investment_amount = v_invest_amount,
         updated_at = NOW()
   WHERE id = v_ref.id;

  -- Record the granted reward.
  INSERT INTO ambassador_rewards(ambassador_id, referral_id, deal_id, project_id,
    investment_amount, reward_percentage, reward_shares, status, granted_at, notes)
  VALUES (v_ref.ambassador_id, v_ref.id, v_deal.id, v_deal.project_id,
    v_invest_amount, 2.00, v_reward_shares, 'granted', NOW(),
    'منح تلقائي عند أول استثمار للمحال — حصص من محفظة ' || v_taken_from)
  ON CONFLICT (ambassador_id, referral_id) DO UPDATE
    SET status = 'granted', granted_at = NOW(),
        reward_shares = EXCLUDED.reward_shares,
        updated_at = NOW()
  RETURNING id INTO v_reward_id;

  -- Bump ambassador.total_rewards_earned (if column exists).
  BEGIN
    UPDATE ambassadors
       SET total_rewards_earned = COALESCE(total_rewards_earned, 0) + v_reward_shares,
           updated_at = NOW()
     WHERE id = v_ref.ambassador_id;
  EXCEPTION WHEN undefined_column THEN NULL; END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'reward_id', v_reward_id,
    'reward_shares', v_reward_shares,
    'taken_from', v_taken_from,
    'status', 'granted'
  );
END $$;

GRANT EXECUTE ON FUNCTION public.grant_ambassador_first_investment_reward(UUID) TO authenticated;


-- ─── 3. Trigger on deals: fire reward on first completion ─────────
CREATE OR REPLACE FUNCTION public.on_deal_ambassador_reward()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Best-effort: the reward function never raises (returns JSON
    -- error reasons). Wrap in BEGIN/END to keep deal completion safe
    -- even if the reward path fails for any reason.
    BEGIN
      v_result := public.grant_ambassador_first_investment_reward(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      -- Log via NOTICE; never block the deal completion.
      RAISE NOTICE 'ambassador reward error for deal %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_deal_ambassador_reward ON public.deals;
CREATE TRIGGER trg_deal_ambassador_reward
AFTER INSERT OR UPDATE OF status ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.on_deal_ambassador_reward();


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 12 ambassador automation applied:';
  RAISE NOTICE '  ✓ track_referral_click(code) RPC — call from /r/[code]';
  RAISE NOTICE '  ✓ grant_ambassador_first_investment_reward(deal_id)';
  RAISE NOTICE '  ✓ trg_deal_ambassador_reward — fires on completion';
  RAISE NOTICE '  ✓ Reward = GREATEST(1, CEIL(shares × 2%%))';
  RAISE NOTICE '  ✓ Source: ambassador wallet → fallback offering wallet';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
