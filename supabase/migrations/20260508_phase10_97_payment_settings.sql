-- ═══════════════════════════════════════════════════════════════════
-- Phase 10.97 — Payment settings (master card / transfer phone / instructions)
-- Date: 2026-05-08
-- Idempotent: safe to re-run.
--
-- Single-row config table the platform admin uses to publish:
--   • master_card_number  — the platform's MasterCard / bank card #
--   • master_card_holder  — name on card
--   • transfer_phone      — Zain Cash / Asia Hawala number for users
--   • support_phone       — phone admin can be reached on
--   • payment_instructions— free-text guidance shown in checkout modals
--
-- The values are READABLE by any authenticated user (so the buy modal
-- can display them) and WRITABLE by super_admin only.
-- ═══════════════════════════════════════════════════════════════════


CREATE TABLE IF NOT EXISTS public.payment_settings (
  id                   INT PRIMARY KEY DEFAULT 1,
  master_card_number   TEXT,
  master_card_holder   TEXT,
  transfer_phone       TEXT,
  support_phone        TEXT,
  payment_instructions TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by           UUID REFERENCES public.profiles(id),
  CONSTRAINT only_one_row CHECK (id = 1)
);

-- Seed an empty row so the get RPC always returns something.
INSERT INTO public.payment_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS: read = any authenticated user; write = via RPC only ───
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_settings_read ON public.payment_settings;
CREATE POLICY payment_settings_read ON public.payment_settings
  FOR SELECT TO authenticated
  USING (TRUE);


-- ─── get_payment_settings: any auth'd user can read ───────────────
CREATE OR REPLACE FUNCTION public.get_payment_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT *
    INTO v_row
  FROM public.payment_settings
   WHERE id = 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'master_card_number',   NULL,
      'master_card_holder',   NULL,
      'transfer_phone',       NULL,
      'support_phone',        NULL,
      'payment_instructions', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'master_card_number',   v_row.master_card_number,
    'master_card_holder',   v_row.master_card_holder,
    'transfer_phone',       v_row.transfer_phone,
    'support_phone',        v_row.support_phone,
    'payment_instructions', v_row.payment_instructions,
    'updated_at',           v_row.updated_at
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_payment_settings() TO authenticated;


-- ─── admin_set_payment_settings: super_admin only ─────────────────
CREATE OR REPLACE FUNCTION public.admin_set_payment_settings(
  p_master_card_number   TEXT DEFAULT NULL,
  p_master_card_holder   TEXT DEFAULT NULL,
  p_transfer_phone       TEXT DEFAULT NULL,
  p_support_phone        TEXT DEFAULT NULL,
  p_payment_instructions TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role <> 'super_admin' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'super_admin_only');
  END IF;

  INSERT INTO public.payment_settings (
    id, master_card_number, master_card_holder,
    transfer_phone, support_phone, payment_instructions,
    updated_at, updated_by
  ) VALUES (
    1,
    NULLIF(trim(COALESCE(p_master_card_number, '')), ''),
    NULLIF(trim(COALESCE(p_master_card_holder, '')), ''),
    NULLIF(trim(COALESCE(p_transfer_phone, '')), ''),
    NULLIF(trim(COALESCE(p_support_phone, '')), ''),
    NULLIF(trim(COALESCE(p_payment_instructions, '')), ''),
    NOW(), v_uid
  )
  ON CONFLICT (id) DO UPDATE SET
    master_card_number   = COALESCE(NULLIF(trim(COALESCE(EXCLUDED.master_card_number, '')), ''), public.payment_settings.master_card_number),
    master_card_holder   = COALESCE(NULLIF(trim(COALESCE(EXCLUDED.master_card_holder, '')), ''), public.payment_settings.master_card_holder),
    transfer_phone       = COALESCE(NULLIF(trim(COALESCE(EXCLUDED.transfer_phone, '')), ''), public.payment_settings.transfer_phone),
    support_phone        = COALESCE(NULLIF(trim(COALESCE(EXCLUDED.support_phone, '')), ''), public.payment_settings.support_phone),
    payment_instructions = COALESCE(NULLIF(trim(COALESCE(EXCLUDED.payment_instructions, '')), ''), public.payment_settings.payment_instructions),
    updated_at           = NOW(),
    updated_by           = v_uid;

  -- Audit
  BEGIN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_uid, 'update_payment_settings', 'payment_settings', NULL,
      jsonb_build_object(
        'has_card', p_master_card_number IS NOT NULL,
        'has_phone', p_transfer_phone IS NOT NULL
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', TRUE);
END $$;

REVOKE ALL ON FUNCTION public.admin_set_payment_settings(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_payment_settings(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- ─── Add proof_image_url to fee_unit_requests if missing ──────────
-- (Phase 10.97 makes the field user-supplied via the request modal.)
ALTER TABLE public.fee_unit_requests
  ALTER COLUMN proof_image_url DROP NOT NULL;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Phase 10.97 applied:';
  RAISE NOTICE '  ✓ payment_settings table (single row, id=1)';
  RAISE NOTICE '  ✓ get_payment_settings() — readable by any auth user';
  RAISE NOTICE '  ✓ admin_set_payment_settings() — super_admin only';
  RAISE NOTICE '  ✓ fee_unit_requests.proof_image_url is now nullable';
  RAISE NOTICE '═══════════════════════════════════════';
END $$;
