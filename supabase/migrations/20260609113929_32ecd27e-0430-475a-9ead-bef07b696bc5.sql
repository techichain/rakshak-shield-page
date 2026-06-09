DROP POLICY IF EXISTS rp_user_roles_self_onboard ON public.rp_user_roles;
CREATE POLICY rp_user_roles_self_onboard
ON public.rp_user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role IN ('team_leader', 'mentor')
);

DROP POLICY IF EXISTS rp_mentors_self_insert ON public.rp_mentors;
CREATE POLICY rp_mentors_self_insert
ON public.rp_mentors
FOR INSERT
TO authenticated
WITH CHECK (profile_id = auth.uid());