-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.58 — Friend + contract invite notifications
-- Date: 2026-05-11
-- Idempotent.
--
-- Founder spec:
--   1. طلب صداقة يظهر في جرس الإشعارات الرئيسي
--   2. عند إضافة شريك للعقد يصله نسخة فوريّة كنافذة منبثقة
--      من أيّ مكان في التطبيق للموافقة/الرفض
--   3. بجانب اسم كلّ شريك في صفحة العقد: قيد الانتظار / تمت
--      الموافقة / تم الرفض — كله live بدون تحديث
--
-- Changes:
--   1. ALTER notification_type ENUM — add 5 new values:
--        friend_request_received, friend_request_accepted,
--        contract_invite_received, contract_invite_accepted,
--        contract_invite_declined
--   2. Trigger trg_notify_friend_request_received — INSERT on
--      friend_requests fires a notification for recipient
--   3. Trigger trg_notify_friend_request_accepted — UPDATE
--      status → accepted fires a notification for the original
--      sender
--   4. Trigger trg_notify_contract_invite_received — INSERT into
--      contract_members with invite_status='pending' fires a
--      notification for the invited user
--   5. Trigger trg_notify_contract_invite_responded — UPDATE on
--      contract_members.invite_status (pending → accepted/declined)
--      fires a notification for the contract creator
--   6. RPC respond_to_contract_invite(contract_id, accept, reason)
--      — SECURITY DEFINER wrapper for the partner side
--   7. Add contract_members + partnership_contracts to
--      supabase_realtime publication so the popup modal + the
--      contract page can subscribe
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Extend notification_type enum ───────────────────────────
-- ALTER TYPE ADD VALUE is idempotent with IF NOT EXISTS.

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'friend_request_received';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'friend_request_accepted';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contract_invite_received';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contract_invite_accepted';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contract_invite_declined';


-- ─── 2. Helper to resolve a user's display name safely ─────────
-- Centralised so all four triggers below render consistent text.
-- Falls back through full_name → username → 'مستخدم'.

CREATE OR REPLACE FUNCTION public._display_name_for(p_uid UUID)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(full_name), ''), NULLIF(TRIM(username), ''), 'مستخدم')
    INTO v_name
    FROM public.profiles
   WHERE id = p_uid;
  RETURN COALESCE(v_name, 'مستخدم');
END;
$$;


-- ─── 3. Trigger: friend_request_received ───────────────────────
CREATE OR REPLACE FUNCTION public.trg_notify_friend_request_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name TEXT;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;
  v_sender_name := public._display_name_for(NEW.sender_id);

  INSERT INTO public.notifications (
    user_id, notification_type, title, message,
    priority, link_url, metadata, icon_name, created_at
  ) VALUES (
    NEW.recipient_id,
    'friend_request_received',
    '👋 طلب صداقة جديد',
    v_sender_name || ' يريد إضافتك كصديق',
    'normal',
    '/community',
    jsonb_build_object(
      'request_id', NEW.id,
      'sender_id',  NEW.sender_id,
      'message',    NEW.message
    ),
    'user-plus',
    NOW()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_friend_request_received ON public.friend_requests;
CREATE TRIGGER trg_notify_friend_request_received
  AFTER INSERT ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_friend_request_received();


-- ─── 4. Trigger: friend_request_accepted ───────────────────────
CREATE OR REPLACE FUNCTION public.trg_notify_friend_request_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_name TEXT;
BEGIN
  IF OLD.status = 'accepted' OR NEW.status <> 'accepted' THEN
    RETURN NEW;
  END IF;
  v_recipient_name := public._display_name_for(NEW.recipient_id);

  INSERT INTO public.notifications (
    user_id, notification_type, title, message,
    priority, link_url, metadata, icon_name, created_at
  ) VALUES (
    NEW.sender_id,
    'friend_request_accepted',
    '🎉 طلب الصداقة قُبل',
    v_recipient_name || ' قَبِل طلب الصداقة',
    'normal',
    '/community',
    jsonb_build_object(
      'request_id',   NEW.id,
      'recipient_id', NEW.recipient_id
    ),
    'user-check',
    NOW()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_friend_request_accepted ON public.friend_requests;
CREATE TRIGGER trg_notify_friend_request_accepted
  AFTER UPDATE OF status ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_friend_request_accepted();


-- ─── 5. Trigger: contract_invite_received ──────────────────────
CREATE OR REPLACE FUNCTION public.trg_notify_contract_invite_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract     RECORD;
  v_creator_name TEXT;
BEGIN
  -- Only notify on real pending invites for OTHER users (the creator
  -- row is inserted with invite_status='accepted' and shouldn't get a
  -- self-notification).
  IF NEW.invite_status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT id, title, creator_id, total_investment
    INTO v_contract
    FROM public.partnership_contracts
   WHERE id = NEW.contract_id;

  IF v_contract.creator_id = NEW.user_id THEN
    RETURN NEW; -- creator is auto-accepted, no notif
  END IF;

  v_creator_name := public._display_name_for(v_contract.creator_id);

  INSERT INTO public.notifications (
    user_id, notification_type, title, message,
    priority, link_url, metadata, icon_name, created_at
  ) VALUES (
    NEW.user_id,
    'contract_invite_received',
    '📄 دعوة لعقد شراكة',
    v_creator_name || ' يدعوك للانضمام إلى عقد «' || v_contract.title || '»',
    'high',
    '/contracts/' || v_contract.id::TEXT,
    jsonb_build_object(
      'contract_id',      v_contract.id,
      'contract_title',   v_contract.title,
      'creator_id',       v_contract.creator_id,
      'creator_name',     v_creator_name,
      'share_percent',    NEW.share_percent,
      'total_investment', v_contract.total_investment
    ),
    'file-text',
    NOW()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_contract_invite_received ON public.contract_members;
CREATE TRIGGER trg_notify_contract_invite_received
  AFTER INSERT ON public.contract_members
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_contract_invite_received();


-- ─── 6. Trigger: contract_invite_responded ─────────────────────
-- When a partner accepts/declines, the contract creator gets a notif.

CREATE OR REPLACE FUNCTION public.trg_notify_contract_invite_responded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract     RECORD;
  v_member_name  TEXT;
  v_type         public.notification_type;
  v_title        TEXT;
  v_message      TEXT;
BEGIN
  IF OLD.invite_status <> 'pending' OR NEW.invite_status NOT IN ('accepted', 'declined') THEN
    RETURN NEW;
  END IF;

  SELECT id, title, creator_id
    INTO v_contract
    FROM public.partnership_contracts
   WHERE id = NEW.contract_id;

  IF v_contract.creator_id = NEW.user_id THEN
    RETURN NEW; -- creator responded to their own auto-row; ignore
  END IF;

  v_member_name := public._display_name_for(NEW.user_id);

  IF NEW.invite_status = 'accepted' THEN
    v_type    := 'contract_invite_accepted';
    v_title   := '✅ تمت الموافقة على العقد';
    v_message := v_member_name || ' وافق على الانضمام لعقد «' || v_contract.title || '»';
  ELSE
    v_type    := 'contract_invite_declined';
    v_title   := '⛔ رُفض الانضمام للعقد';
    v_message := v_member_name || ' رفض الانضمام لعقد «' || v_contract.title || '»';
    IF NEW.decline_reason IS NOT NULL AND TRIM(NEW.decline_reason) <> '' THEN
      v_message := v_message || ' — السبب: ' || NEW.decline_reason;
    END IF;
  END IF;

  INSERT INTO public.notifications (
    user_id, notification_type, title, message,
    priority, link_url, metadata, icon_name, created_at
  ) VALUES (
    v_contract.creator_id,
    v_type,
    v_title,
    v_message,
    'normal',
    '/contracts/' || v_contract.id::TEXT,
    jsonb_build_object(
      'contract_id',    v_contract.id,
      'contract_title', v_contract.title,
      'member_id',      NEW.user_id,
      'member_name',    v_member_name,
      'invite_status',  NEW.invite_status,
      'decline_reason', NEW.decline_reason
    ),
    CASE WHEN NEW.invite_status = 'accepted' THEN 'check-circle' ELSE 'x-circle' END,
    NOW()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_contract_invite_responded ON public.contract_members;
CREATE TRIGGER trg_notify_contract_invite_responded
  AFTER UPDATE OF invite_status ON public.contract_members
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_contract_invite_responded();


-- ─── 7. RPC: respond_to_contract_invite ────────────────────────
-- The partner side: accept or decline. Updates contract_members,
-- which then fires trg_notify_contract_invite_responded for the
-- creator + maybe_activate_contract for status transitions.

DROP FUNCTION IF EXISTS public.respond_to_contract_invite(UUID, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.respond_to_contract_invite(
  p_contract_id   UUID,
  p_accept        BOOLEAN,
  p_decline_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_updated INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  IF p_contract_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  UPDATE public.contract_members
     SET invite_status  = (CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END)::contract_member_invite_status,
         joined_at      = CASE WHEN p_accept THEN NOW() ELSE joined_at END,
         declined_at    = CASE WHEN NOT p_accept THEN NOW() ELSE declined_at END,
         decline_reason = CASE WHEN NOT p_accept THEN p_decline_reason ELSE decline_reason END
   WHERE contract_id = p_contract_id
     AND user_id     = v_uid
     AND invite_status = 'pending'
  RETURNING 1 INTO v_updated;

  IF v_updated IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_pending_invite');
  END IF;

  RETURN jsonb_build_object('success', true, 'accepted', p_accept);
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_contract_invite(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_contract_invite(UUID, BOOLEAN, TEXT) TO authenticated;


-- ─── 8. Realtime publication on contract tables ────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contract_members;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.partnership_contracts;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.contract_members        REPLICA IDENTITY FULL;
ALTER TABLE public.partnership_contracts   REPLICA IDENTITY FULL;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.58 friend + contract notifications applied.';
  RAISE NOTICE '  ✓ 5 new notification_type enum values';
  RAISE NOTICE '  ✓ 4 triggers: friend_recv/accept + contract_invite_recv/resp';
  RAISE NOTICE '  ✓ respond_to_contract_invite(id, bool, reason) RPC';
  RAISE NOTICE '  ✓ Realtime on contract_members + partnership_contracts';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
