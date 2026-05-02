-- ═══════════════════════════════════════════════════════════════════
-- Phase 2 — Deal notification triggers
-- Date: 2026-05-02
--
-- Two triggers on public.deals:
--   trg_notify_new_deal    AFTER INSERT  → seller gets "deal_request_received"
--   trg_notify_deal_status AFTER UPDATE  → routes by NEW.status:
--      accepted          → buyer  (deal_accepted)
--      rejected          → buyer  (deal_rejected)
--      payment_submitted → seller (payment_submitted)
--      completed         → both   (deal_completed)
--      cancelled         → both   (deal_cancelled)
--      expired           → both   (deal_expired)
--
-- All triggers are SECURITY DEFINER + EXCEPTION-safe: failures inside
-- the trigger never abort the original UPDATE/INSERT on deals.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1) AFTER INSERT — new deal → notify seller
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_new_deal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_name   TEXT;
  v_project_name TEXT;
BEGIN
  SELECT COALESCE(full_name, username, 'مستخدم') INTO v_buyer_name
  FROM profiles WHERE id = NEW.buyer_id;

  SELECT name INTO v_project_name
  FROM projects WHERE id = NEW.project_id;

  PERFORM create_user_notification(
    p_user_id  := NEW.seller_id,
    p_type     := 'deal_request_received'::notification_type,
    p_title    := 'طلب شراء جديد 💼',
    p_message  := COALESCE(v_buyer_name, 'مستخدم')
                  || ' يريد شراء ' || NEW.shares::TEXT
                  || ' حصة من ' || COALESCE(v_project_name, 'مشروع'),
    p_priority := 'high'::notification_priority,
    p_link_url := '/deals/' || NEW.id::TEXT,
    p_metadata := jsonb_build_object(
      'deal_id',      NEW.id,
      'project_id',   NEW.project_id,
      'shares',       NEW.shares,
      'total_amount', NEW.total_amount
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_on_new_deal failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_deal ON public.deals;
CREATE TRIGGER trg_notify_new_deal
AFTER INSERT ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_deal();

-- ─────────────────────────────────────────────────────────────────
-- 2) AFTER UPDATE — status change router
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_deal_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_name TEXT;
  v_buyer_name   TEXT;
  v_seller_name  TEXT;
BEGIN
  -- No change → nothing to do.
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_project_name FROM projects WHERE id = NEW.project_id;
  SELECT COALESCE(full_name, username, 'مستخدم') INTO v_buyer_name
    FROM profiles WHERE id = NEW.buyer_id;
  SELECT COALESCE(full_name, username, 'مستخدم') INTO v_seller_name
    FROM profiles WHERE id = NEW.seller_id;

  -- ════ accepted ════
  IF NEW.status = 'accepted' THEN
    PERFORM create_user_notification(
      p_user_id  := NEW.buyer_id,
      p_type     := 'deal_accepted'::notification_type,
      p_title    := 'تم قبول طلبك ✅',
      p_message  := v_seller_name || ' قبل بيع ' || NEW.shares::TEXT
                    || ' حصة من ' || COALESCE(v_project_name, 'المشروع'),
      p_priority := 'high'::notification_priority,
      p_link_url := '/deals/' || NEW.id::TEXT
    );

  -- ════ rejected ════
  ELSIF NEW.status = 'rejected' THEN
    PERFORM create_user_notification(
      p_user_id  := NEW.buyer_id,
      p_type     := 'deal_rejected'::notification_type,
      p_title    := 'تم رفض طلبك ❌',
      p_message  := 'تم رفض طلب الشراء من '
                    || COALESCE(v_project_name, 'المشروع'),
      p_priority := 'normal'::notification_priority,
      p_link_url := '/deals/' || NEW.id::TEXT
    );

  -- ════ payment_submitted ════
  ELSIF NEW.status = 'payment_submitted' THEN
    PERFORM create_user_notification(
      p_user_id  := NEW.seller_id,
      p_type     := 'payment_submitted'::notification_type,
      p_title    := 'تم تأكيد الدفع 💳',
      p_message  := v_buyer_name || ' أكّد دفع ' || NEW.shares::TEXT
                    || ' حصة. يرجى تحرير الحصص',
      p_priority := 'high'::notification_priority,
      p_link_url := '/deals/' || NEW.id::TEXT
    );

  -- ════ completed ════
  ELSIF NEW.status = 'completed' THEN
    -- buyer
    PERFORM create_user_notification(
      p_user_id  := NEW.buyer_id,
      p_type     := 'deal_completed'::notification_type,
      p_title    := 'تم استلام الحصص 🎉',
      p_message  := 'حصلت على ' || NEW.shares::TEXT
                    || ' حصة من ' || COALESCE(v_project_name, 'المشروع'),
      p_priority := 'high'::notification_priority,
      p_link_url := '/portfolio'
    );
    -- seller
    PERFORM create_user_notification(
      p_user_id  := NEW.seller_id,
      p_type     := 'deal_completed'::notification_type,
      p_title    := 'تم بيع الحصص 💰',
      p_message  := 'تم بيع ' || NEW.shares::TEXT
                    || ' حصة من ' || COALESCE(v_project_name, 'المشروع'),
      p_priority := 'high'::notification_priority,
      p_link_url := '/portfolio'
    );

  -- ════ cancelled ════
  ELSIF NEW.status = 'cancelled' THEN
    PERFORM create_user_notification(
      p_user_id  := NEW.buyer_id,
      p_type     := 'deal_cancelled'::notification_type,
      p_title    := 'تم إلغاء الصفقة',
      p_message  := 'تم إلغاء صفقتك على '
                    || COALESCE(v_project_name, 'المشروع'),
      p_priority := 'normal'::notification_priority,
      p_link_url := '/deals/' || NEW.id::TEXT
    );
    PERFORM create_user_notification(
      p_user_id  := NEW.seller_id,
      p_type     := 'deal_cancelled'::notification_type,
      p_title    := 'تم إلغاء الصفقة',
      p_message  := 'تم إلغاء صفقة على '
                    || COALESCE(v_project_name, 'المشروع'),
      p_priority := 'normal'::notification_priority,
      p_link_url := '/deals/' || NEW.id::TEXT
    );

  -- ════ expired ════
  ELSIF NEW.status = 'expired' THEN
    PERFORM create_user_notification(
      p_user_id  := NEW.buyer_id,
      p_type     := 'deal_expired'::notification_type,
      p_title    := 'انتهت صلاحية الصفقة ⏰',
      p_message  := 'انتهت مدة الصفقة على '
                    || COALESCE(v_project_name, 'المشروع'),
      p_priority := 'normal'::notification_priority,
      p_link_url := '/deals/' || NEW.id::TEXT
    );
    PERFORM create_user_notification(
      p_user_id  := NEW.seller_id,
      p_type     := 'deal_expired'::notification_type,
      p_title    := 'انتهت صلاحية الصفقة ⏰',
      p_message  := 'انتهت مدة الصفقة على '
                    || COALESCE(v_project_name, 'المشروع'),
      p_priority := 'normal'::notification_priority,
      p_link_url := '/deals/' || NEW.id::TEXT
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_on_deal_status_change failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_deal_status ON public.deals;
CREATE TRIGGER trg_notify_deal_status
AFTER UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_deal_status_change();
