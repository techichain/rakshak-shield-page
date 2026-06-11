
-- Table privileges (RLS already gates row visibility/modification)
GRANT INSERT ON public.applications TO anon, authenticated;
GRANT INSERT ON public.application_files TO anon, authenticated;
GRANT ALL ON public.applications TO service_role;
GRANT ALL ON public.application_files TO service_role;

-- Storage policy: allow anonymous uploads into mentor-applications/<uuid>/...
DROP POLICY IF EXISTS mentor_apps_anon_upload ON storage.objects;
CREATE POLICY mentor_apps_anon_upload
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'mentor-applications'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  );
