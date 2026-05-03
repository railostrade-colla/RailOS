-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.1 — Database hardening + cleanup utilities + legal_pages
-- Date: 2026-05-04
-- Idempotent: safe to re-run.
--
-- Closes the gaps surfaced by the post-Phase-8 deep audit:
--   1. fee_unit_balances tightened: CHECK (balance >= 0) so a race
--      condition can't go negative
--   2. Composite indexes for admin-heavy queries (audit_log,
--      notifications) — measurable wins on the inbox
--   3. Cleanup RPCs (manual now, cron-friendly later):
--      - cleanup_expired_share_codes
--      - expire_stale_share_transfers
--      - clear_stale_notification_locks
--   4. log_admin_action accepts optional ip + user_agent (8.4 left
--      these NULL)
--   5. legal_pages table for LegalPagesEditorPanel (was mock-only)
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Tighten fee_unit_balances ───────────────────────────
DO $$ BEGIN
  -- Add CHECK only if not already present (handles re-run on DBs
  -- that may have had it added manually).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.fee_unit_balances'::regclass
      AND conname = 'fee_unit_balances_balance_nonneg'
  ) THEN
    ALTER TABLE public.fee_unit_balances
      ADD CONSTRAINT fee_unit_balances_balance_nonneg
      CHECK (balance >= 0);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ─── 2. Composite indexes ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_action_recent
  ON public.audit_log(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_admin_unprocessed
  ON public.notifications(user_id, processed_by)
  WHERE processed_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_holdings_user_project
  ON public.holdings(user_id, project_id);

CREATE INDEX IF NOT EXISTS idx_share_transfers_pending_recipient
  ON public.share_transfers(recipient_id, status)
  WHERE status = 'pending';

-- ─── 3. log_admin_action — extended with ip + user_agent ────
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  IF NOT public.is_admin() THEN RETURN NULL; END IF;

  INSERT INTO public.audit_log (
    user_id, action, entity_type, entity_id, metadata,
    ip_address, user_agent
  ) VALUES (
    v_uid, p_action, p_entity_type, p_entity_id, p_metadata,
    p_ip_address::INET, p_user_agent
  )
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END
$$;

GRANT EXECUTE ON FUNCTION public.log_admin_action(
  TEXT, TEXT, UUID, JSONB, TEXT, TEXT
) TO authenticated;

-- ─── 4. Cleanup RPCs (callable manually + cron-friendly) ────

-- Drop expired/used share codes older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_expired_share_codes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  DELETE FROM public.share_modification_codes
  WHERE (is_used = TRUE OR expires_at < NOW())
    AND created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('success', TRUE, 'deleted', v_deleted);
END
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_share_codes() TO authenticated;

-- Auto-expire stale share_transfers (>7 days old, still pending) + release frozen
CREATE OR REPLACE FUNCTION public.expire_stale_share_transfers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t RECORD;
  v_count INT := 0;
BEGIN
  -- This RPC runs as definer so it bypasses RLS to release frozen shares
  -- from holdings rows it doesn't own. Admin-gated.
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  FOR v_t IN
    SELECT id, sender_id, project_id, shares
    FROM public.share_transfers
    WHERE status = 'pending' AND expires_at < NOW()
    FOR UPDATE
  LOOP
    UPDATE public.share_transfers
    SET status = 'expired', responded_at = NOW()
    WHERE id = v_t.id;

    UPDATE public.holdings
    SET frozen_shares = GREATEST(0, frozen_shares - v_t.shares),
        updated_at = NOW()
    WHERE user_id = v_t.sender_id AND project_id = v_t.project_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', TRUE, 'expired', v_count);
END
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_share_transfers() TO authenticated;

-- Clear notification locks older than 15 minutes
CREATE OR REPLACE FUNCTION public.clear_stale_notification_locks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cleared INT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  UPDATE public.notifications
  SET locked_by = NULL, locked_at = NULL
  WHERE locked_by IS NOT NULL
    AND locked_at < NOW() - INTERVAL '15 minutes';

  GET DIAGNOSTICS v_cleared = ROW_COUNT;
  RETURN jsonb_build_object('success', TRUE, 'cleared', v_cleared);
END
$$;

GRANT EXECUTE ON FUNCTION public.clear_stale_notification_locks() TO authenticated;

-- ─── 5. legal_pages table ───────────────────────────────────
-- Powers the LegalPagesEditorPanel which was mock-only (terms,
-- privacy, cookie policy, etc.)
CREATE TABLE IF NOT EXISTS public.legal_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE
    CHECK (slug ~ '^[a-z0-9-]+$'),
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  content TEXT NOT NULL,
  /** A simple version counter — bumped on every save. */
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_pages_published
  ON public.legal_pages(is_published) WHERE is_published = TRUE;

COMMENT ON TABLE public.legal_pages IS
  'الصفحات القانونية (شروط، خصوصية، إلخ) — نسخة DB بدلاً من ملفات ثابتة';

DROP TRIGGER IF EXISTS legal_pages_updated_at ON public.legal_pages;
CREATE TRIGGER legal_pages_updated_at
  BEFORE UPDATE ON public.legal_pages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.legal_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published legal pages" ON public.legal_pages;
CREATE POLICY "Public read published legal pages"
ON public.legal_pages FOR SELECT
USING (is_published = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage legal pages" ON public.legal_pages;
CREATE POLICY "Admins manage legal pages"
ON public.legal_pages FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- RPC: upsert + bump version
CREATE OR REPLACE FUNCTION public.admin_upsert_legal_page(
  p_slug TEXT,
  p_title TEXT,
  p_content TEXT,
  p_publish BOOLEAN DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
  v_version INT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;
  IF p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_slug');
  END IF;
  IF length(trim(p_title)) = 0 OR length(trim(p_content)) = 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_input');
  END IF;

  INSERT INTO public.legal_pages (slug, title, content, is_published,
    published_at, updated_by)
  VALUES (p_slug, p_title, p_content, p_publish,
    CASE WHEN p_publish THEN NOW() ELSE NULL END, v_uid)
  ON CONFLICT (slug) DO UPDATE
    SET title = EXCLUDED.title,
        content = EXCLUDED.content,
        is_published = EXCLUDED.is_published OR public.legal_pages.is_published,
        published_at = CASE
          WHEN EXCLUDED.is_published AND NOT public.legal_pages.is_published
            THEN NOW()
          ELSE public.legal_pages.published_at END,
        version = public.legal_pages.version + 1,
        updated_by = v_uid
  RETURNING id, version INTO v_id, v_version;

  RETURN jsonb_build_object(
    'success', TRUE,
    'id', v_id,
    'version', v_version
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_legal_page(
  TEXT, TEXT, TEXT, BOOLEAN
) TO authenticated;

-- Seed common pages so the editor lands on existing rows
INSERT INTO public.legal_pages (slug, title, content, is_published)
VALUES
  ('terms', 'شروط الاستخدام',
   'شروط الاستخدام الافتراضية — يرجى تحديثها من لوحة الإدارة.',
   FALSE),
  ('privacy', 'سياسة الخصوصية',
   'سياسة الخصوصية الافتراضية — يرجى تحديثها من لوحة الإدارة.',
   FALSE),
  ('about', 'عن المنصة',
   'صفحة "عن المنصة" — يرجى تحديثها من لوحة الإدارة.',
   FALSE)
ON CONFLICT (slug) DO NOTHING;

-- ─── 6. RPC: get_dashboard_stats (real KPIs for Dashboard panel) ─
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_users INT;
  v_projects INT;
  v_active_projects INT;
  v_total_deals INT;
  v_pending_deals INT;
  v_open_disputes INT;
  v_pending_kyc INT;
  v_pending_fee_requests INT;
  v_active_auctions INT;
  v_active_contracts INT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'not_admin');
  END IF;

  SELECT COUNT(*) INTO v_users FROM public.profiles;

  BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'active')
      INTO v_projects, v_active_projects
    FROM public.projects;
  EXCEPTION WHEN undefined_column THEN
    v_projects := COALESCE(v_projects, 0);
    v_active_projects := 0;
  END;

  BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'pending')
      INTO v_total_deals, v_pending_deals
    FROM public.deals;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    SELECT COUNT(*) INTO v_open_disputes FROM public.disputes
    WHERE status = 'open';
  EXCEPTION WHEN undefined_table THEN v_open_disputes := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_pending_kyc FROM public.kyc_submissions
    WHERE status = 'pending';
  EXCEPTION WHEN undefined_table THEN v_pending_kyc := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_pending_fee_requests FROM public.fee_unit_requests
    WHERE status = 'pending';
  EXCEPTION WHEN undefined_table THEN v_pending_fee_requests := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_active_auctions FROM public.auctions
    WHERE status = 'active';
  EXCEPTION WHEN undefined_table THEN v_active_auctions := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_active_contracts FROM public.partnership_contracts
    WHERE status = 'active';
  EXCEPTION WHEN undefined_table THEN v_active_contracts := 0; END;

  RETURN jsonb_build_object(
    'users', COALESCE(v_users, 0),
    'projects', COALESCE(v_projects, 0),
    'active_projects', COALESCE(v_active_projects, 0),
    'total_deals', COALESCE(v_total_deals, 0),
    'pending_deals', COALESCE(v_pending_deals, 0),
    'open_disputes', COALESCE(v_open_disputes, 0),
    'pending_kyc', COALESCE(v_pending_kyc, 0),
    'pending_fee_requests', COALESCE(v_pending_fee_requests, 0),
    'active_auctions', COALESCE(v_active_auctions, 0),
    'active_contracts', COALESCE(v_active_contracts, 0)
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;

-- ─── 7. RPC: admin_promote_user / admin_demote_user ─────────
-- Powers AdminUsersPanel — change profiles.role.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_user_id UUID,
  p_role TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_caller_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  -- Only super_admin can alter roles. is_admin() includes plain admins.
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_uid;
  IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_super_admin');
  END IF;
  IF p_role NOT IN ('user', 'admin', 'super_admin', 'ambassador') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_role');
  END IF;
  IF p_user_id = v_uid AND p_role <> 'super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cannot_demote_self');
  END IF;

  UPDATE public.profiles
  SET role = p_role
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'user_not_found');
  END IF;

  -- Audit it manually — profiles isn't covered by Phase 8.4 triggers
  PERFORM public.log_admin_action(
    'set_user_role',
    'profile',
    p_user_id,
    jsonb_build_object('new_role', p_role)
  );

  RETURN jsonb_build_object('success', TRUE);
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO authenticated;

-- ─── 8. RPC: project_wallet admin actions ───────────────────
-- Powers ProjectWalletsPanel (was mock-only) — freeze and unfreeze
-- by setting available_shares = 0 / restoring from a JSONB snapshot.
-- This is intentionally a soft-freeze: we move shares to reserved_shares
-- so the CHECK (available + reserved + sold = total) holds.
CREATE OR REPLACE FUNCTION public.admin_freeze_project_wallet(
  p_wallet_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_w RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  SELECT * INTO v_w FROM public.project_wallets
  WHERE id = p_wallet_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;

  -- Move all available → reserved
  UPDATE public.project_wallets
  SET reserved_shares = reserved_shares + available_shares,
      available_shares = 0,
      updated_at = NOW()
  WHERE id = p_wallet_id;

  PERFORM public.log_admin_action(
    'freeze_project_wallet',
    'project_wallet',
    p_wallet_id,
    jsonb_build_object('frozen', v_w.available_shares)
  );

  RETURN jsonb_build_object('success', TRUE, 'frozen', v_w.available_shares);
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_freeze_project_wallet(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_unfreeze_project_wallet(
  p_wallet_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_w RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  SELECT * INTO v_w FROM public.project_wallets
  WHERE id = p_wallet_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;

  -- Move all reserved → available
  UPDATE public.project_wallets
  SET available_shares = available_shares + reserved_shares,
      reserved_shares = 0,
      updated_at = NOW()
  WHERE id = p_wallet_id;

  PERFORM public.log_admin_action(
    'unfreeze_project_wallet',
    'project_wallet',
    p_wallet_id,
    jsonb_build_object('unfrozen', v_w.reserved_shares)
  );

  RETURN jsonb_build_object('success', TRUE, 'unfrozen', v_w.reserved_shares);
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_unfreeze_project_wallet(UUID) TO authenticated;
