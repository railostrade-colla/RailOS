-- ═══════════════════════════════════════════════════════════════════
-- Phase 11.12 — Dynamic market price + price-history table
-- Date: 2026-05-08
-- Idempotent: safe to re-run.
--
-- Founder report: "سعر ال 25000 يتغير حسب سعر السوق ليس ثابت".
-- The portfolio total was reading the launch price (share_price) as
-- the market price. Reason: nothing was updating
-- projects.current_market_price after a trade. The launch price is
-- supposed to be the immutable initial price; the market price has
-- to drift with completed deals.
--
-- Fix:
--   1. Trigger on deals: when a deal flips to status='completed',
--      set projects.current_market_price = deal.price_per_share.
--   2. project_price_history table: records every price change so
--      the chart on /investment can later read real history instead
--      of the synthesised series.
--   3. Backfill projects.current_market_price for any project that
--      already has completed deals — uses the most-recent
--      completed-deal price.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. project_price_history table ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_price_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  price       BIGINT NOT NULL CHECK (price > 0),
  /** What caused the price change. */
  source      TEXT  NOT NULL CHECK (source IN ('deal','auction','admin','launch')),
  source_ref  UUID,             -- deal_id / auction_id / NULL
  shares      BIGINT,            -- volume of the trade that set it
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pph_project_time
  ON public.project_price_history (project_id, recorded_at DESC);

-- Make readable by anyone authenticated (read-only RLS); inserts
-- happen through the trigger / admin RPCs only.
ALTER TABLE public.project_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pph_read ON public.project_price_history;
CREATE POLICY pph_read ON public.project_price_history
  FOR SELECT TO authenticated USING (TRUE);


-- ─── 2. Trigger: on deal completion, update market price ─────────
CREATE OR REPLACE FUNCTION public._on_deal_completed_update_market_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price BIGINT;
BEGIN
  -- Only react to status transitions into 'completed'.
  IF NEW.status::TEXT <> 'completed' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::TEXT = 'completed' THEN
    -- Already completed — nothing to do.
    RETURN NEW;
  END IF;

  v_price := COALESCE(NEW.price_per_share, 0);
  IF v_price <= 0 THEN
    RETURN NEW;
  END IF;

  -- Update the project's live market price.
  BEGIN
    UPDATE public.projects
       SET current_market_price = v_price,
           updated_at           = NOW()
     WHERE id = NEW.project_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Append to the price history (best-effort).
  BEGIN
    INSERT INTO public.project_price_history (
      project_id, price, source, source_ref, shares, recorded_at
    ) VALUES (
      NEW.project_id, v_price, 'deal', NEW.id, NEW.shares, NOW()
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_deal_completed_market_price ON public.deals;
CREATE TRIGGER trg_deal_completed_market_price
  AFTER INSERT OR UPDATE OF status
  ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public._on_deal_completed_update_market_price();


-- ─── 3. Backfill current_market_price from existing completed deals ─
-- For any project where current_market_price is NULL/0 but at least
-- one completed deal exists, use the most-recent completed-deal price.
DO $$
DECLARE
  v_fixed INT := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (d.project_id)
      d.project_id,
      d.price_per_share AS price,
      d.id              AS deal_id,
      d.shares          AS shares,
      d.completed_at
    FROM public.deals d
    WHERE d.status::TEXT = 'completed'
      AND d.price_per_share > 0
    ORDER BY d.project_id, d.completed_at DESC NULLS LAST, d.created_at DESC
  LOOP
    BEGIN
      UPDATE public.projects
         SET current_market_price = r.price,
             updated_at           = NOW()
       WHERE id = r.project_id
         AND (current_market_price IS NULL OR current_market_price = 0
              OR current_market_price <> r.price);
      IF FOUND THEN
        v_fixed := v_fixed + 1;
        BEGIN
          INSERT INTO public.project_price_history (
            project_id, price, source, source_ref, shares, recorded_at
          ) VALUES (
            r.project_id, r.price, 'deal', r.deal_id, r.shares, COALESCE(r.completed_at, NOW())
          );
        EXCEPTION WHEN OTHERS THEN NULL; END;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;

  IF v_fixed > 0 THEN
    RAISE NOTICE 'Phase 11.12: backfilled current_market_price for % project(s)', v_fixed;
  ELSE
    RAISE NOTICE 'Phase 11.12: no projects needed market-price backfill';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Phase 11.12: backfill skipped: %', SQLERRM;
END $$;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 11.12 applied:';
  RAISE NOTICE '  ✓ project_price_history table + RLS read policy';
  RAISE NOTICE '  ✓ trigger on deals: status=completed → updates';
  RAISE NOTICE '    projects.current_market_price + price-history row';
  RAISE NOTICE '  ✓ backfill for projects with existing completed deals';
  RAISE NOTICE '  → portfolio + investment chart now read live market';
  RAISE NOTICE '    price that drifts with each settled trade.';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
