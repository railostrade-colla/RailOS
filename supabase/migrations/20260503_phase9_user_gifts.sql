-- ═══════════════════════════════════════════════════════════════════
-- Phase 9.6 — User gifts system (admin-granted, redeemable)
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Generic gift system: admins grant gifts to specific users, who can
-- then redeem them on their own time. The schema is gift-type-agnostic
-- (TEXT column) so future gift kinds (fee_units top-up, fee discount,
-- etc.) plug in without schema changes.
--
-- Only `free_contract` is wired through end-to-end in this migration:
--   • Admin grants the gift via admin_grant_gift()
--   • User redeems it on a specific partnership_contract via
--     redeem_free_contract_gift(contract_id) — sets a flag on the
--     contract row.
--   • end_partnership_contract() (Phase 6.2) is updated to skip the
--     end-fee deduction when the contract was gift-funded.
--
-- Backward-compatible: existing contracts have was_gift_redeemed=FALSE
-- by default, so the end-fee logic stays identical for them.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. user_gifts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_gifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gift_type TEXT NOT NULL,
  gift_value JSONB,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  used_target_id UUID,                      -- e.g. contract_id for free_contract
  expires_at TIMESTAMPTZ,                   -- NULL = no expiry
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_gifts_user
  ON public.user_gifts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_gifts_unused
  ON public.user_gifts(user_id, gift_type)
  WHERE is_used = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_gifts_granted_by
  ON public.user_gifts(granted_by);

COMMENT ON TABLE public.user_gifts IS
  'هدايا للمستخدمين — تُمنَح من الإدارة وتُستخدَم لاحقاً';

-- ─── 2. partnership_contracts.was_gift_redeemed ─────────────
ALTER TABLE public.partnership_contracts
  ADD COLUMN IF NOT EXISTS was_gift_redeemed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_partnership_contracts_gift_redeemed
  ON public.partnership_contracts(was_gift_redeemed)
  WHERE was_gift_redeemed = TRUE;

-- ─── 3. RLS ──────────────────────────────────────────────────
ALTER TABLE public.user_gifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own gifts" ON public.user_gifts;
CREATE POLICY "Users view own gifts"
ON public.user_gifts FOR SELECT
USING (user_id = auth.uid() OR public.is_admin());

-- INSERT/UPDATE go through SECURITY DEFINER RPCs only.

-- ═══════════════════════════════════════════════════════════════════
-- RPCs
-- ═══════════════════════════════════════════════════════════════════

-- ─── 4. RPC: admin_grant_gift ───────────────────────────────
-- Refuses self-grant (admin cannot grant a gift to themselves).
CREATE OR REPLACE FUNCTION public.admin_grant_gift(
  p_user_id UUID,
  p_gift_type TEXT,
  p_reason TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_gift_value JSONB DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_gift_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;
  IF p_user_id = v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cannot_grant_self');
  END IF;
  IF p_gift_type IS NULL OR length(trim(p_gift_type)) = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_gift_type');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'user_not_found');
  END IF;

  INSERT INTO public.user_gifts (
    user_id, gift_type, gift_value, granted_by,
    granted_reason, expires_at
  ) VALUES (
    p_user_id, p_gift_type, p_gift_value, v_uid,
    p_reason, p_expires_at
  )
  RETURNING id INTO v_gift_id;

  -- Notify the recipient (best-effort)
  BEGIN
    PERFORM public.create_user_notification(
      p_user_id,
      'system_announcement'::notification_type,
      '🎁 وصلتك هدية',
      CASE WHEN p_gift_type = 'free_contract'
           THEN 'هدية: عقد جماعي مجاني — استخدمها عند إنشاء عقد جديد'
           ELSE 'هدية جديدة من الإدارة — راجع تفاصيلها' END,
      'normal'::notification_priority
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', TRUE, 'gift_id', v_gift_id);
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_grant_gift(
  UUID, TEXT, TEXT, TIMESTAMPTZ, JSONB
) TO authenticated;

-- ─── 5. RPC: admin_revoke_gift ──────────────────────────────
-- Removes an unredeemed gift.
CREATE OR REPLACE FUNCTION public.admin_revoke_gift(p_gift_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used BOOLEAN;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  SELECT is_used INTO v_used FROM public.user_gifts
  WHERE id = p_gift_id FOR UPDATE;

  IF v_used IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_used THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'already_redeemed');
  END IF;

  DELETE FROM public.user_gifts WHERE id = p_gift_id;
  RETURN jsonb_build_object('success', TRUE);
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_revoke_gift(UUID) TO authenticated;

-- ─── 6. RPC: redeem_free_contract_gift ──────────────────────
-- The user calls this AFTER createContract returns a contract_id.
-- It marks one of their unused free_contract gifts as used + flags
-- the contract row so the end-fee deduction is skipped later.
CREATE OR REPLACE FUNCTION public.redeem_free_contract_gift(
  p_contract_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_gift_id UUID;
  v_creator UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  -- Caller must own the contract (be the creator).
  SELECT creator_id INTO v_creator FROM public.partnership_contracts
  WHERE id = p_contract_id FOR UPDATE;
  IF v_creator IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'contract_not_found');
  END IF;
  IF v_creator <> v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_creator');
  END IF;

  -- Pick one unused, unexpired free_contract gift owned by the user.
  SELECT id INTO v_gift_id
  FROM public.user_gifts
  WHERE user_id = v_uid
    AND gift_type = 'free_contract'
    AND is_used = FALSE
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_gift_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_gift_available');
  END IF;

  -- Burn the gift + mark the contract.
  UPDATE public.user_gifts
  SET is_used = TRUE,
      used_at = NOW(),
      used_target_id = p_contract_id
  WHERE id = v_gift_id;

  UPDATE public.partnership_contracts
  SET was_gift_redeemed = TRUE,
      updated_at = NOW()
  WHERE id = p_contract_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'gift_id', v_gift_id,
    'contract_id', p_contract_id
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.redeem_free_contract_gift(UUID) TO authenticated;

-- ─── 7. Patch end_partnership_contract to honor the gift flag ──
-- Re-creates the function with the same signature; the only change
-- is the new check at the top that zeros the fee for gift-funded
-- contracts. Idempotent — safe to re-run.
CREATE OR REPLACE FUNCTION public.end_partnership_contract(
  p_contract_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_contract RECORD;
  v_fee BIGINT;
  v_new_balance BIGINT;
  v_was_gifted BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT * INTO v_contract FROM public.partnership_contracts
  WHERE id = p_contract_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_contract.creator_id <> v_uid AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_owner');
  END IF;
  IF v_contract.status <> 'active' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'not_active',
      'current_status', v_contract.status
    );
  END IF;

  -- Phase 9.6: gift-funded contracts skip the end fee entirely.
  -- Older rows (no gift) preserve the existing 10% deduction.
  v_was_gifted := COALESCE(v_contract.was_gift_redeemed, FALSE);
  IF v_was_gifted THEN
    v_fee := 0;
  ELSE
    v_fee := FLOOR(v_contract.total_investment * (v_contract.end_fee_pct / 100));
  END IF;

  -- Best-effort balance deduction (skipped when fee is zero).
  IF v_fee > 0 THEN
    BEGIN
      UPDATE public.fee_unit_balances
      SET balance = balance - v_fee,
          total_withdrawn = total_withdrawn + v_fee,
          last_transaction_at = NOW()
      WHERE user_id = v_contract.creator_id AND balance >= v_fee
      RETURNING balance INTO v_new_balance;

      IF v_new_balance IS NOT NULL THEN
        INSERT INTO public.fee_unit_transactions (
          user_id, transaction_type, amount, balance_after,
          source_type, source_id, description, executed_by
        ) VALUES (
          v_contract.creator_id, 'withdrawal', -v_fee, v_new_balance,
          'manual', p_contract_id,
          'رسوم إنهاء عقد الشراكة', v_uid
        );
      END IF;
    EXCEPTION WHEN undefined_table THEN
      NULL; -- fee_unit_* not yet migrated — proceed without deduction
    END;
  END IF;

  UPDATE public.partnership_contracts
  SET status = 'ended',
      ended_at = NOW(),
      updated_at = NOW()
  WHERE id = p_contract_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'fee_deducted', COALESCE(v_fee, 0),
    'new_balance', v_new_balance,
    'gift_funded', v_was_gifted
  );
END
$$;
