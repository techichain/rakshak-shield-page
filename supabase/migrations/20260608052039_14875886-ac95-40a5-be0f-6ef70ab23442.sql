
-- Path convention: <team_id>/<submission_id>/<filename>
CREATE POLICY rp_storage_submissions_team_rw ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'rp-submissions' AND (
      public.rp_is_admin(auth.uid())
      OR public.rp_is_team_member((string_to_array(name,'/'))[1]::uuid, auth.uid())
      OR public.rp_is_team_mentor((string_to_array(name,'/'))[1]::uuid, auth.uid())
    )
  )
  WITH CHECK (
    bucket_id = 'rp-submissions' AND (
      public.rp_is_admin(auth.uid())
      OR public.rp_is_team_member((string_to_array(name,'/'))[1]::uuid, auth.uid())
    )
  );

-- Lock down EXECUTE on new SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.rp_has_role(uuid, public.rp_app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.rp_is_admin(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.rp_is_team_member(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.rp_is_team_mentor(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rp_has_role(uuid, public.rp_app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rp_is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rp_is_team_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rp_is_team_mentor(uuid, uuid) TO authenticated, service_role;
