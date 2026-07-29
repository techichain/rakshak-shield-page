REVOKE EXECUTE ON FUNCTION public.rp_is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rp_has_role(uuid, rp_app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rp_is_team_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rp_is_team_leader(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rp_is_team_mentor(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rp_is_team_evaluator(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rp_shares_team(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rp_can_view_meeting(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rp_is_mail_participant(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rp_public_team_locations(uuid) FROM anon;

DROP POLICY IF EXISTS rp_storage_submissions_team_rw ON storage.objects;

CREATE POLICY rp_storage_submissions_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'rp-submissions'
  AND (
    public.rp_is_admin(auth.uid())
    OR public.rp_is_team_member(((string_to_array(name, '/'))[1])::uuid, auth.uid())
    OR public.rp_is_team_mentor(((string_to_array(name, '/'))[1])::uuid, auth.uid())
  )
);

CREATE POLICY rp_storage_submissions_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'rp-submissions'
  AND (
    public.rp_is_admin(auth.uid())
    OR public.rp_is_team_member(((string_to_array(name, '/'))[1])::uuid, auth.uid())
  )
);

CREATE POLICY rp_storage_submissions_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'rp-submissions'
  AND (
    public.rp_is_admin(auth.uid())
    OR public.rp_is_team_member(((string_to_array(name, '/'))[1])::uuid, auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'rp-submissions'
  AND (
    public.rp_is_admin(auth.uid())
    OR public.rp_is_team_member(((string_to_array(name, '/'))[1])::uuid, auth.uid())
  )
);

CREATE POLICY rp_storage_submissions_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'rp-submissions'
  AND (
    public.rp_is_admin(auth.uid())
    OR public.rp_is_team_member(((string_to_array(name, '/'))[1])::uuid, auth.uid())
  )
);