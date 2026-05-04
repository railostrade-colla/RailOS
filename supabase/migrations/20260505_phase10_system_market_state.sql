-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.37 — system-wide market state (singleton + RPCs)
-- Date: 2026-05-05
-- Idempotent: safe to re-run.
--
-- The MarketState admin panel was rendering 100% mock data
-- (mockMarketStateAdvanced + mockMarketPriceHistory): fake "السوق
-- مفتوح", fake current_price = 100,000, fake 45.2M volume, fake 87
-- trades, fake 6-row price history.
--
-- This migration ships the minimum real data the panel can show:
--   1. system_market_state — a singleton table (id=1) with the
--      master open/close switch. One row, ever.
--   2. get_system_market_state() RPC — returns the singleton flag
--      PLUS aggregates from `deals` (24h volume + count) and
--      `price_history` (the most recent N rows, joined to project
--      names). Defensive: any missing source table degrades to zero.
--   3. set_system_market_open() RPC — admin-only toggle. Writes an
--      audit_log entry on every flip.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Singleton table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_market_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  market_open BOOLEAN NOT NULL DEFAULT TRUE,
  last_changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_change_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the single row if it doesn't exist yet.
INSERT INTO public.system_market_state (id, market_open)
VALUES (1, TRUE)
ON CONFLICT (id) DO NOTHING;

-- RLS: every authenticated user can READ the open/closed flag (the
-- app needs it to show "market closed" banners). Only admins can
-- toggle (mutation goes through the RPC, never direct UPDATE).
ALTER TABLE public.system_market_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read" ON public.system_market_state;
CREATE POLICY "anyone_can_read"
ON public.system_market_state
FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS "no_direct_writes" ON public.system_market_state;
-- Intentionally no INSERT/UPDATE/DELETE policy — the RPC below
-- (SECURITY DEFINER) is the only legitimate mutation path.


-- ─── 2. Read RPC: get_system_market_state ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_system_market_state(p_history_limit INT DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state RECORD;
  v_volume_24h NUMERIC := 0;
  v_trades_24h INT := 0;
  v_history JSONB := '[]'::jsonb;
BEGIN
  -- ─── singleton flag ───
  SELECT id, market_open, updated_at, last_change_reason
  INTO v_state
  FROM public.system_market_state
  WHERE id = 1;

  IF NOT FOUND THEN
    -- Should never happen (we seed on migration), but degrade safely.
    v_state.market_open := TRUE;
    v_state.updated_at := now();
    v_state.last_change_reason := NULL;
  END IF;

  -- ─── 24h aggregates from deals ───
  BEGIN
    SELECT
      COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0),
      COUNT(*) FILTER (WHERE status = 'completed')
    INTO v_volume_24h, v_trades_24h
    FROM public.deals
    WHERE created_at > now() - INTERVAL '24 hours';
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    -- deals not present — leave zeros.
    NULL;
  END;

  -- ─── recent price changes ───
  BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_history
    FROM (
      SELECT
        ph.id,
        ph.project_id,
        COALESCE(p.name, '—') AS project_name,
        ph.old_price,
        ph.new_price,
        ph.change_pct,
        ph.recorded_at,
        ph.phase,
        ph.trigger
      FROM public.price_history ph
      LEFT JOIN public.projects p ON p.id = ph.project_id
      ORDER BY ph.recorded_at DESC
      LIMIT GREATEST(0, LEAST(p_history_limit, 100))
    ) t;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_history := '[]'::jsonb;
  END;

  RETURN jsonb_build_object(
    'market_open', v_state.market_open,
    'updated_at', v_state.updated_at,
    'last_change_reason', v_state.last_change_reason,
    'trading_volume_24h', v_volume_24h,
    'trades_count_24h', v_trades_24h,
    'price_history', v_history
  );
END
$$;

REVOKE ALL ON FUNCTION public.get_system_market_state(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_system_market_state(INT) TO authenticated, anon;


-- ─── 3. Write RPC: set_system_market_open ────────────────────────────
CREATE OR REPLACE FUNCTION public.set_system_market_open(
  p_open BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_old BOOLEAN;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  IF p_open IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_input');
  END IF;

  SELECT market_open INTO v_old
  FROM public.system_market_state WHERE id = 1;

  -- No-op if the value isn't changing.
  IF v_old IS NOT DISTINCT FROM p_open THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'changed', FALSE,
      'market_open', p_open
    );
  END IF;

  UPDATE public.system_market_state
  SET market_open = p_open,
      last_changed_by = v_uid,
      last_change_reason = NULLIF(TRIM(COALESCE(p_reason, '')), ''),
      updated_at = now()
  WHERE id = 1;

  -- Best-effort audit log entry.
  BEGIN
    PERFORM public.log_admin_action(
      CASE WHEN p_open THEN 'market_open' ELSE 'market_close' END,
      'market_state',
      NULL,
      jsonb_build_object(
        'previous', v_old,
        'new', p_open,
        'reason', p_reason
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Don't block the toggle if audit logging is broken.
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'changed', TRUE,
    'market_open', p_open
  );
END
$$;

REVOKE ALL ON FUNCTION public.set_system_market_open(BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_system_market_open(BOOLEAN, TEXT) TO authenticated;


-- ─── Done ────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Phase 10.37 applied: system_market_state + get/set RPCs.';
END $$;
