-- ═══════════════════════════════════════════════════════════════════
-- Phase 9.2 — Quick Sale monthly subscription
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Converts the legacy "permanent" Quick-Sale subscription into a
-- 30-day rolling subscription with explicit renewal.
--
-- Highlights:
--   • Adds auto_renew + last_renewed_at columns (auto_renew kept
--     unused for now — wired by future cron/webhook).
--   • Backfills expires_at for existing active rows so they don't
--     stay "permanent" silently.
--   • New RPC subscribe_to_quick_sale_monthly() reads the balance
--     from fee_unit_balances first, falls back to profiles.
--     fee_units_balance for backwards compat (mirrors wallet.ts).
--   • Renewal STACKS — calling while still active extends the
--     existing expiry by +30 days.
--   • RLS on quick_sale_listings now requires expires_at > NOW().
--   • Helper is_quick_sale_active(uuid) for app-level checks.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Schema additions ─────────────────────────────────────
ALTER TABLE public.quick_sale_subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_renewed_at TIMESTAMPTZ;

-- Backfill: any existing active row without expires_at gets one set
-- to subscribed_at + 30 days. This converts legacy "permanent"
-- subscribers to the new monthly model fairly (their original 30 days
-- are honored from the moment they originally subscribed).
UPDATE public.quick_sale_subscriptions
SET
  expires_at      = COALESCE(subscribed_at, NOW()) + INTERVAL '30 days',
  last_renewed_at = COALESCE(subscribed_at, NOW())
WHERE expires_at IS NULL
  AND is_active = TRUE;

-- Index for fast active+unexpired lookups (used by RLS subqueries).
CREATE INDEX IF NOT EXISTS idx_qs_subs_active_unexpired
  ON public.quick_sale_subscriptions(user_id, expires_at)
  WHERE is_active = TRUE;

-- ─── 2. is_quick_sale_active helper ──────────────────────────
CREATE OR REPLACE FUNCTION public.is_quick_sale_active(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN FALSE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.quick_sale_subscriptions
    WHERE user_id = p_user_id
      AND is_active = TRUE
      AND expires_at IS NOT NULL
      AND expires_at > NOW()
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.is_quick_sale_active(UUID) TO authenticated;

-- ─── 3. Monthly subscribe / renew RPC ────────────────────────
CREATE OR REPLACE FUNCTION public.subscribe_to_quick_sale_monthly()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_cost CONSTANT BIGINT := 10000;
  v_balance BIGINT;
  v_balance_source TEXT := 'none';
  v_new_expires TIMESTAMPTZ;
  v_existing_expires TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  -- ── Read balance: try fee_unit_balances (canonical) first ──
  BEGIN
    SELECT balance INTO v_balance FROM public.fee_unit_balances
    WHERE user_id = v_uid FOR UPDATE;
    IF v_balance IS NOT NULL THEN
      v_balance_source := 'fee_unit_balances';
    END IF;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- Fallback to profiles.fee_units_balance (legacy column added by
  -- the old quick-sale migration). undefined_column on newer DBs.
  IF v_balance IS NULL THEN
    BEGIN
      SELECT fee_units_balance INTO v_balance FROM public.profiles
      WHERE id = v_uid FOR UPDATE;
      IF v_balance IS NOT NULL THEN
        v_balance_source := 'profiles';
      END IF;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;

  IF COALESCE(v_balance, 0) < v_cost THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'insufficient_balance',
      'required', v_cost,
      'balance', COALESCE(v_balance, 0)
    );
  END IF;

  -- ── Deduct from whichever source we read ──
  IF v_balance_source = 'fee_unit_balances' THEN
    UPDATE public.fee_unit_balances
    SET balance = balance - v_cost,
        total_withdrawn = total_withdrawn + v_cost,
        last_transaction_at = NOW()
    WHERE user_id = v_uid;

    -- Best-effort transaction log (existing helpers use this table)
    BEGIN
      INSERT INTO public.fee_unit_transactions (
        user_id, transaction_type, amount, balance_after,
        source_type, source_id, description
      ) VALUES (
        v_uid, 'withdrawal', -v_cost,
        (SELECT balance FROM public.fee_unit_balances WHERE user_id = v_uid),
        'manual', NULL, 'اشتراك البيع السريع — 30 يوم'
      );
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;

  ELSIF v_balance_source = 'profiles' THEN
    UPDATE public.profiles
    SET fee_units_balance = fee_units_balance - v_cost
    WHERE id = v_uid;
  END IF;

  -- ── Compute new expiry: stack on top of remaining time ──
  SELECT expires_at INTO v_existing_expires
  FROM public.quick_sale_subscriptions
  WHERE user_id = v_uid;

  v_new_expires := CASE
    WHEN v_existing_expires IS NOT NULL AND v_existing_expires > NOW()
      THEN v_existing_expires + INTERVAL '30 days'
    ELSE NOW() + INTERVAL '30 days'
  END;

  -- ── Upsert subscription ──
  INSERT INTO public.quick_sale_subscriptions (
    user_id, fee_paid, is_active, subscribed_at, expires_at, last_renewed_at
  ) VALUES (
    v_uid, v_cost, TRUE, NOW(), v_new_expires, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET is_active       = TRUE,
        expires_at      = EXCLUDED.expires_at,
        last_renewed_at = NOW(),
        fee_paid        = quick_sale_subscriptions.fee_paid + v_cost,
        cancelled_at    = NULL;

  -- ── Best-effort notification ──
  BEGIN
    PERFORM public.create_user_notification(
      v_uid,
      'system_announcement'::notification_type,
      '✅ تم تفعيل اشتراك البيع السريع',
      'اشتراكك صالح حتى ' || to_char(v_new_expires, 'YYYY-MM-DD'),
      'normal'::notification_priority
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'expires_at', v_new_expires,
    'balance_source', v_balance_source
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.subscribe_to_quick_sale_monthly() TO authenticated;

-- ─── 4. Tighten RLS to require unexpired subscription ────────
DROP POLICY IF EXISTS "Subscribers see all listings" ON public.quick_sale_listings;
CREATE POLICY "Subscribers see all listings" ON public.quick_sale_listings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quick_sale_subscriptions
      WHERE user_id = auth.uid()
        AND is_active = TRUE
        AND expires_at IS NOT NULL
        AND expires_at > NOW()
    )
  );

DROP POLICY IF EXISTS "Subscribers create listings" ON public.quick_sale_listings;
CREATE POLICY "Subscribers create listings" ON public.quick_sale_listings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.quick_sale_subscriptions
      WHERE user_id = auth.uid()
        AND is_active = TRUE
        AND expires_at IS NOT NULL
        AND expires_at > NOW()
    )
  );
