
-- 1. Sponsorships: remove anon insert; authenticated users may create pending donations bound to their auth.uid()
DROP POLICY IF EXISTS rp_sponsor_public_insert ON public.rp_sponsorships;
CREATE POLICY rp_sponsor_authenticated_insert ON public.rp_sponsorships
  FOR INSERT TO authenticated
  WITH CHECK (status = 'pending');

-- 2. Mentor applications: require authenticated submission
DROP POLICY IF EXISTS rp_mentor_app_public_insert ON public.rp_mentor_applications;
CREATE POLICY rp_mentor_app_authenticated_insert ON public.rp_mentor_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND review_notes IS NULL
    AND created_mentor_id IS NULL
  );

-- 3. Tighten mentor-applications storage uploads: require authenticated + first path segment must be a UUID
DROP POLICY IF EXISTS mentor_apps_anon_upload ON storage.objects;
CREATE POLICY mentor_apps_authenticated_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mentor-applications'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  );

-- 4. Remove the public-read policy on observation photos (bucket will also be flipped to private)
DROP POLICY IF EXISTS observation_photos_public_read ON storage.objects;

-- 5. Lock down internal security-definer helpers from anon callers
REVOKE EXECUTE ON FUNCTION public.rp_shares_team(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rp_is_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rp_is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rp_is_team_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rp_is_team_mentor(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rp_has_role(uuid, rp_app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rp_recompute_team_score(uuid) FROM anon, authenticated;
