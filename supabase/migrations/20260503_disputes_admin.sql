-- ═══════════════════════════════════════════════════════════════════
-- Disputes admin policies (Phase EE)
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- 03_deals.sql created the disputes table without RLS. Both buyer
-- and seller of the deal need to see disputes they're party to,
-- and admins need full access for the resolution queue.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- ─── Deal parties: read disputes on their own deals ──────────
DROP POLICY IF EXISTS "Deal parties can read disputes" ON public.disputes;
CREATE POLICY "Deal parties can read disputes"
ON public.disputes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.deals
    WHERE deals.id = disputes.deal_id
      AND (deals.buyer_id = auth.uid() OR deals.seller_id = auth.uid())
  )
);

-- ─── Deal parties: open a dispute on their own deal ──────────
DROP POLICY IF EXISTS "Deal parties can open disputes" ON public.disputes;
CREATE POLICY "Deal parties can open disputes"
ON public.disputes
FOR INSERT
WITH CHECK (
  opened_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.deals
    WHERE deals.id = disputes.deal_id
      AND (deals.buyer_id = auth.uid() OR deals.seller_id = auth.uid())
  )
);

-- ─── Admins: full read access ────────────────────────────────
DROP POLICY IF EXISTS "Admins can read all disputes" ON public.disputes;
CREATE POLICY "Admins can read all disputes"
ON public.disputes
FOR SELECT
USING (public.is_admin());

-- ─── Admins: resolve disputes (UPDATE status + notes) ────────
DROP POLICY IF EXISTS "Admins can resolve disputes" ON public.disputes;
CREATE POLICY "Admins can resolve disputes"
ON public.disputes
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- DELETE deliberately not granted. Disputes are an audit trail —
-- the service role bypasses RLS if redaction is ever needed.
