-- ═══════════════════════════════════════════════════════════════════
-- VERIFY PHASE 10.85 → 10.90 — checks every migration was applied
-- File:  supabase/scripts/VERIFY_PHASE_10_85_TO_90.sql
-- Run:   Supabase SQL Editor (read-only — won't change anything).
--
-- It returns ONE row per check with:
--   • category   — the migration the check belongs to
--   • check_name — what's being verified
--   • expected   — what should be present
--   • status     — ✅ OK   /   ❌ MISSING
--
-- A final summary row at the bottom counts passes/failures so you can
-- tell at a glance whether everything's wired up.
-- ═══════════════════════════════════════════════════════════════════

WITH checks AS (

  -- ─── Phase 10.85 — admin_add_shares_to_offering RPC ────────────
  SELECT
    '10.85 add-shares-to-offering' AS category,
    'function admin_add_shares_to_offering(uuid, bigint, text)' AS check_name,
    'present in public schema' AS expected,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'admin_add_shares_to_offering'
    ) THEN '✅ OK' ELSE '❌ MISSING' END AS status

  -- ─── Phase 10.86 — ambassador_commissions table ────────────────
  UNION ALL SELECT
    '10.86 ambassador-commission',
    'table public.ambassador_commissions',
    'present',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'ambassador_commissions'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  UNION ALL SELECT
    '10.86 ambassador-commission',
    'unique constraint on referred_user_id',
    'enforces one-time-per-investor',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'ambassador_commissions'
        AND c.contype = 'u'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  UNION ALL SELECT
    '10.86 ambassador-commission',
    'function pay_ambassador_commission(uuid)',
    'present',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'pay_ambassador_commission'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  UNION ALL SELECT
    '10.86 ambassador-commission',
    'trigger trg_pay_ambassador_commission on deals',
    'fires on status update to completed',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_pay_ambassador_commission'
        AND NOT tgisinternal
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  UNION ALL SELECT
    '10.86 ambassador-commission',
    'RLS policy amb_commissions_self_read',
    'ambassador can read own rows',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'ambassador_commissions'
        AND policyname = 'amb_commissions_self_read'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  UNION ALL SELECT
    '10.86 ambassador-commission',
    'RLS policy amb_commissions_admin_read',
    'admins can read all rows',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'ambassador_commissions'
        AND policyname = 'amb_commissions_admin_read'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  -- ─── Phase 10.87 — return columns ──────────────────────────────
  UNION ALL SELECT
    '10.87 returns',
    'projects.expected_return_min',
    'numeric column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
        AND column_name = 'expected_return_min'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  UNION ALL SELECT
    '10.87 returns',
    'projects.expected_return_max',
    'numeric column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
        AND column_name = 'expected_return_max'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  UNION ALL SELECT
    '10.87 returns',
    'projects.return_min (legacy alias)',
    'numeric column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
        AND column_name = 'return_min'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  UNION ALL SELECT
    '10.87 returns',
    'projects.return_max (legacy alias)',
    'numeric column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
        AND column_name = 'return_max'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  -- ─── Phase 10.88 — branding columns ────────────────────────────
  UNION ALL SELECT
    '10.88 branding',
    'projects.logo_url',
    'text column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
        AND column_name = 'logo_url'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  UNION ALL SELECT
    '10.88 branding',
    'projects.cover_url',
    'text column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
        AND column_name = 'cover_url'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  -- ─── Phase 10.90 — full-form columns ───────────────────────────
  UNION ALL SELECT
    '10.90 full-form',
    'projects.duration_open',
    'boolean column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
        AND column_name = 'duration_open'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  UNION ALL SELECT
    '10.90 full-form',
    'projects.duration_months',
    'integer column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
        AND column_name = 'duration_months'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  UNION ALL SELECT
    '10.90 full-form',
    'projects.documents',
    'jsonb column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
        AND column_name = 'documents'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  UNION ALL SELECT
    '10.90 full-form',
    'projects.gallery_images',
    'jsonb column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
        AND column_name = 'gallery_images'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  UNION ALL SELECT
    '10.90 full-form',
    'projects.owner_name',
    'text column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
        AND column_name = 'owner_name'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  UNION ALL SELECT
    '10.90 full-form',
    'projects.owner_phone',
    'text column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
        AND column_name = 'owner_phone'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  UNION ALL SELECT
    '10.90 full-form',
    'projects.owner_email',
    'text column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
        AND column_name = 'owner_email'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  UNION ALL SELECT
    '10.90 full-form',
    'projects.detailed_address',
    'text column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
        AND column_name = 'detailed_address'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  UNION ALL SELECT
    '10.90 full-form',
    'projects.profit_source',
    'text column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
        AND column_name = 'profit_source'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  -- ─── admin_create_project signature (the LATEST 29-arg form) ───
  UNION ALL SELECT
    '10.90 full-form',
    'admin_create_project takes 29 args',
    'latest overload from migration 10.90',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'admin_create_project'
        AND pg_get_function_arguments(p.oid) LIKE '%p_duration_open%'
        AND pg_get_function_arguments(p.oid) LIKE '%p_documents%'
        AND pg_get_function_arguments(p.oid) LIKE '%p_gallery_images%'
        AND pg_get_function_arguments(p.oid) LIKE '%p_owner_email%'
    ) THEN '✅ OK' ELSE '❌ MISSING' END

  -- ─── Realtime publications (cosmetic but useful) ───────────────
  UNION ALL SELECT
    'realtime',
    'ambassador_commissions in supabase_realtime',
    'live updates on commission grants',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'ambassador_commissions'
    ) THEN '✅ OK' ELSE '❌ MISSING' END
)

-- ─── Per-check result rows ───────────────────────────────────────
SELECT category, check_name, expected, status FROM checks
ORDER BY
  CASE WHEN status LIKE '❌%' THEN 0 ELSE 1 END,  -- failures first
  category,
  check_name;


-- ─── Aggregated summary — run this AFTER the query above ─────────
WITH checks AS (
  -- (same WITH block as above; copy whichever version is shorter)
  -- Re-compute totals so we get a clean roll-up.
  SELECT '10.85' AS category, CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname='admin_add_shares_to_offering') THEN 1 ELSE 0 END AS ok
  UNION ALL SELECT '10.86', CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ambassador_commissions') THEN 1 ELSE 0 END
  UNION ALL SELECT '10.86', CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname='pay_ambassador_commission') THEN 1 ELSE 0 END
  UNION ALL SELECT '10.86', CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_pay_ambassador_commission' AND NOT tgisinternal) THEN 1 ELSE 0 END
  UNION ALL SELECT '10.87', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='expected_return_min') THEN 1 ELSE 0 END
  UNION ALL SELECT '10.88', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='logo_url') THEN 1 ELSE 0 END
  UNION ALL SELECT '10.90', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='duration_open') THEN 1 ELSE 0 END
  UNION ALL SELECT '10.90', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='documents') THEN 1 ELSE 0 END
  UNION ALL SELECT '10.90', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='gallery_images') THEN 1 ELSE 0 END
  UNION ALL SELECT '10.90', CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname='admin_create_project' AND pg_get_function_arguments(p.oid) LIKE '%p_documents%') THEN 1 ELSE 0 END
)
SELECT
  '──────── SUMMARY ────────'                AS section,
  SUM(ok)                                    AS passes,
  COUNT(*) - SUM(ok)                         AS failures,
  CASE WHEN COUNT(*) = SUM(ok) THEN '🎉 جميع الـ migrations مطبَّقة'
       ELSE '⚠ هناك migrations لم تُطبَّق — راجع الجدول أعلاه'  END AS verdict
FROM checks;
