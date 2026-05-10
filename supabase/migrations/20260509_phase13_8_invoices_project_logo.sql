-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.8 — denormalise project_logo_url onto invoices
-- Date: 2026-05-09
-- Idempotent.
--
-- Why:
--   The printable invoice surface needs the project's logo. Joining
--   to projects at render time is fine when the project still exists,
--   but invoices are an audit trail — they must remain valid even if
--   the project gets renamed, re-skinned, or soft-deleted later. So
--   we copy the logo URL into the invoice row at the moment it's
--   issued, exactly like we already do for project_name.
--
-- This migration:
--   1. ALTER TABLE invoices ADD COLUMN IF NOT EXISTS project_logo_url
--   2. Backfill from projects.logo_url for rows that don't have it
--   3. Replace the trigger function so future invoices include it
-- ═══════════════════════════════════════════════════════════════════

-- 1. Column
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS project_logo_url TEXT;


-- 2. Backfill
UPDATE public.invoices i
SET project_logo_url = p.logo_url
FROM public.projects p
WHERE i.project_id = p.id
  AND i.project_logo_url IS NULL
  AND p.logo_url IS NOT NULL;


-- 3. Replace trigger function so new completions carry the logo
CREATE OR REPLACE FUNCTION public.trg_invoices_on_deal_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_name   TEXT;
  v_buyer_email  TEXT;
  v_seller_name  TEXT;
  v_seller_email TEXT;
  v_project_name   TEXT;
  v_project_symbol TEXT;
  v_project_logo   TEXT;
  v_price        BIGINT;
  v_buyer_inv_id  TEXT;
  v_seller_inv_id TEXT;
  v_completed     TIMESTAMPTZ;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.invoices WHERE source_id = NEW.id::TEXT) THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(NULLIF(TRIM(p.full_name), ''), NULLIF(TRIM(p.username), ''), 'مشتري'),
    u.email
  INTO v_buyer_name, v_buyer_email
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.id = NEW.buyer_id;

  SELECT
    COALESCE(NULLIF(TRIM(p.full_name), ''), NULLIF(TRIM(p.username), ''), 'بائع'),
    u.email
  INTO v_seller_name, v_seller_email
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.id = NEW.seller_id;

  SELECT name, symbol, logo_url
  INTO v_project_name, v_project_symbol, v_project_logo
  FROM public.projects
  WHERE id = NEW.project_id;

  v_buyer_name     := COALESCE(v_buyer_name,    'مشتري');
  v_seller_name    := COALESCE(v_seller_name,   'بائع');
  v_project_name   := COALESCE(v_project_name,  'مشروع');
  v_completed      := COALESCE(NEW.completed_at, NOW());

  IF NEW.shares IS NOT NULL AND NEW.shares > 0 THEN
    v_price := COALESCE(NEW.total_amount, 0) / NEW.shares;
  ELSE
    v_price := 0;
  END IF;

  v_buyer_inv_id  := public._invoice_build_id('B');
  v_seller_inv_id := public._invoice_build_id('S');

  INSERT INTO public.invoices (
    id, number, type, status,
    from_user_id, from_name, from_email,
    to_user_id,   to_name,   to_email,
    project_id, project_name, project_symbol, project_logo_url,
    shares_amount, price_per_share, subtotal,
    platform_fee_units, total_amount,
    source_id, digital_signature,
    issued_at, completed_at
  ) VALUES (
    v_buyer_inv_id,
    REPLACE(REPLACE(v_buyer_inv_id, 'INV-', ''), '-', ''),
    'exchange_buy', 'issued',
    NEW.seller_id, v_seller_name, v_seller_email,
    NEW.buyer_id,  v_buyer_name,  v_buyer_email,
    NEW.project_id, v_project_name, v_project_symbol, v_project_logo,
    COALESCE(NEW.shares, 0), v_price, COALESCE(NEW.total_amount, 0),
    COALESCE(NEW.buyer_commission, 0), COALESCE(NEW.total_amount, 0),
    NEW.id::TEXT,
    'RX' || UPPER(SUBSTRING(MD5(v_buyer_inv_id || NEW.id::TEXT) FROM 1 FOR 12)),
    v_completed, v_completed
  );

  INSERT INTO public.invoices (
    id, number, type, status,
    from_user_id, from_name, from_email,
    to_user_id,   to_name,   to_email,
    project_id, project_name, project_symbol, project_logo_url,
    shares_amount, price_per_share, subtotal,
    platform_fee_units, total_amount,
    source_id, digital_signature,
    issued_at, completed_at
  ) VALUES (
    v_seller_inv_id,
    REPLACE(REPLACE(v_seller_inv_id, 'INV-', ''), '-', ''),
    'exchange_sell', 'issued',
    NEW.buyer_id,  v_buyer_name,  v_buyer_email,
    NEW.seller_id, v_seller_name, v_seller_email,
    NEW.project_id, v_project_name, v_project_symbol, v_project_logo,
    COALESCE(NEW.shares, 0), v_price, COALESCE(NEW.total_amount, 0),
    COALESCE(NEW.seller_commission, 0), COALESCE(NEW.total_amount, 0),
    NEW.id::TEXT,
    'RX' || UPPER(SUBSTRING(MD5(v_seller_inv_id || NEW.id::TEXT) FROM 1 FOR 12)),
    v_completed, v_completed
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Invoice creation failed for deal %: % %', NEW.id, SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.8 invoices.project_logo_url applied.';
  RAISE NOTICE '  ✓ column added';
  RAISE NOTICE '  ✓ backfilled from projects.logo_url';
  RAISE NOTICE '  ✓ trigger updated to denormalise on new invoices';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
