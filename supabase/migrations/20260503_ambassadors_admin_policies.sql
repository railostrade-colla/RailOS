-- ═══════════════════════════════════════════════════════════════════
-- Ambassadors admin policies (Phase AA)
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- 04_ambassadors.sql gave users SELECT-own + INSERT-self on the
-- ambassadors table, but admins couldn't read the full review queue
-- or update application_status. Same for ambassador_rewards (users
-- only see their own rewards).
--
-- All policies reuse public.is_admin() from Phase W.
-- ═══════════════════════════════════════════════════════════════════

-- ─── ambassadors: admin SELECT + UPDATE ──────────────────────
DROP POLICY IF EXISTS "Admins can read all ambassadors"
  ON public.ambassadors;
CREATE POLICY "Admins can read all ambassadors"
ON public.ambassadors
FOR SELECT
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update ambassadors"
  ON public.ambassadors;
CREATE POLICY "Admins can update ambassadors"
ON public.ambassadors
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ─── ambassador_rewards: admin SELECT ────────────────────────
DROP POLICY IF EXISTS "Admins can read all ambassador rewards"
  ON public.ambassador_rewards;
CREATE POLICY "Admins can read all ambassador rewards"
ON public.ambassador_rewards
FOR SELECT
USING (public.is_admin());

-- DELETE / INSERT are intentionally not granted from the client —
-- rewards are written by SECURITY DEFINER triggers when a referral
-- converts. UPDATE is granted because admin may need to mark a
-- reward as cancelled / granted manually.
DROP POLICY IF EXISTS "Admins can update ambassador rewards"
  ON public.ambassador_rewards;
CREATE POLICY "Admins can update ambassador rewards"
ON public.ambassador_rewards
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());
