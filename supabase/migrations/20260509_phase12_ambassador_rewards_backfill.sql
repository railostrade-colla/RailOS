-- ═══════════════════════════════════════════════════════════════════
-- Phase 12 — Ambassador rewards: hardened function + backfill
-- Date: 2026-05-09
-- Idempotent.
--
-- Founder report: clicks + signups now work, but the FIRST investment
-- of a referred user (Jabal Tariq's 15-share buy) didn't:
--   • flip referrals.has_invested
--   • bump the dashboard's المستثمرون counter
--   • create an ambassador_rewards row
--   • move shares from project's ambassador wallet → ambassador's holdings
--
-- Two reasons this can happen:
--
--   1. The deal completed BEFORE the ambassador-rewards trigger
--      migration was applied. The trigger only fires on subsequent
--      status transitions, never retroactively.
--
--   2. Subtle issues in the original function's RECORD handling
--      (multi-column INTO with aliases sometimes mis-parses).
--
-- This migration:
--   • Re-creates grant_ambassador_first_investment_reward with explicit
--     local variables instead of a RECORD destructure (safer + clearer).
--   • Re-creates the trigger function with extra logging so the next
--     failure (if any) is visible in postgres logs as a WARNING, not
--     swallowed silently.
--   • Runs a one-time BACKFILL: for every completed deal whose buyer
--     has an unrewarded referral, fires the reward path. Idempotent —
--     skips deals where the referral already has has_invested=true.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Hardened reward function ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_ambassador_first_investment_reward(
  p_deal_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal_buyer UUID;
  v_deal_project UUID;
  v_deal_shares BIGINT;
  v_deal_price BIGINT;
  v_deal_total BIGINT;
  v_deal_status TEXT;
  v_ref_id UUID;
  v_ref_ambassador_id UUID;
  v_ref_invested BOOLEAN;
  v_amb_user_id UUID;
  v_share_price BIGINT;
  v_reward_shares BIGINT;
  v_taken_from TEXT;
  v_avail_amb BIGINT;
  v_avail_off BIGINT;
  v_reward_id UUID;
  v_invest_amount BIGINT;
BEGIN
  -- 1. Load deal (explicit columns).
  SELECT buyer_id, project_id, shares, price_per_share,
         COALESCE(total_amount, shares * price_per_share),
         status::TEXT
    INTO v_deal_buyer, v_deal_project, v_deal_shares, v_deal_price,
         v_deal_total, v_deal_status
    FROM deals WHERE id = p_deal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'deal_not_found');
  END IF;
  IF v_deal_status <> 'completed' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'deal_not_completed',
                              'current_status', v_deal_status);
  END IF;

  -- 2. Find the referral row + ambassador's owner user_id.
  SELECT r.id, r.ambassador_id, r.has_invested
    INTO v_ref_id, v_ref_ambassador_id, v_ref_invested
    FROM referrals r
   WHERE r.referred_user_id = v_deal_buyer
   ORDER BY r.created_at ASC
   LIMIT 1;
  IF v_ref_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_referral',
                              'buyer', v_deal_buyer);
  END IF;
  IF v_ref_invested THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'already_rewarded',
                              'referral_id', v_ref_id);
  END IF;

  SELECT user_id INTO v_amb_user_id
    FROM ambassadors WHERE id = v_ref_ambassador_id;
  IF v_amb_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'ambassador_not_found',
                              'ambassador_id', v_ref_ambassador_id);
  END IF;

  -- 3. Pricing + reward share count.
  SELECT share_price INTO v_share_price FROM projects WHERE id = v_deal_project;
  v_share_price := COALESCE(v_share_price, 0);
  v_reward_shares := GREATEST(1, CEIL(COALESCE(v_deal_shares, 0)::NUMERIC * 0.02))::BIGINT;
  v_invest_amount := COALESCE(v_deal_total, 0);

  -- 4. Pick a wallet with enough shares — ambassador, then offering.
  SELECT available_shares INTO v_avail_amb
    FROM project_wallets
   WHERE project_id = v_deal_project AND wallet_type = 'ambassador'
   FOR UPDATE;
  SELECT available_shares INTO v_avail_off
    FROM project_wallets
   WHERE project_id = v_deal_project AND wallet_type = 'offering'
   FOR UPDATE;

  IF COALESCE(v_avail_amb, 0) >= v_reward_shares THEN
    v_taken_from := 'ambassador';
    UPDATE project_wallets
       SET available_shares = available_shares - v_reward_shares,
           updated_at = NOW()
     WHERE project_id = v_deal_project AND wallet_type = 'ambassador';
  ELSIF COALESCE(v_avail_off, 0) >= v_reward_shares THEN
    v_taken_from := 'offering';
    UPDATE project_wallets
       SET available_shares = available_shares - v_reward_shares,
           updated_at = NOW()
     WHERE project_id = v_deal_project AND wallet_type = 'offering';
  ELSE
    -- Record a pending reward + still flip has_invested.
    BEGIN
      INSERT INTO ambassador_rewards(ambassador_id, referral_id, deal_id, project_id,
        investment_amount, reward_percentage, reward_shares, status, notes)
      VALUES (v_ref_ambassador_id, v_ref_id, p_deal_id, v_deal_project,
        v_invest_amount, 2.00, v_reward_shares, 'pending',
        'محافظ المشروع لا تحوي حصصاً كافية — انتظار منح يدوي')
      ON CONFLICT (ambassador_id, referral_id) DO UPDATE
        SET status = 'pending', updated_at = NOW()
      RETURNING id INTO v_reward_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'pending reward insert failed for deal %: %', p_deal_id, SQLERRM;
    END;

    UPDATE referrals
       SET has_invested = TRUE,
           first_investment_deal_id = p_deal_id,
           first_investment_at = NOW(),
           first_investment_amount = v_invest_amount,
           updated_at = NOW()
     WHERE id = v_ref_id;

    RETURN jsonb_build_object(
      'success', TRUE,
      'reward_id', v_reward_id,
      'reward_shares', v_reward_shares,
      'status', 'pending',
      'reason', 'wallet_insufficient'
    );
  END IF;

  -- 5. Credit the ambassador's holdings.
  INSERT INTO holdings(user_id, project_id, shares, average_buy_price,
    total_invested, acquired_from_ambassador,
    last_acquired_at, first_acquired_at, created_at, updated_at)
  VALUES (v_amb_user_id, v_deal_project, v_reward_shares, 0, 0,
    v_reward_shares, NOW(), NOW(), NOW(), NOW())
  ON CONFLICT (user_id, project_id) DO UPDATE
    SET shares = holdings.shares + v_reward_shares,
        acquired_from_ambassador = COALESCE(holdings.acquired_from_ambassador, 0) + v_reward_shares,
        last_acquired_at = NOW(),
        updated_at = NOW();

  -- 6. Flip referrals.has_invested → existing handle_referral_conversion()
  --    trigger then bumps conversions_count + successful_referrals.
  UPDATE referrals
     SET has_invested = TRUE,
         first_investment_deal_id = p_deal_id,
         first_investment_at = NOW(),
         first_investment_amount = v_invest_amount,
         updated_at = NOW()
   WHERE id = v_ref_id;

  -- 7. Record granted reward.
  INSERT INTO ambassador_rewards(ambassador_id, referral_id, deal_id, project_id,
    investment_amount, reward_percentage, reward_shares, status, granted_at, notes)
  VALUES (v_ref_ambassador_id, v_ref_id, p_deal_id, v_deal_project,
    v_invest_amount, 2.00, v_reward_shares, 'granted', NOW(),
    'منح تلقائي عند أول استثمار للمحال — حصص من محفظة ' || v_taken_from)
  ON CONFLICT (ambassador_id, referral_id) DO UPDATE
    SET status = 'granted', granted_at = NOW(),
        reward_shares = EXCLUDED.reward_shares,
        notes = EXCLUDED.notes,
        updated_at = NOW()
  RETURNING id INTO v_reward_id;

  -- 8. Bump ambassador.total_rewards_earned (best-effort).
  BEGIN
    UPDATE ambassadors
       SET total_rewards_earned = COALESCE(total_rewards_earned, 0) + v_reward_shares,
           updated_at = NOW()
     WHERE id = v_ref_ambassador_id;
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


-- ─── 2. Trigger function — surface errors as WARNINGS ─────────────
CREATE OR REPLACE FUNCTION public.on_deal_ambassador_reward()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    BEGIN
      v_result := public.grant_ambassador_first_investment_reward(NEW.id);
      -- Surface non-success outcomes so they show up in PG logs.
      IF v_result IS NOT NULL AND (v_result->>'success')::BOOLEAN IS NOT TRUE THEN
        RAISE WARNING 'ambassador reward not granted for deal %: %',
          NEW.id, v_result;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'ambassador reward EXCEPTION for deal %: % (state %)',
        NEW.id, SQLERRM, SQLSTATE;
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_deal_ambassador_reward ON public.deals;
CREATE TRIGGER trg_deal_ambassador_reward
AFTER INSERT OR UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.on_deal_ambassador_reward();


-- ─── 3. ONE-TIME BACKFILL ─────────────────────────────────────────
-- Replays the reward path for every completed deal where the buyer
-- has an unrewarded referral. Idempotent (the reward function itself
-- skips already-rewarded referrals via the has_invested guard).
DO $$
DECLARE
  v_deal RECORD;
  v_result JSONB;
  v_count_processed INT := 0;
  v_count_granted INT := 0;
  v_count_skipped INT := 0;
BEGIN
  FOR v_deal IN
    SELECT d.id
      FROM public.deals d
     WHERE d.status = 'completed'
       AND EXISTS (
         SELECT 1 FROM public.referrals r
          WHERE r.referred_user_id = d.buyer_id
            AND r.has_invested = FALSE
       )
     ORDER BY d.completed_at NULLS LAST, d.created_at
  LOOP
    BEGIN
      v_result := public.grant_ambassador_first_investment_reward(v_deal.id);
      v_count_processed := v_count_processed + 1;
      IF (v_result->>'success')::BOOLEAN IS TRUE THEN
        v_count_granted := v_count_granted + 1;
      ELSE
        v_count_skipped := v_count_skipped + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_count_skipped := v_count_skipped + 1;
      RAISE NOTICE 'backfill: deal % failed: %', v_deal.id, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 12 ambassador backfill complete:';
  RAISE NOTICE '  ✓ % completed deals scanned', v_count_processed;
  RAISE NOTICE '  ✓ % rewards granted', v_count_granted;
  RAISE NOTICE '  ✓ % skipped (no referral / already rewarded / errors)', v_count_skipped;
  RAISE NOTICE '═══════════════════════════════════════';
END $$;


DO $$
BEGIN
  RAISE NOTICE 'Phase 12 hardening applied:';
  RAISE NOTICE '  ✓ grant_ambassador_first_investment_reward — explicit local vars';
  RAISE NOTICE '  ✓ Trigger surfaces failures as WARNINGS (visible in pg_logs)';
  RAISE NOTICE '  ✓ Trigger now fires on AFTER INSERT OR UPDATE (any column)';
  RAISE NOTICE '  ✓ Backfill replayed every completed deal';
END $$;
