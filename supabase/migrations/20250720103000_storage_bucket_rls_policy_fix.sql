-- ===================================================
-- STORAGE BUCKET RLS POLICY FIX
-- Resolves "row-level security policy" errors
-- ===================================================

-- 1. Drop all existing conflicting policies
DROP POLICY IF EXISTS "Allow authenticated users to upload referral attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view referral attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to referral attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their own referral attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own referral attachments" ON storage.objects;

-- 2. Ensure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Create working policies
CREATE POLICY "authenticated_upload_referral_attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'referral_attachments');

CREATE POLICY "authenticated_select_referral_attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'referral_attachments');

CREATE POLICY "public_select_referral_attachments"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'referral_attachments');

CREATE POLICY "authenticated_update_own_referral_attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'referral_attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "authenticated_delete_own_referral_attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'referral_attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 4. Ensure bucket is properly configured
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('referral_attachments', 'referral_attachments', true, 10485760, null)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760;

-- 5. Verify setup
SELECT 
  'Bucket Check' as test,
  id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id = 'referral_attachments';

SELECT 
  'Policy Check' as test,
  policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
AND policyname LIKE '%referral_attachments%'; 