-- ═══════════════════════════════════════════════════════════════════
-- Phase 14.08.2 — Step 2b: HOTFIX get_my_holdings_full
-- Date: 2026-05-14
-- Idempotent. Single transaction.
--
-- Bug discovered during the live deal-completion smoke test:
--   The portfolio dropdown ("بيع حصص" picker on /exchange/create) was
--   empty for users who actually own shares.
--
-- Root cause:
--   Two migrations defined `get_my_holdings_full()`:
--     1. 20260508_phase11_26_holdings_project_metadata.sql
--          Uses `proj.project_type::TEXT AS project_sector` ✅
--     2. 20260513_phase10_my_holdings_full_rpc.sql
--          Uses `proj.sector::TEXT   AS project_sector` ❌
--
--   Migrations run in FILENAME order, so the 2026-05-13 file (which
--   actually contains the OLDER Phase 10.71 body) silently overwrote
--   the Phase 11.26 fix. `projects.sector` does not exist on this
--   schema — only `project_type` does — so every call to the RPC
--   threw `column "sector" does not exist`. The frontend treats RPC
--   errors as "no holdings" → picker is empty.
--
--   This bug is NOT caused by Phase 14.08.2; it's been latent since
--   2026-05-13 but only surfaced when the founder tried the
--   create-listing flow for the first time post-engine consolidation.
--
-- Fix:
--   Re-install the Phase 11.26 body verbatim — uses project_type and
--   handles the column-may-not-exist edge case via SECURITY DEFINER.
--
-- (Also: 20260513_phase10_my_holdings_full_rpc.sql is being patched in
--  source so a fresh-DB run doesn't re-break this function.)
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- Defensive: ensure brand columns exist (idempotent — same DO-block as
-- Phase 11.26 used).
DO $$
BEGIN
  BEGIN ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS logo_url TEXT;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS cover_url TEXT;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS symbol TEXT;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

DROP FUNCTION IF EXISTS public.get_my_holdings_full();

CREATE OR REPLACE FUNCTION public.get_my_holdings_full()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_result JSONB := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.last_acquired_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      h.id,
      h.project_id,
      h.shares,
      h.frozen_shares,
      h.average_buy_price,
      h.total_invested,
      h.first_acquired_at,
      h.last_acquired_at,
      proj.name           AS project_name,
      -- This schema has `project_type` (enum) but NOT `sector`.
      -- Cast to TEXT and let the client map enum → Arabic label.
      proj.project_type::TEXT AS project_sector,
      proj.share_price    AS project_share_price,
      COALESCE(NULLIF(BTRIM(proj.logo_url), ''), NULL) AS project_logo_url,
      COALESCE(
        NULLIF(BTRIM(proj.cover_url), ''),
        NULLIF(BTRIM(proj.cover_image_url), ''),
        NULL
      ) AS project_cover_url,
      proj.status         AS project_status,
      proj.current_market_price AS project_current_market_price,
      -- Live market price preference: market_state.current_price (if
      -- the engine has set it), then current_market_price (set by the
      -- Phase 14.08d up-only trigger), then launch share_price.
      COALESCE(
        (SELECT current_price FROM public.market_state WHERE project_id = proj.id LIMIT 1),
        proj.current_market_price,
        proj.share_price
      ) AS market_price,
      proj.total_shares   AS project_total_shares,
      COALESCE(
        (SELECT available_shares
           FROM public.project_wallets
          WHERE project_id = proj.id AND wallet_type = 'offering'
          LIMIT 1),
        0
      ) AS project_available_shares,
      proj.symbol         AS project_symbol,
      COALESCE(
        (SELECT
           CASE WHEN total_shares > 0
                THEN ROUND((sold_shares::NUMERIC / total_shares::NUMERIC) * 100, 1)
                ELSE 0 END
         FROM public.project_wallets
         WHERE project_id = proj.id AND wallet_type = 'offering'
         LIMIT 1),
        0
      ) AS funded_pct,
      COALESCE((
        SELECT SUM(shares) FROM public.deals
        WHERE buyer_id = v_uid AND project_id = proj.id AND status = 'completed'
      ), 0) AS shares_bought_from_project,
      COALESCE((
        SELECT SUM(shares) FROM public.deals
        WHERE seller_id = v_uid AND project_id = proj.id AND status = 'completed'
      ), 0) AS shares_sold_from_project,
      COALESCE((
        SELECT SUM(total_amount) FROM public.deals
        WHERE seller_id = v_uid AND project_id = proj.id AND status = 'completed'
      ), 0) AS total_sold_amount,
      COALESCE((
        SELECT SUM(total_amount) FROM public.deals
        WHERE buyer_id = v_uid AND project_id = proj.id AND status = 'completed'
      ), 0) AS total_bought_amount
    FROM public.holdings h
    LEFT JOIN public.projects proj ON proj.id = h.project_id
    WHERE h.user_id = v_uid AND h.shares > 0
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END
$$;

GRANT EXECUTE ON FUNCTION public.get_my_holdings_full() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════

-- 1. Confirm the function is installed and is STABLE SECURITY DEFINER:
SELECT
  proname,
  prosecdef AS security_definer,
  provolatile AS volatility           -- 's' = STABLE
FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname = 'get_my_holdings_full';

-- 2. Smoke-test the function. In SQL Editor (role=postgres) it will
--    return '[]' because auth.uid() = NULL — that's expected.
--    The real test is from the frontend (a signed-in user gets rows).
SELECT public.get_my_holdings_full();

-- 3. After the verification above passes, RELOAD the page in your
--    browser:  /exchange/create  → بيع حصص
--    The project dropdown should now populate with your real holdings.


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 14.08.2 Step 2b — Holdings RPC hotfix complete.';
  RAISE NOTICE '  Fixed: get_my_holdings_full uses project_type::TEXT';
  RAISE NOTICE '  Side effect: the "بيع حصص" picker on /exchange/create';
  RAISE NOTICE '  should now show projects you actually own shares in.';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
