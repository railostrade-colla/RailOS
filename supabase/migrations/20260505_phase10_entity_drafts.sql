-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.35 — entity_drafts table for admin project/company drafts
-- Date: 2026-05-05
-- Idempotent: safe to re-run.
--
-- Replaces the localStorage-only drafts store at lib/admin/entity-drafts.ts.
-- Drafts now persist server-side so an admin's saved drafts move with
-- them across devices/sessions. The fast autosave channel still uses
-- localStorage (no network hit on every keystroke); only the named
-- "save as draft" action hits this table.
--
-- RLS: each admin can only see + mutate their own drafts. Founders
-- can read everyone's drafts (handy for support, never written to).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.entity_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('project', 'company')),
  title TEXT NOT NULL,
  /** Full form payload — schema mirrors EntityFormData on the client. */
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_drafts_owner ON public.entity_drafts(owner_id, kind, updated_at DESC);

-- ─── Auto-update updated_at on every UPDATE ──────────────────────
CREATE OR REPLACE FUNCTION public.entity_drafts_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_entity_drafts_touch ON public.entity_drafts;
CREATE TRIGGER trg_entity_drafts_touch
BEFORE UPDATE ON public.entity_drafts
FOR EACH ROW
EXECUTE FUNCTION public.entity_drafts_touch_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.entity_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_select" ON public.entity_drafts;
CREATE POLICY "owner_select"
ON public.entity_drafts
FOR SELECT
USING (
  owner_id = auth.uid()
  OR public.is_admin()  -- admins can read all drafts (audit / support)
);

DROP POLICY IF EXISTS "owner_insert" ON public.entity_drafts;
CREATE POLICY "owner_insert"
ON public.entity_drafts
FOR INSERT
WITH CHECK (
  owner_id = auth.uid()
  AND public.is_admin()  -- only admins create drafts
);

DROP POLICY IF EXISTS "owner_update" ON public.entity_drafts;
CREATE POLICY "owner_update"
ON public.entity_drafts
FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "owner_delete" ON public.entity_drafts;
CREATE POLICY "owner_delete"
ON public.entity_drafts
FOR DELETE
USING (owner_id = auth.uid());

-- ─── Done ────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Phase 10.35 applied: entity_drafts table + RLS.';
END $$;
