
-- 1. Lock down public INSERT on application_files.
-- The backend (service role) performs inserts after verifying a valid token;
-- anon/authenticated users have no reason to insert directly.
DROP POLICY IF EXISTS application_files_public_insert ON public.application_files;
REVOKE INSERT ON public.application_files FROM anon, authenticated;

-- 2. SECURITY DEFINER helper to validate the upload path against an active token.
CREATE OR REPLACE FUNCTION public.mentor_app_upload_path_valid(_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.application_file_requests r
    WHERE r.application_id::text = split_part(_path, '/', 1)
      AND r.status = 'sent'
      AND r.expires_at > now()
  )
$$;

REVOKE EXECUTE ON FUNCTION public.mentor_app_upload_path_valid(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mentor_app_upload_path_valid(text) TO anon, authenticated;

-- 3. Tighten storage policy: require an active matching file request.
DROP POLICY IF EXISTS mentor_apps_anon_upload ON storage.objects;
CREATE POLICY mentor_apps_anon_upload
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'mentor-applications'
    AND public.mentor_app_upload_path_valid(name)
  );
