-- ═══════════════════════════════════════════════════════════════════
-- Phase 7 — Social admin RPCs (healthcare + orphans + discounts)
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
-- All RPCs SECURITY DEFINER + is_admin() check.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- HEALTHCARE
-- ───────────────────────────────────────────────────────────────────

-- Create a healthcare crowdfunding case
CREATE OR REPLACE FUNCTION public.admin_create_healthcare_case(
  p_patient_display_name TEXT,
  p_patient_age INTEGER,
  p_city TEXT,
  p_disease_type disease_type,
  p_diagnosis TEXT,
  p_hospital TEXT,
  p_total_required BIGINT,
  p_is_urgent BOOLEAN DEFAULT FALSE,
  p_is_anonymous BOOLEAN DEFAULT TRUE,
  p_story TEXT DEFAULT NULL,
  p_treatment_plan TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_case_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  INSERT INTO public.healthcare_cases (
    patient_display_name, patient_age, city, disease_type,
    diagnosis, hospital, total_required, status,
    is_anonymous, story, treatment_plan, created_by
  ) VALUES (
    p_patient_display_name, p_patient_age, p_city, p_disease_type,
    p_diagnosis, p_hospital, p_total_required,
    CASE WHEN p_is_urgent THEN 'urgent'::healthcare_case_status
         ELSE 'active'::healthcare_case_status END,
    p_is_anonymous, p_story, p_treatment_plan, v_uid
  )
  RETURNING id INTO v_case_id;

  RETURN jsonb_build_object('success', TRUE, 'case_id', v_case_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_healthcare_case(
  TEXT, INTEGER, TEXT, disease_type, TEXT, TEXT, BIGINT,
  BOOLEAN, BOOLEAN, TEXT, TEXT
) TO authenticated;

-- Approve / reject a healthcare aid application
CREATE OR REPLACE FUNCTION public.admin_review_healthcare_application(
  p_application_id UUID,
  p_approve BOOLEAN,
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_app RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  SELECT * INTO v_app FROM public.healthcare_applications
  WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  IF v_app.status <> 'pending' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'already_reviewed');
  END IF;

  UPDATE public.healthcare_applications
  SET status = CASE WHEN p_approve THEN 'approved'::healthcare_application_status
                    ELSE 'rejected'::healthcare_application_status END,
      reviewed_by = v_uid,
      reviewed_at = NOW(),
      rejection_reason = CASE WHEN p_approve THEN NULL ELSE p_notes END,
      admin_notes = p_notes,
      updated_at = NOW()
  WHERE id = p_application_id;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_healthcare_application(UUID, BOOLEAN, TEXT) TO authenticated;

-- Update progress on a healthcare case (record manual amount adjustment)
CREATE OR REPLACE FUNCTION public.admin_update_case_progress(
  p_case_id UUID,
  p_new_amount_collected BIGINT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;
  IF p_new_amount_collected < 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_amount');
  END IF;

  SELECT * INTO v_case FROM public.healthcare_cases
  WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;

  UPDATE public.healthcare_cases
  SET amount_collected = p_new_amount_collected,
      status = CASE WHEN p_new_amount_collected >= total_required
                    THEN 'completed'::healthcare_case_status
                    ELSE status END,
      completed_at = CASE WHEN p_new_amount_collected >= total_required AND completed_at IS NULL
                          THEN NOW() ELSE completed_at END,
      updated_at = NOW()
  WHERE id = p_case_id;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_case_progress(UUID, BIGINT) TO authenticated;

-- Mark case completed (manual override)
CREATE OR REPLACE FUNCTION public.admin_mark_case_completed(
  p_case_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  UPDATE public.healthcare_cases
  SET status = 'completed', completed_at = NOW(), updated_at = NOW()
  WHERE id = p_case_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_mark_case_completed(UUID) TO authenticated;

-- ───────────────────────────────────────────────────────────────────
-- ORPHANS
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_create_orphan_child(
  p_first_name TEXT,
  p_age INTEGER,
  p_gender child_gender,
  p_city TEXT,
  p_education_level education_level,
  p_needs_amount_monthly BIGINT,
  p_story TEXT DEFAULT NULL,
  p_health_status TEXT DEFAULT 'good',
  p_blur_photo BOOLEAN DEFAULT TRUE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_child_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  INSERT INTO public.orphan_children (
    first_name, age, gender, city, education_level,
    needs_amount_monthly, story, health_status, blur_photo, created_by
  ) VALUES (
    p_first_name, p_age, p_gender, p_city, p_education_level,
    p_needs_amount_monthly, p_story, p_health_status, p_blur_photo, v_uid
  )
  RETURNING id INTO v_child_id;

  RETURN jsonb_build_object('success', TRUE, 'child_id', v_child_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_orphan_child(
  TEXT, INTEGER, child_gender, TEXT, education_level, BIGINT, TEXT, TEXT, BOOLEAN
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_remove_orphan_child(
  p_child_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  DELETE FROM public.orphan_children WHERE id = p_child_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_remove_orphan_child(UUID) TO authenticated;

-- Send a progress report to all active sponsors of a child
CREATE OR REPLACE FUNCTION public.admin_send_orphan_report(
  p_child_id UUID,
  p_period TEXT,
  p_education_progress TEXT DEFAULT NULL,
  p_health_status TEXT DEFAULT NULL,
  p_highlights TEXT DEFAULT NULL,
  p_photos_count INTEGER DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_recipients INT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  -- Insert one report row per active sponsor (so each sponsor gets
  -- a personalised entry in their reports list).
  INSERT INTO public.orphan_reports (
    child_id, sponsor_id, period, education_progress,
    health_status, highlights, photos_count, created_by
  )
  SELECT p_child_id, s.sponsor_id, p_period, p_education_progress,
         p_health_status, p_highlights, p_photos_count, v_uid
  FROM public.sponsorships s
  WHERE s.child_id = p_child_id AND s.status = 'active'
    AND s.receive_reports = TRUE;

  GET DIAGNOSTICS v_recipients = ROW_COUNT;

  RETURN jsonb_build_object('success', TRUE, 'recipients', v_recipients);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_send_orphan_report(
  UUID, TEXT, TEXT, TEXT, TEXT, INTEGER
) TO authenticated;

-- ───────────────────────────────────────────────────────────────────
-- DISCOUNTS
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_create_discount(
  p_brand_name TEXT,
  p_brand_logo_emoji TEXT,
  p_category discount_category,
  p_discount_percent INTEGER,
  p_description TEXT,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_max_uses INTEGER,
  p_required_level TEXT DEFAULT 'basic',
  p_cover_color TEXT DEFAULT 'blue',
  p_conditions TEXT[] DEFAULT '{}',
  p_branches TEXT[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_discount_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;
  IF p_discount_percent < 1 OR p_discount_percent > 99 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_percent');
  END IF;
  IF p_ends_at <= p_starts_at THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_dates');
  END IF;

  INSERT INTO public.discount_brands (
    brand_name, brand_logo_emoji, category, discount_percent,
    description, conditions, branches, required_level,
    starts_at, ends_at, max_uses, cover_color, created_by
  ) VALUES (
    p_brand_name, p_brand_logo_emoji, p_category, p_discount_percent,
    p_description, p_conditions, p_branches, p_required_level,
    p_starts_at, p_ends_at, p_max_uses, p_cover_color, v_uid
  )
  RETURNING id INTO v_discount_id;

  RETURN jsonb_build_object('success', TRUE, 'discount_id', v_discount_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_discount(
  TEXT, TEXT, discount_category, INTEGER, TEXT,
  TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, TEXT, TEXT, TEXT[], TEXT[]
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_discount_active(
  p_discount_id UUID,
  p_is_active BOOLEAN
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  UPDATE public.discount_brands
  SET is_active = p_is_active, updated_at = NOW()
  WHERE id = p_discount_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_discount_active(UUID, BOOLEAN) TO authenticated;
