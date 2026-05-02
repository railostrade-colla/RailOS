-- ═══════════════════════════════════════════════════════════════════
-- Phase 2 — KYC notification triggers
-- Date: 2026-05-02
--
-- Trigger on public.kyc_submissions:
--   trg_notify_kyc_status  AFTER UPDATE  → routes by NEW.status:
--     approved → user (kyc_approved, high)
--     rejected → user (kyc_rejected, urgent — bypasses preferences)
--
-- Other status transitions (pending, not_submitted) are silent.
-- EXCEPTION-safe: trigger never aborts the original UPDATE.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_on_kyc_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No status change → nothing to do.
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- ════ approved ════
  IF NEW.status = 'approved' THEN
    PERFORM create_user_notification(
      p_user_id  := NEW.user_id,
      p_type     := 'kyc_approved'::notification_type,
      p_title    := 'تم التحقق من هويتك ✅',
      p_message  := 'تمت الموافقة على وثائق KYC. يمكنك الآن استخدام كافة ميزات المنصة',
      p_priority := 'high'::notification_priority,
      p_link_url := '/profile'
    );

  -- ════ rejected ════
  ELSIF NEW.status = 'rejected' THEN
    PERFORM create_user_notification(
      p_user_id  := NEW.user_id,
      p_type     := 'kyc_rejected'::notification_type,
      p_title    := 'تم رفض التحقق من الهوية ❌',
      p_message  := COALESCE(NEW.review_notes, 'يرجى مراجعة الوثائق وإعادة التقديم'),
      p_priority := 'urgent'::notification_priority,
      p_link_url := '/profile/kyc'
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_on_kyc_status_change failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_kyc_status ON public.kyc_submissions;
CREATE TRIGGER trg_notify_kyc_status
AFTER UPDATE ON public.kyc_submissions
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_kyc_status_change();
