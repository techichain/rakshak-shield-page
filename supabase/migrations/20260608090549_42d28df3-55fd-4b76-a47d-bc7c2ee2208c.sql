
-- 1. Restrict rp_profiles SELECT to self / shared team / assigned mentor / admin
DROP POLICY IF EXISTS rp_profiles_authenticated_read ON public.rp_profiles;

CREATE OR REPLACE FUNCTION public.rp_shares_team(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- both on same team as members
    SELECT 1
    FROM public.rp_team_members ma
    JOIN public.rp_team_members mb ON ma.team_id = mb.team_id
    WHERE ma.profile_id = _a AND mb.profile_id = _b
  ) OR EXISTS (
    -- _a is leader of a team _b is on (or vice versa)
    SELECT 1 FROM public.rp_teams t
    LEFT JOIN public.rp_team_members m ON m.team_id = t.id
    WHERE (t.team_leader_id = _a AND (m.profile_id = _b OR t.team_leader_id = _b))
       OR (t.team_leader_id = _b AND (m.profile_id = _a OR t.team_leader_id = _a))
  ) OR EXISTS (
    -- mentor <-> team (member or leader)
    SELECT 1
    FROM public.rp_teams t
    JOIN public.rp_mentors me ON me.id = t.assigned_mentor_id
    LEFT JOIN public.rp_team_members m ON m.team_id = t.id
    WHERE (me.profile_id = _a AND (m.profile_id = _b OR t.team_leader_id = _b))
       OR (me.profile_id = _b AND (m.profile_id = _a OR t.team_leader_id = _a))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.rp_shares_team(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rp_shares_team(uuid, uuid) TO authenticated, service_role;

CREATE POLICY rp_profiles_scoped_read ON public.rp_profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR rp_is_admin(auth.uid())
    OR public.rp_shares_team(auth.uid(), id)
  );

-- 2. Fix broken self-join in rp_meet_read
DROP POLICY IF EXISTS rp_meet_read ON public.rp_meetings;
CREATE POLICY rp_meet_read ON public.rp_meetings
  FOR SELECT
  TO authenticated
  USING (
    rp_is_admin(auth.uid())
    OR created_by = auth.uid()
    OR (team_id IS NOT NULL AND rp_is_team_member(team_id, auth.uid()))
    OR (team_id IS NOT NULL AND rp_is_team_mentor(team_id, auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.rp_meeting_attendees a
      WHERE a.meeting_id = public.rp_meetings.id AND a.profile_id = auth.uid()
    )
  );
