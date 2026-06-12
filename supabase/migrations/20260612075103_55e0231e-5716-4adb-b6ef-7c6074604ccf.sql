
-- Tighten rp_evaluations write policy: caller must hold evaluator/mentor/admin role.
-- Existing policy only checked evaluator_id = auth.uid(), allowing any signed-in
-- user to write their own evaluation row.
DROP POLICY IF EXISTS rp_eval_own_rw ON public.rp_evaluations;
CREATE POLICY rp_eval_own_rw ON public.rp_evaluations
  FOR ALL
  TO authenticated
  USING (
    evaluator_id = auth.uid()
    AND (
      public.rp_has_role(auth.uid(), 'evaluator')
      OR public.rp_has_role(auth.uid(), 'mentor')
      OR public.rp_is_admin(auth.uid())
    )
  )
  WITH CHECK (
    evaluator_id = auth.uid()
    AND (
      public.rp_has_role(auth.uid(), 'evaluator')
      OR public.rp_has_role(auth.uid(), 'mentor')
      OR public.rp_is_admin(auth.uid())
    )
  );

-- Tighten application_files insert: require a non-expired, non-fulfilled
-- file request to exist for the same application_id. Without this, any
-- anon/authenticated caller could insert arbitrary rows pointing at any
-- application.
DROP POLICY IF EXISTS application_files_public_insert ON public.application_files;
CREATE POLICY application_files_public_insert
  ON public.application_files
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.application_file_requests r
      WHERE r.application_id = application_files.application_id
        AND r.status = 'pending'
        AND (r.expires_at IS NULL OR r.expires_at > now())
    )
  );
