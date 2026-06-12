DROP POLICY IF EXISTS application_files_public_insert ON public.application_files;

CREATE POLICY application_files_public_insert
  ON public.application_files
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

GRANT INSERT ON public.application_files TO anon, authenticated;