-- ═══════════════════════════════════════════════════════════════════
-- Phase 12 — Triggers on `deals` for lineage + initial-mode price rise
-- Date: 2026-05-09
-- Idempotent.
--
-- Two triggers, each AFTER INSERT OR UPDATE on `deals`:
--   1. trg_deal_track_lineage — every transition to status='completed'
--      writes a share_lineage row + flags it `is_circular` if the
--      reverse transfer happened within the detection window.
--   2. trg_deal_apply_rise — when a non-quick-sell deal completes
--      under the INITIAL engine mode, bump current_market_price by
--      the configured per-trade percentage (capped daily + monthly).
--
-- Quick-sell detection: `deals` doesn't store the flag itself; we
-- LEFT JOIN to listings via deals.listing_id and respect
-- listings.is_quick_sell = TRUE.
-- ═══════════════════════════════════════════════════════════════════


-- ─── Lineage tracker ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.on_deal_track_lineage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_circular BOOLEAN;
  v_is_quick BOOLEAN := FALSE;
  v_source TEXT;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Derive quick-sell from the linked listing.
    BEGIN
      SELECT COALESCE(is_quick_sell, FALSE) INTO v_is_quick
        FROM listings WHERE id = NEW.listing_id;
    EXCEPTION WHEN OTHERS THEN v_is_quick := FALSE; END;

    v_circular := public.is_circular_trade(NEW.project_id, NEW.seller_id, NEW.buyer_id);
    v_source := CASE WHEN v_is_quick THEN 'quick_sell' ELSE 'trade' END;

    INSERT INTO share_lineage(project_id, from_user_id, to_user_id, shares_count,
      source_type, source_id, is_circular, detected_at)
    VALUES (NEW.project_id, NEW.seller_id, NEW.buyer_id, NEW.shares,
      v_source, NEW.id, v_circular, CASE WHEN v_circular THEN NOW() ELSE NULL END);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_deal_track_lineage ON public.deals;
CREATE TRIGGER trg_deal_track_lineage
AFTER INSERT OR UPDATE OF status ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.on_deal_track_lineage();


-- ─── Initial-mode price rise on completion ────────────────────────
CREATE OR REPLACE FUNCTION public.on_deal_apply_initial_rise()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_is_quick BOOLEAN := FALSE;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    BEGIN
      SELECT COALESCE(is_quick_sell, FALSE) INTO v_is_quick
        FROM listings WHERE id = NEW.listing_id;
    EXCEPTION WHEN OTHERS THEN v_is_quick := FALSE; END;

    -- Quick-sell never moves the reference price.
    IF NOT v_is_quick THEN
      PERFORM public.apply_initial_mode_rise(NEW.project_id);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_deal_apply_rise ON public.deals;
CREATE TRIGGER trg_deal_apply_rise
AFTER INSERT OR UPDATE OF status ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.on_deal_apply_initial_rise();


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 12 triggers migration applied:';
  RAISE NOTICE '  ✓ trg_deal_track_lineage — share_lineage on completion';
  RAISE NOTICE '  ✓ trg_deal_apply_rise — initial-mode rise on completion';
  RAISE NOTICE '  ✓ Both respect listings.is_quick_sell';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
