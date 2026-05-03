-- ═══════════════════════════════════════════════════════════════════
-- Phase 9.5 — Share modification with two-factor authorization
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Two-step authorization for changing total project shares:
--   1. A super admin generates a 6-digit code bound to one project
--      (24-hour expiry, single-use).
--   2. An admin uses the code to submit a modification request
--      (increase or decrease N shares + reason).
--   3. A super admin approves OR rejects the request. On approve the
--      shares are atomically applied to the project's RESERVE wallet
--      (per business rule: new/removed shares never touch the
--      offering or ambassador wallets — they sit in reserve until a
--      separate "release to offering" flow moves them).
--
-- Why reserve wallet only:
--   The offering wallet holds shares actively listed for trading.
--   The ambassador wallet holds reward allocations. Both are
--   pre-allocated at project creation. Shares minted/burned via this
--   feature affect ONLY the reserve pool, so live trading remains
--   untouched and the project_wallets.shares_balance CHECK
--   constraint is never violated.
--
-- Wires into Phase 9.4: the requests_hub "طلبات الحصص" tab already
-- queries share_modification_requests and will populate once this
-- migration runs.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. share_modification_codes ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.share_modification_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE
    CHECK (code ~ '^[0-9]{6}$'),
  generated_by UUID NOT NULL REFERENCES public.profiles(id)
    ON DELETE RESTRICT,
  project_id UUID NOT NULL REFERENCES public.projects(id)
    ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  used_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_codes_project
  ON public.share_modification_codes(project_id);
CREATE INDEX IF NOT EXISTS idx_share_codes_active
  ON public.share_modification_codes(is_used, expires_at)
  WHERE is_used = FALSE;
CREATE INDEX IF NOT EXISTS idx_share_codes_generated_by
  ON public.share_modification_codes(generated_by);

COMMENT ON TABLE public.share_modification_codes IS
  'رموز مؤقتة من Super Admin لتفويض تعديل الحصص (24 ساعة، استخدام واحد)';

-- ─── 2. share_modification_requests ──────────────────────────
CREATE TABLE IF NOT EXISTS public.share_modification_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id)
    ON DELETE RESTRICT,
  requested_by UUID NOT NULL REFERENCES public.profiles(id)
    ON DELETE RESTRICT,
  modification_type TEXT NOT NULL
    CHECK (modification_type IN ('increase', 'decrease')),
  shares_amount BIGINT NOT NULL CHECK (shares_amount > 0),
  reason TEXT,
  code_used UUID REFERENCES public.share_modification_codes(id)
    ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_super_admin'
    CHECK (status IN ('pending_super_admin', 'approved', 'rejected')),
  super_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  super_admin_at TIMESTAMPTZ,
  super_admin_note TEXT,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_requests_status
  ON public.share_modification_requests(status);
CREATE INDEX IF NOT EXISTS idx_share_requests_project
  ON public.share_modification_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_share_requests_requester
  ON public.share_modification_requests(requested_by);

COMMENT ON TABLE public.share_modification_requests IS
  'طلبات تعديل حصص المشاريع — تتطلب موافقة Super Admin';

-- ─── 3. RLS ──────────────────────────────────────────────────
ALTER TABLE public.share_modification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_modification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view share codes" ON public.share_modification_codes;
CREATE POLICY "Admins view share codes"
ON public.share_modification_codes FOR SELECT
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins view share requests" ON public.share_modification_requests;
CREATE POLICY "Admins view share requests"
ON public.share_modification_requests FOR SELECT
USING (public.is_admin());

-- INSERT/UPDATE go through SECURITY DEFINER RPCs only — no direct
-- client writes are allowed.

-- ═══════════════════════════════════════════════════════════════════
-- RPCs
-- ═══════════════════════════════════════════════════════════════════

-- ─── 4. RPC: admin_generate_share_code (Super Admin only) ────
-- Generates a new 6-digit code bound to one project. Retries on the
-- (unlikely) UNIQUE collision so callers always get a fresh code.
CREATE OR REPLACE FUNCTION public.admin_generate_share_code(
  p_project_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_code TEXT;
  v_id UUID;
  v_attempts INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_super_admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'project_not_found');
  END IF;

  -- Try up to 5 times; collision odds for 6 digits are tiny but possible.
  LOOP
    v_attempts := v_attempts + 1;
    v_code := lpad(floor(random() * 1000000)::TEXT, 6, '0');
    BEGIN
      INSERT INTO public.share_modification_codes (
        code, generated_by, project_id
      ) VALUES (
        v_code, v_uid, p_project_id
      )
      RETURNING id INTO v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts >= 5 THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'code_collision_retry');
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'id', v_id,
    'code', v_code,
    'expires_in_hours', 24
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_generate_share_code(UUID) TO authenticated;

-- ─── 5. RPC: admin_submit_share_modification (Admin) ─────────
-- Consumes a valid code + creates a pending request, then notifies
-- every super admin so they see it in their inbox.
CREATE OR REPLACE FUNCTION public.admin_submit_share_modification(
  p_project_id UUID,
  p_type TEXT,
  p_shares BIGINT,
  p_code TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code_id UUID;
  v_code_project UUID;
  v_request_id UUID;
  v_super_admin_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;
  IF p_type NOT IN ('increase', 'decrease') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_type');
  END IF;
  IF p_shares IS NULL OR p_shares <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_shares');
  END IF;
  IF p_code IS NULL OR p_code !~ '^[0-9]{6}$' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_code_format');
  END IF;

  -- Validate + lock the code row
  SELECT id, project_id INTO v_code_id, v_code_project
  FROM public.share_modification_codes
  WHERE code = p_code
    AND is_used = FALSE
    AND expires_at > NOW()
  FOR UPDATE;

  IF v_code_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_or_expired_code');
  END IF;

  -- Code must match the requested project (so a code can't be hijacked
  -- to mutate a different project).
  IF v_code_project <> p_project_id THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'code_project_mismatch');
  END IF;

  -- Burn the code
  UPDATE public.share_modification_codes
  SET is_used = TRUE, used_by = v_uid, used_at = NOW()
  WHERE id = v_code_id;

  -- Create the pending request
  INSERT INTO public.share_modification_requests (
    project_id, requested_by, modification_type,
    shares_amount, reason, code_used
  ) VALUES (
    p_project_id, v_uid, p_type, p_shares, p_reason, v_code_id
  )
  RETURNING id INTO v_request_id;

  -- Notify every super_admin (best-effort)
  BEGIN
    FOR v_super_admin_id IN
      SELECT id FROM public.profiles WHERE role = 'super_admin'
    LOOP
      PERFORM public.create_user_notification(
        v_super_admin_id,
        'system_announcement'::notification_type,
        '🔐 طلب تعديل حصص',
        CASE WHEN p_type = 'increase'
             THEN 'طلب زيادة ' || p_shares || ' حصة — يحتاج موافقتك'
             ELSE 'طلب تقليل ' || p_shares || ' حصة — يحتاج موافقتك' END,
        'urgent'::notification_priority
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- notifications are non-critical
  END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'request_id', v_request_id
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_submit_share_modification(
  UUID, TEXT, BIGINT, TEXT, TEXT
) TO authenticated;

-- ─── 6. RPC: admin_approve_share_modification (Super Admin) ──
-- Atomically applies the change to projects.total_shares + the
-- reserve wallet. Refuses self-approval and validates that
-- decreases stay within available reserve.
CREATE OR REPLACE FUNCTION public.admin_approve_share_modification(
  p_request_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_req RECORD;
  v_reserve RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_super_admin');
  END IF;

  -- Lock the request row
  SELECT * INTO v_req FROM public.share_modification_requests
  WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_req.status <> 'pending_super_admin' THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error', 'not_pending',
      'current_status', v_req.status
    );
  END IF;
  -- A super admin who happens to also be the requester can't sign off
  -- their own request.
  IF v_req.requested_by = v_uid THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'self_approval_blocked');
  END IF;

  -- Lock the reserve wallet
  SELECT * INTO v_reserve FROM public.project_wallets
  WHERE project_id = v_req.project_id AND wallet_type = 'reserve'
  FOR UPDATE;

  IF v_reserve IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'reserve_wallet_missing');
  END IF;

  IF v_req.modification_type = 'increase' THEN
    UPDATE public.projects
    SET total_shares = total_shares + v_req.shares_amount,
        updated_at = NOW()
    WHERE id = v_req.project_id;

    UPDATE public.project_wallets
    SET total_shares = total_shares + v_req.shares_amount,
        available_shares = available_shares + v_req.shares_amount,
        updated_at = NOW()
    WHERE id = v_reserve.id;

  ELSIF v_req.modification_type = 'decrease' THEN
    -- Only the *available* reserve can be removed — locked or already
    -- distributed shares stay put. This is the safety net the user
    -- described: trading on the offering wallet is never affected.
    IF v_reserve.available_shares < v_req.shares_amount THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'insufficient_reserve',
        'available', v_reserve.available_shares,
        'requested', v_req.shares_amount
      );
    END IF;

    UPDATE public.projects
    SET total_shares = total_shares - v_req.shares_amount,
        updated_at = NOW()
    WHERE id = v_req.project_id;

    UPDATE public.project_wallets
    SET total_shares = total_shares - v_req.shares_amount,
        available_shares = available_shares - v_req.shares_amount,
        updated_at = NOW()
    WHERE id = v_reserve.id;
  END IF;

  -- Mark approved + applied
  UPDATE public.share_modification_requests
  SET status = 'approved',
      super_admin_id = v_uid,
      super_admin_at = NOW(),
      applied_at = NOW()
  WHERE id = p_request_id;

  -- Notify the requesting admin (best-effort)
  BEGIN
    PERFORM public.create_user_notification(
      v_req.requested_by,
      'system_announcement'::notification_type,
      '✅ تم اعتماد طلب تعديل الحصص',
      CASE WHEN v_req.modification_type = 'increase'
           THEN 'تمت زيادة ' || v_req.shares_amount || ' حصة على الاحتياطي'
           ELSE 'تم تقليل ' || v_req.shares_amount || ' حصة من الاحتياطي' END,
      'high'::notification_priority
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', TRUE);
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_share_modification(UUID) TO authenticated;

-- ─── 7. RPC: admin_reject_share_modification (Super Admin) ───
CREATE OR REPLACE FUNCTION public.admin_reject_share_modification(
  p_request_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_req RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_super_admin');
  END IF;

  SELECT * INTO v_req FROM public.share_modification_requests
  WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_req.status <> 'pending_super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_pending');
  END IF;

  UPDATE public.share_modification_requests
  SET status = 'rejected',
      super_admin_id = v_uid,
      super_admin_at = NOW(),
      super_admin_note = p_note
  WHERE id = p_request_id;

  -- Notify requester
  BEGIN
    PERFORM public.create_user_notification(
      v_req.requested_by,
      'system_announcement'::notification_type,
      '❌ تم رفض طلب تعديل الحصص',
      COALESCE(p_note, 'تم رفض الطلب من قِبَل Super Admin'),
      'high'::notification_priority
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', TRUE);
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_share_modification(UUID, TEXT) TO authenticated;
