CREATE OR REPLACE FUNCTION public.rp_is_assigned_mentor(_mentor uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rp_teams t
    WHERE t.assigned_mentor_id = _mentor
      AND (
        t.team_leader_id = _user
        OR EXISTS (
          SELECT 1 FROM public.rp_team_members tm
          WHERE tm.team_id = t.id AND tm.profile_id = _user
        )
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.rp_is_assigned_mentor(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rp_is_assigned_mentor(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rp_is_assigned_mentor(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS rp_mentors_read ON public.rp_mentors;
CREATE POLICY rp_mentors_read ON public.rp_mentors
FOR SELECT TO authenticated
USING (
  public.rp_is_admin(auth.uid())
  OR public.rp_has_role(auth.uid(), 'evaluator'::rp_app_role)
  OR profile_id = auth.uid()
  OR public.rp_is_assigned_mentor(id, auth.uid())
);

DROP POLICY IF EXISTS rp_slots_read_all_signed_in ON public.rp_mentor_slots;
CREATE POLICY rp_slots_read_all_signed_in ON public.rp_mentor_slots
FOR SELECT TO authenticated
USING (
  public.rp_is_admin(auth.uid())
  OR public.rp_has_role(auth.uid(), 'evaluator'::rp_app_role)
  OR mentor_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.rp_mentors m
    WHERE m.id = rp_mentor_slots.mentor_id AND m.profile_id = auth.uid()
  )
  OR public.rp_is_assigned_mentor(mentor_id, auth.uid())
);