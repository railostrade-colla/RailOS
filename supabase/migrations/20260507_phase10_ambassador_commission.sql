-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.86 — Runtime ambassador commission (2% on first investment)
-- Date: 2026-05-07
-- Idempotent: safe to re-run.
--
-- Replaces the old "ambassador wallet bucket" model. The new flow:
--
--   • The form-creation step no longer pre-allocates an ambassador
--     percentage (Phase 10.86 UI change). Ambassador wallets created
--     on existing projects stay around but receive nothing new.
--
--   • Whenever a deal flips to status='completed' (i.e. shares
--     actually land in a buyer's holdings), this migration's trigger
--     checks whether the buyer was referred by an ambassador AND
--     whether that buyer has already triggered a commission before.
--
--   • If both checks pass, the trigger:
--       1. Computes 2% of the buyer's investment value.
--       2. Converts that to whole shares at the deal's price_per_share.
--       3. Pulls those shares from the project's OFFERING wallet
--          (the public float — same source the buyer just bought from).
--       4. Drops them into the ambassador's holdings (creating or
--          incrementing).
--       5. Inserts a row in `ambassador_commissions`. The UNIQUE
--          constraint on `referred_user_id` enforces "one-time per
--          new investor, globally" — so subsequent investments by
--          the same investor (or any future deals) never re-pay.
--       6. Notifies the ambassador.
--
--   • All the work runs INSIDE a savepoint-style BEGIN/EXCEPTION
--     block, so a commission failure (insufficient offering, missing
--     ambassador, etc.) NEVER breaks the underlying deal completion.
--
-- Why a trigger instead of inlining into admin_confirm_deal_payment:
--   • Keeps the existing RPC body untouched.
--   • Future paths that complete deals (eg. user-initiated quick-sell
--     auto-completion) will inherit the commission logic for free.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Schema: ambassador_commissions ───────────────────────────
CREATE TABLE IF NOT EXISTS public.ambassador_commissions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The newly-invested user. UNIQUE → one-time per user globally.
  referred_user_id   UUID NOT NULL UNIQUE
                     REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- The ambassador's profile id (= ambassadors.user_id).
  ambassador_user_id UUID NOT NULL
                     REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- The ambassador row itself (nullable — keeps history if amb deleted).
  ambassador_id      UUID
                     REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  project_id         UUID NOT NULL
                     REFERENCES public.projects(id) ON DELETE CASCADE,
  trigger_deal_id    UUID
                     REFERENCES public.deals(id) ON DELETE SET NULL,
  -- Deal details (cached so we keep history even after deal/project edit)
  investment_value   NUMERIC(18,2) NOT NULL,
  commission_value   NUMERIC(18,2) NOT NULL,
  shares_granted     BIGINT NOT NULL,
  share_price        NUMERIC(18,2) NOT NULL,
  granted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_amb_commissions_ambassador
  ON public.ambassador_commissions(ambassador_user_id, granted_at DESC);
CREATE INDEX IF NOT EXISTS idx_amb_commissions_project
  ON public.ambassador_commissions(project_id, granted_at DESC);


-- ─── 2. RLS policies ─────────────────────────────────────────────
ALTER TABLE public.ambassador_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "amb_commissions_self_read"        ON public.ambassador_commissions;
DROP POLICY IF EXISTS "amb_commissions_admin_read"       ON public.ambassador_commissions;

-- Ambassador can see their own commissions.
CREATE POLICY "amb_commissions_self_read"
  ON public.ambassador_commissions
  FOR SELECT
  TO authenticated
  USING (ambassador_user_id = auth.uid());

-- Admins see all.
CREATE POLICY "amb_commissions_admin_read"
  ON public.ambassador_commissions
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Writes only via the SECURITY DEFINER trigger function — no INSERT/
-- UPDATE/DELETE policies for end users. Service-role bypasses RLS.


-- ─── 3. Worker function: pay commission for one deal ─────────────
CREATE OR REPLACE FUNCTION public.pay_ambassador_commission(p_deal_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal             RECORD;
  v_amb_id           UUID;
  v_referrer_uid     UUID;
  v_amb_active       BOOLEAN;
  v_already          UUID;
  v_value            NUMERIC;
  v_commission       NUMERIC;
  v_share_price      NUMERIC;
  v_shares_to_grant  BIGINT;
  v_offering         RECORD;
  v_amb_holding      RECORD;
BEGIN
  -- Pull the deal.
  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id;
  IF v_deal.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'deal_not_found');
  END IF;
  IF v_deal.status::TEXT <> 'completed' THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'deal_not_completed');
  END IF;

  -- Find the buyer's ambassador via the referrals table.
  SELECT r.ambassador_id, a.user_id, a.is_active
    INTO v_amb_id, v_referrer_uid, v_amb_active
  FROM public.referrals r
  JOIN public.ambassadors a ON a.id = r.ambassador_id
  WHERE r.referred_user_id = v_deal.buyer_id
  ORDER BY r.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_referrer_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'no_ambassador');
  END IF;
  IF v_amb_active IS NOT TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'ambassador_inactive');
  END IF;
  IF v_referrer_uid = v_deal.buyer_id THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'self_referral');
  END IF;

  -- Already granted? (UNIQUE on referred_user_id also enforces this).
  SELECT id INTO v_already
  FROM public.ambassador_commissions
  WHERE referred_user_id = v_deal.buyer_id;
  IF v_already IS NOT NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'already_granted');
  END IF;

  -- Compute commission shares.
  v_value := COALESCE(v_deal.total_amount,
                      v_deal.shares * v_deal.price_per_share, 0);
  v_share_price := v_deal.price_per_share;

  IF v_value <= 0 OR v_share_price IS NULL OR v_share_price <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'invalid_value');
  END IF;

  v_commission := v_value * 0.02;
  v_shares_to_grant := FLOOR(v_commission / v_share_price);

  IF v_shares_to_grant <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'rounded_to_zero',
                              'commission_value', v_commission);
  END IF;

  -- Lock the offering wallet.
  SELECT * INTO v_offering FROM public.project_wallets
  WHERE project_id = v_deal.project_id AND wallet_type = 'offering'
  FOR UPDATE;

  IF v_offering.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'no_offering_wallet');
  END IF;
  IF v_offering.status::TEXT = 'frozen' THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'offering_frozen');
  END IF;
  IF v_offering.available_shares < v_shares_to_grant THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'insufficient_offering',
                              'available', v_offering.available_shares,
                              'needed', v_shares_to_grant);
  END IF;

  -- Pull from offering.
  UPDATE public.project_wallets
     SET available_shares = available_shares - v_shares_to_grant,
         total_shares     = GREATEST(0, total_shares - v_shares_to_grant),
         sold_shares      = COALESCE(sold_shares, 0) + v_shares_to_grant,
         updated_at       = NOW()
   WHERE id = v_offering.id;

  -- Push into ambassador's holdings.
  SELECT * INTO v_amb_holding FROM public.holdings
  WHERE user_id = v_referrer_uid AND project_id = v_deal.project_id
  FOR UPDATE;

  IF v_amb_holding.id IS NULL THEN
    INSERT INTO public.holdings (
      user_id, project_id, shares, frozen_shares,
      average_buy_price, total_invested,
      acquired_from_offering, acquired_from_secondary,
      first_acquired_at, last_acquired_at
    ) VALUES (
      v_referrer_uid, v_deal.project_id, v_shares_to_grant, 0,
      v_share_price, 0,                             -- gift, so total_invested=0
      v_shares_to_grant, 0,
      NOW(), NOW()
    );
  ELSE
    -- Treat the gift as zero-cost: keeps avg_buy_price unchanged.
    UPDATE public.holdings
       SET shares = shares + v_shares_to_grant,
           acquired_from_offering = COALESCE(acquired_from_offering, 0) + v_shares_to_grant,
           last_acquired_at = NOW(),
           updated_at = NOW()
     WHERE id = v_amb_holding.id;
  END IF;

  -- Persist the commission record (UNIQUE referred_user_id locks future).
  INSERT INTO public.ambassador_commissions (
    referred_user_id, ambassador_user_id, ambassador_id, project_id,
    trigger_deal_id, investment_value, commission_value,
    shares_granted, share_price
  ) VALUES (
    v_deal.buyer_id, v_referrer_uid, v_amb_id, v_deal.project_id,
    p_deal_id, v_value, v_commission,
    v_shares_to_grant, v_share_price
  );

  -- Notify ambassador (best-effort).
  BEGIN
    PERFORM public.create_user_notification(
      v_referrer_uid, 'system_announcement'::notification_type,
      '🎁 عمولة سفير',
      'استلمت ' || v_shares_to_grant::TEXT
        || ' حصة (2% من استثمار مستثمر جديد عبر رابطك)',
      'high'::notification_priority,
      '/portfolio'
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Audit (best-effort).
  BEGIN
    PERFORM public.log_admin_action(
      'pay_ambassador_commission', 'deal', p_deal_id,
      jsonb_build_object(
        'ambassador_user_id', v_referrer_uid,
        'referred_user_id',   v_deal.buyer_id,
        'project_id',         v_deal.project_id,
        'investment_value',   v_value,
        'commission_value',   v_commission,
        'shares_granted',     v_shares_to_grant,
        'share_price',        v_share_price
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success',           TRUE,
    'shares_granted',    v_shares_to_grant,
    'commission_value',  v_commission,
    'ambassador_user_id', v_referrer_uid
  );
END
$$;

REVOKE ALL ON FUNCTION public.pay_ambassador_commission(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_ambassador_commission(UUID) TO authenticated;


-- ─── 4. Trigger: fire commission on deal completion ──────────────
CREATE OR REPLACE FUNCTION public.fn_pay_ambassador_commission_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Only when status TRANSITIONS to 'completed'.
  IF NEW.status::TEXT = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status::TEXT IS DISTINCT FROM 'completed')
  THEN
    BEGIN
      v_result := public.pay_ambassador_commission(NEW.id);
      -- Non-fatal: log notice if it didn't actually pay.
      IF NOT COALESCE((v_result->>'success')::BOOLEAN, FALSE) THEN
        RAISE NOTICE 'ambassador commission skipped for deal %: %',
                     NEW.id, v_result->>'reason';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Hard exception: don't break the deal completion.
      RAISE NOTICE 'ambassador commission threw for deal %: %',
                   NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_pay_ambassador_commission ON public.deals;
CREATE TRIGGER trg_pay_ambassador_commission
  AFTER INSERT OR UPDATE OF status ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_pay_ambassador_commission_trg();


-- ─── 5. Realtime: publish so ambassador's portfolio updates live ──
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ambassador_commissions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;


-- ─── Done ────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.86 applied:';
  RAISE NOTICE '  ✓ ambassador_commissions table + RLS';
  RAISE NOTICE '  ✓ pay_ambassador_commission(deal_id) RPC';
  RAISE NOTICE '  ✓ trigger trg_pay_ambassador_commission on deals';
  RAISE NOTICE '  ✓ 2%% of investment paid in shares from offering wallet,';
  RAISE NOTICE '    one-time per investor, globally — no UI change needed.';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
