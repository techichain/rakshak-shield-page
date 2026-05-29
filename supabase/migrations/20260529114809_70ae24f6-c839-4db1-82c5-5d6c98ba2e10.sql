UPDATE storage.buckets SET public = true WHERE id = 'observation-photos';

-- Allow public read access to objects in this bucket
DROP POLICY IF EXISTS "observation_photos_public_read" ON storage.objects;
CREATE POLICY "observation_photos_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'observation-photos');