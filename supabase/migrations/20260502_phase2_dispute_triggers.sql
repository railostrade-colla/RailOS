-- ═══════════════════════════════════════════════════════════════════
-- Phase 2 — Dispute notification triggers
-- Date: 2026-05-02
--
-- Trigger on public.disputes:
--   trg_notify_dispute_opened  AFTER INSERT
--     → notifies the OTHER party of the deal (the one who didn't open
--       the dispute) with type `deal_disputed` at urgent priority,
--       which bypasses preferences (security/abuse-relevant).
--
-- EXCEPTION-safe: trigger never aborts the original INSERT.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_on_dispute_opened()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal           RECORD;
  v_other_party_id UUID;
  v_project_name   TEXT;
BEGIN
  -- Load the deal this dispute is on.
  SELECT * INTO v_deal FROM deals WHERE id = NEW.deal_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- The "other party" is whichever side did NOT open the dispute.
  IF NEW.opened_by = v_deal.buyer_id THEN
    v_other_party_id := v_deal.seller_id;
  ELSE
    v_other_party_id := v_deal.buyer_id;
  END IF;

  SELECT name INTO v_project_name FROM projects WHERE id = v_deal.project_id;

  PERFORM create_user_notification(
    p_user_id  := v_other_party_id,
    p_type     := 'deal_disputed'::notification_type,
    p_title    := 'تم فتح نزاع ⚠️',
    p_message  := 'تم فتح نزاع على صفقة '
                  || COALESCE(v_project_name, 'المشروع')
                  || '. السبب: '
                  || COALESCE(NEW.reason, 'غير محدد'),
    p_priority := 'urgent'::notification_priority,
    p_link_url := '/deals/' || NEW.deal_id::TEXT
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_on_dispute_opened failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_dispute_opened ON public.disputes;
CREATE TRIGGER trg_notify_dispute_opened
AFTER INSERT ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_dispute_opened();
