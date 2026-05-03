-- ═══════════════════════════════════════════════════════════════════
-- Payment proofs admin SELECT (Phase CC)
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- The PaymentProofsPanel needs to read every payment proof for the
-- review queue, regardless of which deal it belongs to. The base
-- schema (03_deals.sql) didn't add explicit RLS — and direct buyer/
-- seller-scoped policies would still hide the queue from admins.
--
-- Admin-side WRITES on payment proofs aren't done from this panel —
-- the deal-status workflow (payment_submitted → completed) is owned
-- by the buyer/seller flow, and admin overrides happen via disputes.
-- Future: audit_log entries on review (separate phase).
-- ═══════════════════════════════════════════════════════════════════

-- Make sure RLS is on. The base table doesn't enable it explicitly,
-- so this is also a hardening fix.
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read all payment proofs"
  ON public.payment_proofs;
CREATE POLICY "Admins can read all payment proofs"
ON public.payment_proofs
FOR SELECT
USING (public.is_admin());

-- Restore the buyer/seller-scoped reads. They're implicit in
-- 03_deals.sql via the deal relationship but aren't formal policies
-- yet — adding them here keeps the existing deal flow working.
DROP POLICY IF EXISTS "Deal parties can read proofs"
  ON public.payment_proofs;
CREATE POLICY "Deal parties can read proofs"
ON public.payment_proofs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.deals
    WHERE deals.id = payment_proofs.deal_id
      AND (deals.buyer_id = auth.uid() OR deals.seller_id = auth.uid())
  )
);

-- INSERT: only the buyer of the deal can submit a payment proof.
DROP POLICY IF EXISTS "Buyers can insert payment proofs"
  ON public.payment_proofs;
CREATE POLICY "Buyers can insert payment proofs"
ON public.payment_proofs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.deals
    WHERE deals.id = payment_proofs.deal_id
      AND deals.buyer_id = auth.uid()
  )
);
