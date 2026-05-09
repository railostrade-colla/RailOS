-- ═══════════════════════════════════════════════════════════════════
-- Phase 13.7 — invoices table + auto-issue trigger on deal completion
-- Date: 2026-05-09
-- Idempotent.
--
-- Why:
--   The InvoicesAdminPanel reads from a `public.invoices` table that
--   never existed on production. The fallback in lib/data/invoices.ts
--   read localStorage instead, so admins saw the empty-state forever.
--
-- This migration:
--   1. Creates the `invoices` table with full audit columns + RLS.
--   2. Adds an AFTER UPDATE trigger on `deals` that auto-inserts TWO
--      invoices (one for buyer = exchange_buy, one for seller =
--      exchange_sell) the moment a deal flips to status='completed'.
--   3. Backfills invoices for every already-completed deal.
--   4. Publishes the table on supabase_realtime so the admin panel
--      can subscribe and see new invoices appear instantly.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  -- Primary key — human-readable: INV-YYYY-MM-DD-XXXX
  id              TEXT PRIMARY KEY,
  number          TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN (
                    'exchange_buy', 'exchange_sell',
                    'quick_sell_buy', 'quick_sell_sell',
                    'direct_buy', 'auction_win',
                    'transfer_send', 'transfer_receive'
                  )),
  status          TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'voided')),

  -- Parties (denormalised so the invoice stays valid even if the
  -- profile gets renamed/deleted later; from_user_id / to_user_id
  -- are FKs to auth.users, but ON DELETE SET NULL — never block).
  from_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  from_name       TEXT NOT NULL,
  from_email      TEXT,
  from_phone      TEXT,

  to_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_name         TEXT NOT NULL,
  to_email        TEXT,
  to_phone        TEXT,

  -- Project + amounts
  project_id      UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  project_name    TEXT NOT NULL,
  project_symbol  TEXT,
  shares_amount   BIGINT NOT NULL,
  price_per_share BIGINT NOT NULL,
  subtotal        BIGINT NOT NULL,

  -- Fees + final
  platform_fee_units BIGINT DEFAULT 0,
  total_amount       BIGINT NOT NULL,

  -- Link back to the source row that triggered the invoice.
  source_id       TEXT,
  digital_signature TEXT NOT NULL,

  -- Timing
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  notes           TEXT
);

-- Indexes for the typical queries.
CREATE INDEX IF NOT EXISTS idx_invoices_completed_at  ON public.invoices(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_source_id     ON public.invoices(source_id);
CREATE INDEX IF NOT EXISTS idx_invoices_from_user_id  ON public.invoices(from_user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_to_user_id    ON public.invoices(to_user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id    ON public.invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_type          ON public.invoices(type);


-- ─── 2. RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Users see invoices where they are buyer OR seller.
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.invoices;
CREATE POLICY "Users can view their own invoices"
ON public.invoices
FOR SELECT
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Admins see every invoice.
DROP POLICY IF EXISTS "Admins can view all invoices" ON public.invoices;
CREATE POLICY "Admins can view all invoices"
ON public.invoices
FOR SELECT
USING (public.is_admin());

-- Admins can void / annotate.
DROP POLICY IF EXISTS "Admins can update invoices" ON public.invoices;
CREATE POLICY "Admins can update invoices"
ON public.invoices
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- INSERT/DELETE deliberately not granted to anyone — invoices are
-- inserted ONLY by the SECURITY DEFINER trigger below.


-- ─── 3. Helper: build an invoice id ─────────────────────────────────
CREATE OR REPLACE FUNCTION public._invoice_build_id(p_suffix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_today TEXT := TO_CHAR(NOW(), 'YYYY-MM-DD');
  v_rand  TEXT := UPPER(SUBSTRING(MD5(p_suffix || NOW()::TEXT || RANDOM()::TEXT) FROM 1 FOR 4));
BEGIN
  RETURN 'INV-' || v_today || '-' || v_rand || p_suffix;
END;
$$;


-- ─── 4. Trigger function — auto-issue 2 invoices on deal completion ─
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
  v_price        BIGINT;
  v_buyer_inv_id  TEXT;
  v_seller_inv_id TEXT;
  v_completed     TIMESTAMPTZ;
BEGIN
  -- Only fire on a transition INTO 'completed'.
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'completed' THEN
    RETURN NEW;  -- already completed before, don't re-issue
  END IF;

  -- Skip if invoices already exist for this deal (idempotent).
  IF EXISTS (SELECT 1 FROM public.invoices WHERE source_id = NEW.id::TEXT) THEN
    RETURN NEW;
  END IF;

  -- Resolve party + project metadata.
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

  SELECT name, symbol
  INTO v_project_name, v_project_symbol
  FROM public.projects
  WHERE id = NEW.project_id;

  v_buyer_name     := COALESCE(v_buyer_name,    'مشتري');
  v_seller_name    := COALESCE(v_seller_name,   'بائع');
  v_project_name   := COALESCE(v_project_name,  'مشروع');
  v_completed      := COALESCE(NEW.completed_at, NOW());

  -- Per-share price (guard divide-by-zero).
  IF NEW.shares IS NOT NULL AND NEW.shares > 0 THEN
    v_price := COALESCE(NEW.total_amount, 0) / NEW.shares;
  ELSE
    v_price := 0;
  END IF;

  v_buyer_inv_id  := public._invoice_build_id('B');
  v_seller_inv_id := public._invoice_build_id('S');

  -- ─ Buyer invoice (exchange_buy): from = seller, to = buyer ─
  INSERT INTO public.invoices (
    id, number, type, status,
    from_user_id, from_name, from_email,
    to_user_id,   to_name,   to_email,
    project_id, project_name, project_symbol,
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
    NEW.project_id, v_project_name, v_project_symbol,
    COALESCE(NEW.shares, 0), v_price, COALESCE(NEW.total_amount, 0),
    COALESCE(NEW.buyer_commission, 0), COALESCE(NEW.total_amount, 0),
    NEW.id::TEXT,
    'RX' || UPPER(SUBSTRING(MD5(v_buyer_inv_id || NEW.id::TEXT) FROM 1 FOR 12)),
    v_completed, v_completed
  );

  -- ─ Seller invoice (exchange_sell): from = buyer, to = seller ─
  INSERT INTO public.invoices (
    id, number, type, status,
    from_user_id, from_name, from_email,
    to_user_id,   to_name,   to_email,
    project_id, project_name, project_symbol,
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
    NEW.project_id, v_project_name, v_project_symbol,
    COALESCE(NEW.shares, 0), v_price, COALESCE(NEW.total_amount, 0),
    COALESCE(NEW.seller_commission, 0), COALESCE(NEW.total_amount, 0),
    NEW.id::TEXT,
    'RX' || UPPER(SUBSTRING(MD5(v_seller_inv_id || NEW.id::TEXT) FROM 1 FOR 12)),
    v_completed, v_completed
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never break the deal flow because of an invoice issue.
  RAISE WARNING 'Invoice creation failed for deal %: % %', NEW.id, SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$;


-- ─── 5. Trigger binding ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_invoices_on_deal_complete ON public.deals;
CREATE TRIGGER trg_invoices_on_deal_complete
AFTER UPDATE OF status ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.trg_invoices_on_deal_complete();


-- ─── 6. Backfill — issue invoices for every already-completed deal ──
DO $$
DECLARE
  v_deal RECORD;
  v_buyer_name TEXT; v_buyer_email TEXT;
  v_seller_name TEXT; v_seller_email TEXT;
  v_project_name TEXT; v_project_symbol TEXT;
  v_price BIGINT;
  v_buyer_inv_id TEXT; v_seller_inv_id TEXT;
  v_completed TIMESTAMPTZ;
  v_count INT := 0;
BEGIN
  FOR v_deal IN
    SELECT d.*
    FROM public.deals d
    WHERE d.status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM public.invoices i WHERE i.source_id = d.id::TEXT
      )
  LOOP
    SELECT COALESCE(NULLIF(TRIM(p.full_name), ''), NULLIF(TRIM(p.username), ''), 'مشتري'), u.email
    INTO v_buyer_name, v_buyer_email
    FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.id = v_deal.buyer_id;

    SELECT COALESCE(NULLIF(TRIM(p.full_name), ''), NULLIF(TRIM(p.username), ''), 'بائع'), u.email
    INTO v_seller_name, v_seller_email
    FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.id = v_deal.seller_id;

    SELECT name, symbol INTO v_project_name, v_project_symbol
    FROM public.projects WHERE id = v_deal.project_id;

    v_buyer_name   := COALESCE(v_buyer_name,   'مشتري');
    v_seller_name  := COALESCE(v_seller_name,  'بائع');
    v_project_name := COALESCE(v_project_name, 'مشروع');
    v_completed    := COALESCE(v_deal.completed_at, v_deal.created_at, NOW());

    IF v_deal.shares IS NOT NULL AND v_deal.shares > 0 THEN
      v_price := COALESCE(v_deal.total_amount, 0) / v_deal.shares;
    ELSE
      v_price := 0;
    END IF;

    v_buyer_inv_id  := public._invoice_build_id('B');
    v_seller_inv_id := public._invoice_build_id('S');

    INSERT INTO public.invoices (
      id, number, type, status,
      from_user_id, from_name, from_email,
      to_user_id,   to_name,   to_email,
      project_id, project_name, project_symbol,
      shares_amount, price_per_share, subtotal,
      platform_fee_units, total_amount,
      source_id, digital_signature,
      issued_at, completed_at
    ) VALUES
    (
      v_buyer_inv_id,
      REPLACE(REPLACE(v_buyer_inv_id, 'INV-', ''), '-', ''),
      'exchange_buy', 'issued',
      v_deal.seller_id, v_seller_name, v_seller_email,
      v_deal.buyer_id,  v_buyer_name,  v_buyer_email,
      v_deal.project_id, v_project_name, v_project_symbol,
      COALESCE(v_deal.shares, 0), v_price, COALESCE(v_deal.total_amount, 0),
      COALESCE(v_deal.buyer_commission, 0), COALESCE(v_deal.total_amount, 0),
      v_deal.id::TEXT,
      'RX' || UPPER(SUBSTRING(MD5(v_buyer_inv_id || v_deal.id::TEXT) FROM 1 FOR 12)),
      v_completed, v_completed
    ),
    (
      v_seller_inv_id,
      REPLACE(REPLACE(v_seller_inv_id, 'INV-', ''), '-', ''),
      'exchange_sell', 'issued',
      v_deal.buyer_id,  v_buyer_name,  v_buyer_email,
      v_deal.seller_id, v_seller_name, v_seller_email,
      v_deal.project_id, v_project_name, v_project_symbol,
      COALESCE(v_deal.shares, 0), v_price, COALESCE(v_deal.total_amount, 0),
      COALESCE(v_deal.seller_commission, 0), COALESCE(v_deal.total_amount, 0),
      v_deal.id::TEXT,
      'RX' || UPPER(SUBSTRING(MD5(v_seller_inv_id || v_deal.id::TEXT) FROM 1 FOR 12)),
      v_completed, v_completed
    );

    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Backfill: issued % invoice pairs for completed deals.', v_count;
END $$;


-- ─── 7. Publish on supabase_realtime ────────────────────────────────
DO $$
BEGIN
  -- Add to publication only if not already there.
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'invoices'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices';
  END IF;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'supabase_realtime publication not found — skipping.';
END $$;


DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Phase 13.7 invoices applied.';
  RAISE NOTICE '  ✓ table public.invoices';
  RAISE NOTICE '  ✓ RLS: users see own / admin sees all';
  RAISE NOTICE '  ✓ trigger trg_invoices_on_deal_complete on deals';
  RAISE NOTICE '  ✓ backfill for completed deals';
  RAISE NOTICE '  ✓ supabase_realtime publication';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
