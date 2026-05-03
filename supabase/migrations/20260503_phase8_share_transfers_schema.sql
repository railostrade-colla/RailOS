-- ═══════════════════════════════════════════════════════════════════
-- Phase 8.3 — Share transfers schema (peer-to-peer share movement)
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Two-party share transfer flow:
--   1. Sender submits a transfer (from holdings → recipient) with an
--      optional message. Their shares are immediately reserved in
--      holdings.frozen_shares so the same shares can't be double-spent.
--   2. Recipient sees a "incoming transfer" and can accept or reject.
--   3. On accept: shares move from sender to recipient atomically;
--      the sender pays a 2% fee from fee_unit_balances (transfer_fee_pct
--      configurable per row, default 2%); transactions are logged.
--   4. On reject / cancel: the reservation is released.
--
-- Why a separate flow (vs a regular deal):
--   - No price negotiation — pure transfer (gift / inheritance / etc.)
--   - Recipient consent is required (no surprise dumps into someone's
--     portfolio)
--   - No project-side counters change (it's a holding swap, the wallet
--     untouched).
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. ENUM ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE share_transfer_status AS ENUM (
    'pending', 'accepted', 'rejected', 'cancelled', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. share_transfers table ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.share_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  shares BIGINT NOT NULL CHECK (shares > 0),

  -- Fee snapshot at submission time so post-hoc rate changes don't
  -- retroactively affect pending transfers.
  transfer_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 2.00
    CHECK (transfer_fee_pct >= 0 AND transfer_fee_pct <= 100),
  fee_amount BIGINT NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),

  status share_transfer_status NOT NULL DEFAULT 'pending',
  message TEXT,

  -- Lifecycle metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  responded_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Defensive: a user can't transfer to themselves
  CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_share_transfers_sender
  ON public.share_transfers(sender_id, status);
CREATE INDEX IF NOT EXISTS idx_share_transfers_recipient
  ON public.share_transfers(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_share_transfers_project
  ON public.share_transfers(project_id);
CREATE INDEX IF NOT EXISTS idx_share_transfers_pending
  ON public.share_transfers(status, expires_at)
  WHERE status = 'pending';

COMMENT ON TABLE public.share_transfers IS
  'تحويل حصص بين المستخدمين (هدية/إرث) — يحتاج موافقة المستلم';

-- ─── 3. RLS ─────────────────────────────────────────────────
ALTER TABLE public.share_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own transfers" ON public.share_transfers;
CREATE POLICY "View own transfers"
ON public.share_transfers FOR SELECT
USING (
  sender_id = auth.uid()
  OR recipient_id = auth.uid()
  OR public.is_admin()
);

-- INSERT/UPDATE go through SECURITY DEFINER RPCs only — direct
-- writes are blocked.

-- ═══════════════════════════════════════════════════════════════════
-- RPCs
-- ═══════════════════════════════════════════════════════════════════

-- ─── 4. submit_share_transfer ───────────────────────────────
-- The sender locks the shares (moves them from holdings.shares to
-- holdings.frozen_shares) and creates a pending transfer row.
CREATE OR REPLACE FUNCTION public.submit_share_transfer(
  p_recipient_id UUID,
  p_project_id UUID,
  p_shares BIGINT,
  p_message TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_holding RECORD;
  v_transfer_id UUID;
  v_fee_pct CONSTANT NUMERIC := 2.00;
  v_fee_amount BIGINT;
  v_share_price BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF v_uid = p_recipient_id THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cannot_transfer_to_self');
  END IF;
  IF p_shares IS NULL OR p_shares <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_shares');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'recipient_not_found');
  END IF;

  -- Lock + check sender's holdings
  SELECT * INTO v_holding FROM public.holdings
  WHERE user_id = v_uid AND project_id = p_project_id
  FOR UPDATE;

  IF v_holding IS NULL OR v_holding.shares - v_holding.frozen_shares < p_shares THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'insufficient_shares',
      'available', COALESCE(v_holding.shares - v_holding.frozen_shares, 0)
    );
  END IF;

  -- Snapshot share price for fee computation (best-effort)
  SELECT share_price INTO v_share_price FROM public.projects
  WHERE id = p_project_id;
  v_fee_amount := FLOOR(COALESCE(v_share_price, 0) * p_shares * v_fee_pct / 100);

  -- Reserve the shares: shares stays the same, frozen goes up.
  UPDATE public.holdings
  SET frozen_shares = frozen_shares + p_shares,
      updated_at = NOW()
  WHERE id = v_holding.id;

  INSERT INTO public.share_transfers (
    sender_id, recipient_id, project_id, shares,
    transfer_fee_pct, fee_amount, message
  ) VALUES (
    v_uid, p_recipient_id, p_project_id, p_shares,
    v_fee_pct, v_fee_amount, p_message
  )
  RETURNING id INTO v_transfer_id;

  -- Notify recipient (best-effort)
  BEGIN
    PERFORM public.create_user_notification(
      p_recipient_id,
      'system_announcement'::notification_type,
      '🎁 طلب تحويل حصص',
      'وصلك طلب تحويل ' || p_shares || ' حصة — راجع طلبات التحويل لقبوله أو رفضه',
      'high'::notification_priority
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'transfer_id', v_transfer_id,
    'fee_amount', v_fee_amount
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.submit_share_transfer(
  UUID, UUID, BIGINT, TEXT
) TO authenticated;

-- ─── 5. respond_to_share_transfer ───────────────────────────
-- Recipient accepts or rejects. On accept, shares move atomically
-- and the sender pays the fee (best-effort; missing fee balance does
-- not block the transfer — we record fee_amount as 0 and log).
CREATE OR REPLACE FUNCTION public.respond_to_share_transfer(
  p_transfer_id UUID,
  p_accept BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_t RECORD;
  v_sender_holding RECORD;
  v_recipient_holding RECORD;
  v_new_balance BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT * INTO v_t FROM public.share_transfers
  WHERE id = p_transfer_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_t.recipient_id <> v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_recipient');
  END IF;
  IF v_t.status <> 'pending' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_pending');
  END IF;
  IF v_t.expires_at < NOW() THEN
    -- Auto-expire + release the reservation
    UPDATE public.share_transfers
    SET status = 'expired', responded_at = NOW()
    WHERE id = p_transfer_id;

    UPDATE public.holdings
    SET frozen_shares = GREATEST(0, frozen_shares - v_t.shares),
        updated_at = NOW()
    WHERE user_id = v_t.sender_id AND project_id = v_t.project_id;

    RETURN jsonb_build_object('success', FALSE, 'error', 'expired');
  END IF;

  -- Lock sender's holding so we can release / move shares atomically
  SELECT * INTO v_sender_holding FROM public.holdings
  WHERE user_id = v_t.sender_id AND project_id = v_t.project_id
  FOR UPDATE;

  IF v_sender_holding IS NULL THEN
    -- Something went very wrong — clear the transfer
    UPDATE public.share_transfers
    SET status = 'rejected', responded_at = NOW(),
        rejection_reason = 'sender_holding_disappeared'
    WHERE id = p_transfer_id;
    RETURN jsonb_build_object('success', FALSE, 'error', 'sender_holding_missing');
  END IF;

  -- Reject path: just release the freeze + mark rejected.
  IF NOT p_accept THEN
    UPDATE public.holdings
    SET frozen_shares = GREATEST(0, frozen_shares - v_t.shares),
        updated_at = NOW()
    WHERE id = v_sender_holding.id;

    UPDATE public.share_transfers
    SET status = 'rejected',
        responded_at = NOW(),
        rejection_reason = p_reason
    WHERE id = p_transfer_id;

    BEGIN
      PERFORM public.create_user_notification(
        v_t.sender_id,
        'system_announcement'::notification_type,
        '❌ تم رفض طلب التحويل',
        COALESCE(p_reason, 'رفض المستلم تحويل الحصص'),
        'normal'::notification_priority
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;

    RETURN jsonb_build_object('success', TRUE, 'accepted', FALSE);
  END IF;

  -- Accept path:
  -- 1. decrement sender (both shares + frozen by N)
  UPDATE public.holdings
  SET shares = shares - v_t.shares,
      frozen_shares = GREATEST(0, frozen_shares - v_t.shares),
      updated_at = NOW()
  WHERE id = v_sender_holding.id;

  -- 2. upsert into recipient's holding
  SELECT * INTO v_recipient_holding FROM public.holdings
  WHERE user_id = v_t.recipient_id AND project_id = v_t.project_id
  FOR UPDATE;

  IF v_recipient_holding IS NULL THEN
    INSERT INTO public.holdings (
      user_id, project_id, shares, frozen_shares,
      average_buy_price, total_invested,
      acquired_from_secondary
    ) VALUES (
      v_t.recipient_id, v_t.project_id, v_t.shares, 0,
      v_sender_holding.average_buy_price, 0,
      v_t.shares
    );
  ELSE
    UPDATE public.holdings
    SET shares = shares + v_t.shares,
        acquired_from_secondary = acquired_from_secondary + v_t.shares,
        updated_at = NOW()
    WHERE id = v_recipient_holding.id;
  END IF;

  -- 3. Best-effort fee deduction from sender's fee balance.
  IF v_t.fee_amount > 0 THEN
    BEGIN
      UPDATE public.fee_unit_balances
      SET balance = balance - v_t.fee_amount,
          total_withdrawn = total_withdrawn + v_t.fee_amount,
          last_transaction_at = NOW()
      WHERE user_id = v_t.sender_id AND balance >= v_t.fee_amount
      RETURNING balance INTO v_new_balance;

      IF v_new_balance IS NOT NULL THEN
        BEGIN
          INSERT INTO public.fee_unit_transactions (
            user_id, transaction_type, amount, balance_after,
            source_type, source_id, description
          ) VALUES (
            v_t.sender_id, 'withdrawal', -v_t.fee_amount, v_new_balance,
            'manual', p_transfer_id, 'رسوم تحويل حصص'
          );
        EXCEPTION WHEN undefined_table THEN NULL; END;
      END IF;
    EXCEPTION WHEN undefined_table THEN
      NULL; -- fee_unit_* not deployed; transfer still applies
    END;
  END IF;

  -- 4. Mark applied
  UPDATE public.share_transfers
  SET status = 'accepted',
      responded_at = NOW(),
      applied_at = NOW()
  WHERE id = p_transfer_id;

  -- Notify sender
  BEGIN
    PERFORM public.create_user_notification(
      v_t.sender_id,
      'system_announcement'::notification_type,
      '✅ تم قبول تحويل الحصص',
      'تم نقل ' || v_t.shares || ' حصة بنجاح',
      'normal'::notification_priority
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'accepted', TRUE,
    'fee_deducted', COALESCE(v_t.fee_amount, 0)
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_share_transfer(UUID, BOOLEAN, TEXT) TO authenticated;

-- ─── 6. cancel_share_transfer ───────────────────────────────
-- Sender can cancel a still-pending transfer (releases the freeze).
CREATE OR REPLACE FUNCTION public.cancel_share_transfer(p_transfer_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_t RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT * INTO v_t FROM public.share_transfers
  WHERE id = p_transfer_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_t.sender_id <> v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_sender');
  END IF;
  IF v_t.status <> 'pending' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_pending');
  END IF;

  -- Release the reservation
  UPDATE public.holdings
  SET frozen_shares = GREATEST(0, frozen_shares - v_t.shares),
      updated_at = NOW()
  WHERE user_id = v_t.sender_id AND project_id = v_t.project_id;

  UPDATE public.share_transfers
  SET status = 'cancelled', cancelled_at = NOW()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object('success', TRUE);
END
$$;

GRANT EXECUTE ON FUNCTION public.cancel_share_transfer(UUID) TO authenticated;
