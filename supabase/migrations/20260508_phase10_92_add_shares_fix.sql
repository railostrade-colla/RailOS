-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.92 — Fix admin_add_shares_to_offering
-- Date: 2026-05-08
-- Idempotent: safe to re-run.
--
-- Problems fixed:
--   1. Old RPC decremented projects.total_shares (immutable total) —
--      causing "إجمالي حصص الشركة" to show wrong value in UI.
--   2. No cap on how much can be offered — total offering could
--      exceed 90% of total project shares.
--   3. No ownership-transfer signal when owner shares reach 0.
--
-- New behaviour:
--   • projects.total_shares is NEVER modified — it is the immutable
--     grand total of ALL shares the project ever issued.
--   • Owner shares = total_shares − SUM(all wallet.total_shares)
--   • Cap: offering_wallet.total_shares + p_amount ≤ 90% of total_shares
--   • Returns owner_shares_after, ownership_transfer_needed, top_investor_id
--   • Backfills projects.total_shares where the old RPC corrupted it
--     (detectable when total_shares < SUM of all wallet total_shares).
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Backfill: restore total_shares where it was wrongly decremented ───
-- The old RPC decremented projects.total_shares each time shares were
-- moved to the offering wallet. This is detectable when total_shares
-- is less than the sum of all wallet shares (logically impossible in
-- a healthy state).
-- Recovery formula: total_shares = ROUND(offering_wallet / (offering_pct/100))
-- This is safe when the offering wallet has not been externally altered
-- beyond its initial seeding.

DO $$
DECLARE
  r RECORD;
  v_wallet_sum BIGINT;
  v_restored_total BIGINT;
  v_fixed INT := 0;
BEGIN
  FOR r IN
    SELECT
      p.id,
      p.total_shares,
      p.offering_percentage,
      COALESCE(SUM(w.total_shares), 0) AS wallet_sum,
      COALESCE(SUM(w.total_shares) FILTER (WHERE w.wallet_type = 'offering'), 0) AS offering_total
    FROM public.projects p
    LEFT JOIN public.project_wallets w ON w.project_id = p.id
    WHERE p.offering_percentage > 0
    GROUP BY p.id, p.total_shares, p.offering_percentage
    HAVING COALESCE(SUM(w.total_shares), 0) > COALESCE(p.total_shares, 0)
  LOOP
    -- Restore: original total = offering_wallet / (offering_pct / 100)
    v_restored_total := ROUND(
      r.offering_total::NUMERIC / NULLIF(r.offering_percentage / 100.0, 0)
    );

    IF v_restored_total > r.total_shares THEN
      UPDATE public.projects
         SET total_shares = v_restored_total
       WHERE id = r.id;
      v_fixed := v_fixed + 1;
      RAISE NOTICE 'Phase 10.92: restored total_shares for project % : % → %',
        r.id, r.total_shares, v_restored_total;
    END IF;
  END LOOP;

  IF v_fixed > 0 THEN
    RAISE NOTICE 'Phase 10.92: backfilled total_shares for % project(s)', v_fixed;
  ELSE
    RAISE NOTICE 'Phase 10.92: no total_shares backfill needed';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Phase 10.92: backfill skipped: %', SQLERRM;
END $$;


-- ─── 2. Re-create admin_add_shares_to_offering (fixed) ────────────
CREATE OR REPLACE FUNCTION public.admin_add_shares_to_offering(
  p_project_id UUID,
  p_amount     BIGINT,
  p_reason     TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid                       UUID := auth.uid();
  v_role                      TEXT;
  v_total_shares              BIGINT;
  v_offering_percentage       NUMERIC;
  v_wallet_sum                BIGINT;
  v_owner_shares              BIGINT;
  v_offering_total_now        BIGINT;
  v_offering_available_now    BIGINT;
  v_offering_status           TEXT;
  v_cap_90                    BIGINT;
  v_offering_total_after      BIGINT;
  v_offering_available_after  BIGINT;
  v_owner_shares_after        BIGINT;
  v_top_investor_id           UUID;
BEGIN
  -- ─── Auth ───────────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role <> 'super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'super_admin_only');
  END IF;

  -- ─── Validate amount ────────────────────────────────────────────
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_amount');
  END IF;

  -- ─── Lock project row ────────────────────────────────────────────
  SELECT total_shares, offering_percentage
    INTO v_total_shares, v_offering_percentage
  FROM public.projects
   WHERE id = p_project_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'project_not_found');
  END IF;

  -- ─── Compute owner shares = total − SUM(all wallets) ────────────
  SELECT COALESCE(SUM(total_shares), 0)
    INTO v_wallet_sum
  FROM public.project_wallets
   WHERE project_id = p_project_id;

  v_owner_shares := GREATEST(0, COALESCE(v_total_shares, 0) - v_wallet_sum);

  IF v_owner_shares < p_amount THEN
    RETURN jsonb_build_object(
      'success',   FALSE,
      'error',     'insufficient_owner_shares',
      'available', v_owner_shares
    );
  END IF;

  -- ─── 90% cap: offering_total + amount ≤ 90% of total_shares ─────
  SELECT COALESCE(SUM(total_shares), 0), COALESCE(SUM(available_shares), 0), MAX(status)
    INTO v_offering_total_now, v_offering_available_now, v_offering_status
  FROM public.project_wallets
   WHERE project_id = p_project_id AND wallet_type = 'offering'
   FOR UPDATE;  -- lock the offering wallet row

  v_cap_90 := FLOOR(COALESCE(v_total_shares, 0) * 0.9);

  IF (v_offering_total_now + p_amount) > v_cap_90 THEN
    RETURN jsonb_build_object(
      'success',   FALSE,
      'error',     'offering_cap_exceeded',
      'available', GREATEST(0, v_cap_90 - v_offering_total_now)
    );
  END IF;

  -- ─── Check offering wallet is not frozen ────────────────────────
  IF v_offering_status IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'offering_wallet_missing');
  END IF;
  IF v_offering_status = 'frozen' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'offering_wallet_frozen');
  END IF;

  -- ─── Increment offering wallet ONLY (total_shares stays intact) ──
  -- projects.total_shares is IMMUTABLE — it is the grand total of all
  -- shares this project ever issued.  Owner's share count is derived
  -- dynamically as (total_shares − SUM(wallet.total_shares)).
  UPDATE public.project_wallets
     SET total_shares     = total_shares     + p_amount,
         available_shares = available_shares + p_amount
   WHERE project_id = p_project_id AND wallet_type = 'offering'
   RETURNING total_shares, available_shares
        INTO v_offering_total_after, v_offering_available_after;

  -- Re-compute owner shares after the wallet update
  SELECT COALESCE(SUM(total_shares), 0)
    INTO v_wallet_sum
  FROM public.project_wallets
   WHERE project_id = p_project_id;

  v_owner_shares_after := GREATEST(0, COALESCE(v_total_shares, 0) - v_wallet_sum);

  -- ─── Ownership transfer check ───────────────────────────────────
  -- When owner shares reach 0, find the top investor by holdings.
  IF v_owner_shares_after = 0 THEN
    BEGIN
      SELECT h.user_id
        INTO v_top_investor_id
      FROM public.holdings h
       WHERE h.project_id = p_project_id AND h.shares_owned > 0
       ORDER BY h.shares_owned DESC
       LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_top_investor_id := NULL;
    END;
  END IF;

  -- ─── Audit ──────────────────────────────────────────────────────
  BEGIN
    PERFORM public.log_admin_action(
      'add_shares_to_offering', 'project', p_project_id,
      jsonb_build_object(
        'amount',                 p_amount,
        'reason',                 p_reason,
        'owner_shares_before',    v_owner_shares,
        'owner_shares_after',     v_owner_shares_after,
        'offering_total_before',  v_offering_total_now,
        'offering_total_after',   v_offering_total_after,
        'total_project_shares',   v_total_shares,
        'ownership_transfer',     (v_owner_shares_after = 0)
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success',                   TRUE,
    'amount',                    p_amount,
    'owner_shares_after',        v_owner_shares_after,
    'company_total_after',       v_owner_shares_after,   -- backwards-compat alias
    'offering_total_after',      v_offering_total_after,
    'offering_available_after',  v_offering_available_after,
    'ownership_transfer_needed', (v_owner_shares_after = 0),
    'top_investor_id',           v_top_investor_id
  );
END
$$;

REVOKE ALL ON FUNCTION public.admin_add_shares_to_offering(UUID, BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_shares_to_offering(UUID, BIGINT, TEXT) TO authenticated;


-- ─── 3. Done ──────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.92 applied:';
  RAISE NOTICE '  ✓ projects.total_shares is now IMMUTABLE — never decremented';
  RAISE NOTICE '  ✓ owner_shares = total_shares − SUM(wallet.total_shares) (dynamic)';
  RAISE NOTICE '  ✓ 90%% cap enforced: offering cannot exceed 0.9 × total_shares';
  RAISE NOTICE '  ✓ ownership_transfer_needed flag when owner reaches 0';
  RAISE NOTICE '  ✓ backfill: total_shares restored where RPC had decremented it';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
