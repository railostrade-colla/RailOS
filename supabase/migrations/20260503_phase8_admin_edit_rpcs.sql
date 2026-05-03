-- ═══════════════════════════════════════════════════════════════════
-- Phase 8.2 — Admin edit RPCs (discounts + orphans)
-- Date: 2026-05-03
-- Idempotent: safe to re-run.
--
-- Adds the missing UPDATE RPCs that the admin panels need to fully
-- replace their "Form كامل قيد التطوير" placeholders with real edit
-- forms.
--
--   1. admin_update_discount(...)      — edit any field on a discount
--   2. admin_update_orphan_child(...)  — edit any field on a child
--
-- Both follow the existing convention:
--   • SECURITY DEFINER + is_admin() check
--   • All params optional except id — pass NULL to leave unchanged
--   • Validate basic constraints (percent 1–99, dates ordered, etc.)
--   • Return jsonb { success, error? } for the data layer
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. admin_update_discount ────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_discount(
  p_discount_id UUID,
  p_brand_name TEXT DEFAULT NULL,
  p_brand_logo_emoji TEXT DEFAULT NULL,
  p_category discount_category DEFAULT NULL,
  p_discount_percent INTEGER DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_starts_at TIMESTAMPTZ DEFAULT NULL,
  p_ends_at TIMESTAMPTZ DEFAULT NULL,
  p_max_uses INTEGER DEFAULT NULL,
  p_required_level TEXT DEFAULT NULL,
  p_cover_color TEXT DEFAULT NULL,
  p_conditions TEXT[] DEFAULT NULL,
  p_branches TEXT[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_starts TIMESTAMPTZ;
  v_ends TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_admin');
  END IF;

  SELECT * INTO v_existing FROM public.discount_brands
  WHERE id = p_discount_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;

  -- Cross-field validation: percent in range
  IF p_discount_percent IS NOT NULL
     AND (p_discount_percent < 1 OR p_discount_percent > 99) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_percent');
  END IF;

  -- Date ordering: ends_at must come after starts_at
  v_starts := COALESCE(p_starts_at, v_existing.starts_at);
  v_ends := COALESCE(p_ends_at, v_existing.ends_at);
  IF v_ends <= v_starts THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_dates');
  END IF;

  IF p_required_level IS NOT NULL
     AND p_required_level NOT IN ('basic', 'advanced', 'pro', 'elite') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_level');
  END IF;

  IF p_cover_color IS NOT NULL
     AND p_cover_color NOT IN ('red', 'blue', 'purple', 'orange', 'green', 'yellow') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_color');
  END IF;

  IF p_max_uses IS NOT NULL AND p_max_uses < v_existing.used_count THEN
    -- Don't let admins set max_uses below already-claimed count
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'max_uses_below_used',
      'used_count', v_existing.used_count
    );
  END IF;

  UPDATE public.discount_brands
  SET brand_name        = COALESCE(p_brand_name, brand_name),
      brand_logo_emoji  = COALESCE(p_brand_logo_emoji, brand_logo_emoji),
      category          = COALESCE(p_category, category),
      discount_percent  = COALESCE(p_discount_percent, discount_percent),
      description       = COALESCE(p_description, description),
      starts_at         = COALESCE(p_starts_at, starts_at),
      ends_at           = COALESCE(p_ends_at, ends_at),
      max_uses          = COALESCE(p_max_uses, max_uses),
      required_level    = COALESCE(p_required_level, required_level),
      cover_color       = COALESCE(p_cover_color, cover_color),
      conditions        = COALESCE(p_conditions, conditions),
      branches          = COALESCE(p_branches, branches),
      updated_at        = NOW()
  WHERE id = p_discount_id;

  RETURN jsonb_build_object('success', TRUE);
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_discount(
  UUID, TEXT, TEXT, discount_category, INTEGER, TEXT,
  TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, TEXT, TEXT, TEXT[], TEXT[]
) TO authenticated;

-- ─── 2. admin_update_orphan_child ────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_orphan_child(
  p_child_id UUID,
  p_first_name TEXT DEFAULT NULL,
  p_age INTEGER DEFAULT NULL,
  p_gender child_gender DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_education_level education_level DEFAULT NULL,
  p_needs_amount_monthly BIGINT DEFAULT NULL,
  p_story TEXT DEFAULT NULL,
  p_health_status TEXT DEFAULT NULL,
  p_blur_photo BOOLEAN DEFAULT NULL
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

  IF NOT EXISTS (
    SELECT 1 FROM public.orphan_children WHERE id = p_child_id
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;

  IF p_age IS NOT NULL AND (p_age < 0 OR p_age > 25) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_age');
  END IF;

  IF p_needs_amount_monthly IS NOT NULL AND p_needs_amount_monthly <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_amount');
  END IF;

  IF p_health_status IS NOT NULL
     AND p_health_status NOT IN ('good', 'monitoring', 'needs_care') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_health_status');
  END IF;

  UPDATE public.orphan_children
  SET first_name           = COALESCE(p_first_name, first_name),
      age                  = COALESCE(p_age, age),
      gender               = COALESCE(p_gender, gender),
      city                 = COALESCE(p_city, city),
      education_level      = COALESCE(p_education_level, education_level),
      needs_amount_monthly = COALESCE(p_needs_amount_monthly, needs_amount_monthly),
      story                = COALESCE(p_story, story),
      health_status        = COALESCE(p_health_status, health_status),
      blur_photo           = COALESCE(p_blur_photo, blur_photo),
      updated_at           = NOW()
  WHERE id = p_child_id;

  RETURN jsonb_build_object('success', TRUE);
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_orphan_child(
  UUID, TEXT, INTEGER, child_gender, TEXT, education_level,
  BIGINT, TEXT, TEXT, BOOLEAN
) TO authenticated;
