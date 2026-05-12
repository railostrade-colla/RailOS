-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.71 — Contract wallet (activity log + investment view)
-- Date: 2026-05-12
-- Idempotent.
--
-- Founder spec: each contract gets its own "wallet" inside
-- /contracts/[id] showing:
--   • Total invested
--   • Members
--   • Activity log — every action that happened in this contract
--     (invites, accepts, declines, status changes, investments)
--   • Source breakdown — shares purchased through auction / quick-sale
--     / direct buy / exchange
--   • Real notifications for the actions (already pushed to the bell
--     via Phase 13.58 triggers).
--
-- Changes:
--   1. contract_activities table — append-only ledger of every event
--   2. Triggers on partnership_contracts + contract_members that
--      auto-log relevant actions
--   3. RPC get_contract_wallet(id) → aggregated jsonb view
--   4. Realtime publication on contract_activities so the wallet
--      activity tab updates without refresh
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Activity ledger ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contract_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   UUID NOT NULL REFERENCES public.partnership_contracts(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'contract_created',
    'member_invited',
    'member_accepted',
    'member_declined',
    'member_removed',
    'contract_activated',
    'contract_ended',
    'contract_cancelled',
    'investment_recorded',
    'share_purchased',
    'share_sold',
    'distribution_paid'
  )),
  amount_iqd    BIGINT,
  shares_count  BIGINT,
  project_id    UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  source_type   TEXT CHECK (source_type IN (
    'auction', 'quick_sale', 'direct_buy', 'exchange', 'deal', 'admin', 'manual', 'system'
  )),
  metadata      JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_activities_contract
  ON public.contract_activities(contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_activities_actor
  ON public.contract_activities(actor_user_id, created_at DESC);

COMMENT ON TABLE public.contract_activities IS
  'Append-only ledger of contract events — feeds the in-contract wallet view (Phase 13.71)';

ALTER TABLE public.contract_activities ENABLE ROW LEVEL SECURITY;

-- Read: creator + members + admin (uses the SD helpers from 13.60).
DROP POLICY IF EXISTS "parties read contract_activities" ON public.contract_activities;
CREATE POLICY "parties read contract_activities"
  ON public.contract_activities FOR SELECT
  USING (
    public._is_contract_creator(contract_id, auth.uid())
    OR public._is_contract_member(contract_id, auth.uid())
    OR public.is_admin()
  );

-- Writes go through triggers / SD RPCs only.
DROP POLICY IF EXISTS "no direct insert contract_activities" ON public.contract_activities;
CREATE POLICY "no direct insert contract_activities"
  ON public.contract_activities FOR INSERT
  WITH CHECK (FALSE);


-- ─── 2. Helper: append a row (SD bypasses RLS) ─────────────────
CREATE OR REPLACE FUNCTION public._log_contract_activity(
  p_contract_id   UUID,
  p_actor_user_id UUID,
  p_activity_type TEXT,
  p_amount_iqd    BIGINT  DEFAULT NULL,
  p_shares_count  BIGINT  DEFAULT NULL,
  p_project_id    UUID    DEFAULT NULL,
  p_source_type   TEXT    DEFAULT NULL,
  p_metadata      JSONB   DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.contract_activities (
    contract_id, actor_user_id, activity_type,
    amount_iqd, shares_count, project_id, source_type, metadata
  ) VALUES (
    p_contract_id, p_actor_user_id, p_activity_type,
    p_amount_iqd, p_shares_count, p_project_id, p_source_type, COALESCE(p_metadata, '{}'::JSONB)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public._log_contract_activity(UUID, UUID, TEXT, BIGINT, BIGINT, UUID, TEXT, JSONB) FROM PUBLIC;


-- ─── 3. Triggers: log lifecycle events automatically ───────────

-- contract created
CREATE OR REPLACE FUNCTION public.trg_contract_log_created()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public._log_contract_activity(
    NEW.id, NEW.creator_id, 'contract_created',
    NEW.total_investment, NULL, NULL, 'system',
    jsonb_build_object('title', NEW.title)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contract_log_created ON public.partnership_contracts;
CREATE TRIGGER trg_contract_log_created
  AFTER INSERT ON public.partnership_contracts
  FOR EACH ROW EXECUTE FUNCTION public.trg_contract_log_created();


-- contract status change (active/ended/cancelled)
CREATE OR REPLACE FUNCTION public.trg_contract_log_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF NEW.status::TEXT = 'active' THEN
    PERFORM public._log_contract_activity(
      NEW.id, NEW.creator_id, 'contract_activated',
      NEW.total_investment, NULL, NULL, 'system', '{}'::JSONB
    );
  ELSIF NEW.status::TEXT = 'ended' THEN
    PERFORM public._log_contract_activity(
      NEW.id, NEW.creator_id, 'contract_ended',
      NEW.total_investment, NULL, NULL, 'system', '{}'::JSONB
    );
  ELSIF NEW.status::TEXT = 'cancelled' THEN
    PERFORM public._log_contract_activity(
      NEW.id, NEW.creator_id, 'contract_cancelled',
      NULL, NULL, NULL, 'system',
      jsonb_build_object('reason', NEW.cancellation_reason)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contract_log_status_change ON public.partnership_contracts;
CREATE TRIGGER trg_contract_log_status_change
  AFTER UPDATE OF status ON public.partnership_contracts
  FOR EACH ROW EXECUTE FUNCTION public.trg_contract_log_status_change();


-- member invited / accepted / declined
CREATE OR REPLACE FUNCTION public.trg_contract_log_member_event()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Skip the creator's auto-accepted row (already covered by created).
    IF NEW.invite_status::TEXT = 'pending' THEN
      PERFORM public._log_contract_activity(
        NEW.contract_id, NEW.user_id, 'member_invited',
        NULL, NULL, NULL, 'system',
        jsonb_build_object('share_percent', NEW.share_percent)
      );
    END IF;
  ELSIF TG_OP = 'UPDATE'
        AND OLD.invite_status::TEXT = 'pending'
        AND NEW.invite_status::TEXT IN ('accepted', 'declined') THEN
    PERFORM public._log_contract_activity(
      NEW.contract_id, NEW.user_id,
      CASE WHEN NEW.invite_status::TEXT = 'accepted' THEN 'member_accepted'
           ELSE 'member_declined' END,
      NULL, NULL, NULL, 'system',
      jsonb_build_object(
        'share_percent', NEW.share_percent,
        'decline_reason', NEW.decline_reason
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public._log_contract_activity(
      OLD.contract_id, OLD.user_id, 'member_removed',
      NULL, NULL, NULL, 'system',
      jsonb_build_object('share_percent', OLD.share_percent)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_contract_log_member_event ON public.contract_members;
CREATE TRIGGER trg_contract_log_member_event
  AFTER INSERT OR UPDATE OF invite_status OR DELETE ON public.contract_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_contract_log_member_event();


-- ─── 4. RPC: get_contract_wallet ───────────────────────────────
DROP FUNCTION IF EXISTS public.get_contract_wallet(UUID);

CREATE OR REPLACE FUNCTION public.get_contract_wallet(p_contract_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_contract  RECORD;
  v_members   INT;
  v_invested  NUMERIC;
  v_shares    BIGINT;
  v_activities JSONB;
  v_sources   JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF p_contract_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  SELECT id, title, status, total_investment, creator_id, end_fee_pct,
         created_at, started_at, ended_at, cancelled_at
    INTO v_contract
    FROM public.partnership_contracts
   WHERE id = p_contract_id;

  IF v_contract.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  -- Auth: creator / member / admin
  IF NOT (
    v_contract.creator_id = v_uid
    OR public._is_contract_member(p_contract_id, v_uid)
    OR public.is_admin()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT COUNT(*)::INT INTO v_members
    FROM public.contract_members
   WHERE contract_id = p_contract_id
     AND invite_status::TEXT = 'accepted';

  -- Sum of recorded investments + share purchases (from activities).
  SELECT
    COALESCE(SUM(amount_iqd) FILTER (
      WHERE activity_type IN ('investment_recorded', 'share_purchased')
    ), 0)::NUMERIC,
    COALESCE(SUM(shares_count) FILTER (
      WHERE activity_type IN ('share_purchased')
    ), 0)::BIGINT
  INTO v_invested, v_shares
  FROM public.contract_activities
  WHERE contract_id = p_contract_id;

  -- Activity timeline (newest 100).
  SELECT COALESCE(jsonb_agg(t.row ORDER BY t.created_at DESC), '[]'::JSONB)
  INTO v_activities
  FROM (
    SELECT
      a.created_at,
      jsonb_build_object(
        'id', a.id,
        'activity_type', a.activity_type,
        'actor_user_id', a.actor_user_id,
        'actor_name', public._display_name_for(a.actor_user_id),
        'amount_iqd', a.amount_iqd,
        'shares_count', a.shares_count,
        'project_id', a.project_id,
        'source_type', a.source_type,
        'metadata', a.metadata,
        'created_at', a.created_at
      ) AS row
    FROM public.contract_activities a
    WHERE a.contract_id = p_contract_id
    ORDER BY a.created_at DESC
    LIMIT 100
  ) t;

  -- Source breakdown (only purchase/investment events with a source).
  SELECT COALESCE(jsonb_object_agg(source_type, payload), '{}'::JSONB)
  INTO v_sources
  FROM (
    SELECT
      source_type,
      jsonb_build_object(
        'count', COUNT(*),
        'total_amount', COALESCE(SUM(amount_iqd), 0),
        'total_shares', COALESCE(SUM(shares_count), 0)
      ) AS payload
    FROM public.contract_activities
    WHERE contract_id = p_contract_id
      AND activity_type IN ('share_purchased', 'investment_recorded')
      AND source_type IS NOT NULL
    GROUP BY source_type
  ) s;

  RETURN jsonb_build_object(
    'success', true,
    'contract', jsonb_build_object(
      'id',                 v_contract.id,
      'title',              v_contract.title,
      'status',             v_contract.status,
      'total_investment',   v_contract.total_investment,
      'end_fee_pct',        v_contract.end_fee_pct,
      'created_at',         v_contract.created_at,
      'started_at',         v_contract.started_at,
      'ended_at',           v_contract.ended_at,
      'cancelled_at',       v_contract.cancelled_at
    ),
    'wallet', jsonb_build_object(
      'members_count',      v_members,
      'invested_iqd',       v_invested,
      'shares_count',       v_shares,
      'planned_investment', v_contract.total_investment,
      'remaining_to_invest', GREATEST(0, v_contract.total_investment - v_invested)
    ),
    'sources',    v_sources,
    'activities', v_activities
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_contract_wallet(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contract_wallet(UUID) TO authenticated;


-- ─── 5. Realtime publication ───────────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contract_activities;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.contract_activities REPLICA IDENTITY FULL;


-- ─── 6. Backfill: log creation events for existing contracts ───
-- One-shot: insert a contract_created activity for every existing
-- contract that doesn't have one yet. Idempotent via NOT EXISTS.
INSERT INTO public.contract_activities (
  contract_id, actor_user_id, activity_type,
  amount_iqd, source_type, metadata, created_at
)
SELECT c.id, c.creator_id, 'contract_created',
       c.total_investment, 'system',
       jsonb_build_object('title', c.title, 'backfilled', true),
       c.created_at
FROM public.partnership_contracts c
WHERE NOT EXISTS (
  SELECT 1 FROM public.contract_activities a
  WHERE a.contract_id = c.id AND a.activity_type = 'contract_created'
);


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.71 contract wallet applied.';
  RAISE NOTICE '  ✓ contract_activities ledger + RLS';
  RAISE NOTICE '  ✓ 3 lifecycle triggers (create / status / member)';
  RAISE NOTICE '  ✓ get_contract_wallet(id) RPC';
  RAISE NOTICE '  ✓ Realtime publication enabled';
  RAISE NOTICE '  ✓ Backfilled contract_created for existing rows';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
