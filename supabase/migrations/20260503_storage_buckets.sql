-- ═══════════════════════════════════════════════════════════════════
-- Storage buckets + RLS policies
-- Date: 2026-05-03
--
-- Creates 4 buckets and the RLS policies on `storage.objects` that
-- restrict who can read/write each one.
--
-- Path convention: every object lives under a folder named with the
-- owner's auth.uid() — `<user_id>/<filename>`. The policies check
-- `(storage.foldername(name))[1] = auth.uid()::text` so a user can
-- only touch their own folder.
--
-- Idempotent: each CREATE has DROP IF EXISTS first, INSERT uses
-- ON CONFLICT DO NOTHING.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. Create the 4 buckets
-- ─────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('kyc-documents',     'kyc-documents',     false),  -- private
  ('payment-proofs',    'payment-proofs',    false),  -- private
  ('user-avatars',      'user-avatars',      true),   -- public read
  ('project-galleries', 'project-galleries', true)    -- public read
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- 2. kyc-documents — owner-only (4 policies)
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "kyc_owner_select" ON storage.objects;
CREATE POLICY "kyc_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "kyc_owner_insert" ON storage.objects;
CREATE POLICY "kyc_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "kyc_owner_update" ON storage.objects;
CREATE POLICY "kyc_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "kyc_owner_delete" ON storage.objects;
CREATE POLICY "kyc_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────────
-- 3. payment-proofs — owner-only (4 policies, same pattern)
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "payproof_owner_select" ON storage.objects;
CREATE POLICY "payproof_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "payproof_owner_insert" ON storage.objects;
CREATE POLICY "payproof_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "payproof_owner_update" ON storage.objects;
CREATE POLICY "payproof_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "payproof_owner_delete" ON storage.objects;
CREATE POLICY "payproof_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────────
-- 4. user-avatars — public read (via bucket flag), owner write
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "avatar_owner_insert" ON storage.objects;
CREATE POLICY "avatar_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatar_owner_update" ON storage.objects;
CREATE POLICY "avatar_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatar_owner_delete" ON storage.objects;
CREATE POLICY "avatar_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────────
-- 5. project-galleries — public read only via bucket flag.
--    INSERT/UPDATE/DELETE intentionally left without policies — only
--    service_role (admin tools) can write. This avoids the cost of
--    embedding admin-role checks in every storage policy.
-- ─────────────────────────────────────────────────────────────────
-- (no policies needed — everything blocked by default for authenticated
--  users; service_role bypasses RLS entirely.)
