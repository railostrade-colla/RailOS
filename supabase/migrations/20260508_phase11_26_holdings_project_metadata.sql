-- ═══════════════════════════════════════════════════════════════════
-- Phase 11.26 — Surface full project metadata for /portfolio holdings
-- Date: 2026-05-08
-- Idempotent: safe to re-run.
--
-- Problem:
--   /portfolio → "الحصص" tab was rendering "— مشروع غير معروف —" with
--   IQD 0 market price for any holding whose project isn't visible to
--   the signed-in user under the existing projects RLS:
--
--     USING (status != 'draft' OR created_by = auth.uid())
--
--   That policy hides DRAFT projects from non-admin users — fine for
--   the discover feed, BUT it also hid project metadata from users who
--   already own shares in those projects (e.g. a project that admin
--   reverted to draft, or holdings seeded before publish).
--
--   The existing get_my_holdings_full RPC (Phase 10.71) is SECURITY
--   DEFINER and already returns project_name + share_price for these
--   holdings, but does NOT return logo_url, cover_url,
--   current_market_price, or available_shares. The client therefore
--   ran a follow-up enrichHoldingsWithProjects() that does a direct
--   `.from("projects").select(...)` — which RLS blocks again — so the
--   logo and live price never reached the UI.
--
-- Fix (two layers, defense in depth):
--   1. Re-create get_my_holdings_full so it returns ALL the fields the
--      portfolio card needs (logo, cover, current_market_price,
--      available_shares, status) — bypassing RLS via SECURITY DEFINER.
--   2. Add an RLS policy allowing users to SELECT any project they
--      have a holding in — so any code path that hits the projects
--      table directly (legacy fallback, future readers, joined queries)
--      can also see the row instead of getting a cryptic empty result.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Replace get_my_holdings_full with a richer payload ────────
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
      proj.sector::TEXT   AS project_sector,
      proj.share_price    AS project_share_price,
      -- Phase 11.26 — full brand assets so the portfolio card can
      -- render the real logo / cover instead of the sector emoji.
      proj.logo_url       AS project_logo_url,
      proj.cover_url      AS project_cover_url,
      proj.status         AS project_status,
      proj.current_market_price AS project_current_market_price,
      -- Live market price preference: market_state.current_price (if
      -- the engine has set it), then current_market_price (set by the
      -- Phase 11.12 deal-completion trigger), then launch share_price.
      COALESCE(
        (SELECT current_price FROM public.market_state WHERE project_id = proj.id LIMIT 1),
        proj.current_market_price,
        proj.share_price
      ) AS market_price,
      proj.total_shares   AS project_total_shares,
      -- Phase 11.26 — surface available_shares from the offering
      -- wallet so the project header on /project/[id] (and any
      -- portfolio-side calculation that wants "remaining to fund")
      -- doesn't have to do a second round trip.
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


-- ─── 2. RLS: allow users to SELECT projects they own shares in ────
-- Defensive layer — even if a non-RPC code path queries projects
-- directly, users can read metadata for any project they have a
-- holding in. Idempotent: drop & re-create.
DROP POLICY IF EXISTS "Users can view projects they own shares in" ON public.projects;

CREATE POLICY "Users can view projects they own shares in"
  ON public.projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.holdings h
      WHERE h.project_id = public.projects.id
        AND h.user_id = auth.uid()
        AND h.shares > 0
    )
  );


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 11.26 applied:';
  RAISE NOTICE '  ✓ get_my_holdings_full now returns logo_url, cover_url, current_market_price, available_shares, status';
  RAISE NOTICE '  ✓ RLS: users can SELECT projects they have holdings in (defensive)';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
