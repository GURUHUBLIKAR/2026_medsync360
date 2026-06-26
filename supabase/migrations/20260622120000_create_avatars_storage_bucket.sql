-- Create Avatars Storage Bucket
-- Public bucket for user profile photos. Uploaded from Settings → Profile.
-- Path convention: `<auth.uid()>/avatar-<timestamp>.<ext>` (see Settings.tsx),
-- which lines up with the per-user folder policies below.

-- Create the storage bucket for avatars (public so getPublicUrl works directly)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,            -- Public read (profile photos are shown across the app)
  5242880,         -- 5MB file size limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
) ON CONFLICT (id) DO NOTHING;

-- RLS policies for the avatars bucket (idempotent: drop-then-create).

-- Policy 1: Anyone can read avatar images
DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
CREATE POLICY "Avatar images are publicly readable" ON storage.objects
FOR SELECT USING (
  bucket_id = 'avatars'
);

-- Policy 2: Authenticated users can upload to their own folder
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Authenticated users can replace (upsert) their own avatar
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Authenticated users can delete their own avatar
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

COMMENT ON POLICY "Avatar images are publicly readable" ON storage.objects IS 'Anyone can read profile photos from the avatars bucket';
COMMENT ON POLICY "Users can upload their own avatar" ON storage.objects IS 'Authenticated users can upload to their own <uid>/ folder in avatars';
COMMENT ON POLICY "Users can update their own avatar" ON storage.objects IS 'Authenticated users can overwrite their own avatar (upsert)';
COMMENT ON POLICY "Users can delete their own avatar" ON storage.objects IS 'Authenticated users can delete their own avatar';
