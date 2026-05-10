-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.41 — admin_move_shares: unified 4-way wallet move
-- Date: 2026-05-10
-- Idempotent.
--
-- Founder spec: the wallet management modal needs to move shares
-- between any pair of these four "buckets":
--
--      ┌─────────┐         ┌──────────┐         ┌─────────┐
--      │  OWNER  │ ◀─────▶ │ OFFERING │ ◀─────▶ │ RESERVE │
--      └─────────┘         └──────────┘         └─────────┘
--                            ▲      │
--                            └──────┘
--                       (any pair, any direction)
--
-- Rules:
--   • OWNER is virtual: owner_shares = projects.total_shares
--                     − SUM(wallet.total_shares for this project)
--     so moving "to owner" means deleting from a wallet without
--     creating a new wallet row, and "from owner" means creating
--     wallet rows / topping up an existing one.
--   • OFFERING / RESERVE / AMBASSADOR are real rows in
--     project_wallets, distinguished by wallet_type.
--   • The destination wallet is auto-created if missing (matches
--     the create-project default behaviour).
--   • The total of all wallets + owner_shares is always equal to
--     projects.total_shares (an invariant the RPC enforces).
-- ═══════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION public.admin_move_shares(
  p_project_id UUID,
  p_from       TEXT,        -- 'owner' | 'offering' | 'reserve' | 'ambassador'
  p_to         TEXT,        -- same vocabulary
  p_amount     BIGINT,
  p_reason     TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid                    UUID := auth.uid();
  v_role                   TEXT;
  v_total_shares           BIGINT;
  v_wallet_sum             BIGINT;
  v_owner_shares           BIGINT;
  v_src_total              BIGINT;
  v_src_available          BIGINT;
  v_dst_exists             BOOLEAN;
  v_src_exists             BOOLEAN;
  v_dst_total_after        BIGINT;
  v_dst_available_after    BIGINT;
BEGIN
  -- ─── Auth ───────────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  -- ─── Validate inputs ─────────────────────────────────────────────
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_amount');
  END IF;
  IF p_from = p_to THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'same_source_and_destination');
  END IF;
  IF p_from NOT IN ('owner','offering','reserve','ambassador')
     OR p_to NOT IN ('owner','offering','reserve','ambassador') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_bucket');
  END IF;

  -- ─── Lock project + compute owner_shares ────────────────────────
  SELECT total_shares INTO v_total_shares
    FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF v_total_shares IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'project_not_found');
  END IF;

  SELECT COALESCE(SUM(total_shares), 0) INTO v_wallet_sum
    FROM public.project_wallets WHERE project_id = p_project_id;
  v_owner_shares := GREATEST(0, v_total_shares - v_wallet_sum);

  -- ─── Source check ────────────────────────────────────────────────
  IF p_from = 'owner' THEN
    IF v_owner_shares < p_amount THEN
      RETURN jsonb_build_object(
        'success', FALSE, 'error', 'insufficient_owner_shares',
        'available', v_owner_shares
      );
    END IF;
  ELSE
    SELECT total_shares, available_shares
      INTO v_src_total, v_src_available
      FROM public.project_wallets
     WHERE project_id = p_project_id AND wallet_type = p_from
     FOR UPDATE;
    v_src_exists := FOUND;
    IF NOT v_src_exists THEN
      RETURN jsonb_build_object(
        'success', FALSE, 'error', 'source_wallet_missing',
        'wallet', p_from
      );
    END IF;
    -- Move only AVAILABLE (unsold) shares — sold shares belong to
    -- holders and can't be moved between system wallets.
    IF COALESCE(v_src_available, 0) < p_amount THEN
      RETURN jsonb_build_object(
        'success', FALSE, 'error', 'insufficient_source_shares',
        'available', COALESCE(v_src_available, 0)
      );
    END IF;
  END IF;

  -- ─── Apply: source ──────────────────────────────────────────────
  IF p_from <> 'owner' THEN
    UPDATE public.project_wallets
       SET total_shares     = total_shares - p_amount,
           available_shares = available_shares - p_amount,
           updated_at       = NOW()
     WHERE project_id = p_project_id AND wallet_type = p_from;
  END IF;

  -- ─── Apply: destination ─────────────────────────────────────────
  IF p_to <> 'owner' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.project_wallets
       WHERE project_id = p_project_id AND wallet_type = p_to
    ) INTO v_dst_exists;

    IF v_dst_exists THEN
      UPDATE public.project_wallets
         SET total_shares     = total_shares + p_amount,
             available_shares = available_shares + p_amount,
             updated_at       = NOW()
       WHERE project_id = p_project_id AND wallet_type = p_to
       RETURNING total_shares, available_shares
            INTO v_dst_total_after, v_dst_available_after;
    ELSE
      INSERT INTO public.project_wallets(
        project_id, wallet_type, total_shares, available_shares, status
      ) VALUES (
        p_project_id, p_to, p_amount, p_amount, 'active'
      )
      RETURNING total_shares, available_shares
           INTO v_dst_total_after, v_dst_available_after;
    END IF;
  END IF;

  -- ─── Audit ──────────────────────────────────────────────────────
  BEGIN
    PERFORM public.log_admin_action(
      'move_shares', 'project', p_project_id,
      jsonb_build_object(
        'amount', p_amount,
        'from', p_from,
        'to', p_to,
        'reason', p_reason,
        'owner_shares_before', v_owner_shares
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- ─── Return ─────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'success', TRUE,
    'amount', p_amount,
    'from', p_from,
    'to', p_to,
    'destination_total_after', v_dst_total_after,
    'destination_available_after', v_dst_available_after
  );
END
$$;

REVOKE ALL ON FUNCTION public.admin_move_shares(UUID, TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_move_shares(UUID, TEXT, TEXT, BIGINT, TEXT) TO authenticated;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.41 admin_move_shares applied.';
  RAISE NOTICE '  ✓ One RPC handles all 12 source-destination pairs';
  RAISE NOTICE '  ✓ Owner is virtual (derived from total - SUM(wallets))';
  RAISE NOTICE '  ✓ Destination wallet auto-created when missing';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
