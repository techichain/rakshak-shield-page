
-- Helper: is a user an attendee of a meeting? (bypasses RLS internally)
CREATE OR REPLACE FUNCTION public.rp_is_meeting_attendee(_meeting uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rp_meeting_attendees
    WHERE meeting_id = _meeting AND profile_id = _user
  )
$$;

-- Helper: can a user view a meeting (creator / team member / team mentor / admin)?
-- Does NOT touch rp_meeting_attendees, so it's safe to call from that table's policy.
CREATE OR REPLACE FUNCTION public.rp_can_view_meeting(_meeting uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rp_meetings m
    WHERE m.id = _meeting
      AND (
        public.rp_is_admin(_user)
        OR m.created_by = _user
        OR (m.team_id IS NOT NULL AND public.rp_is_team_member(m.team_id, _user))
        OR (m.team_id IS NOT NULL AND public.rp_is_team_mentor(m.team_id, _user))
      )
  )
$$;

-- Rewrite rp_meetings SELECT policy to use the helper instead of an EXISTS into rp_meeting_attendees
DROP POLICY IF EXISTS rp_meet_read ON public.rp_meetings;
CREATE POLICY rp_meet_read ON public.rp_meetings
FOR SELECT
USING (
  rp_is_admin(auth.uid())
  OR created_by = auth.uid()
  OR (team_id IS NOT NULL AND rp_is_team_member(team_id, auth.uid()))
  OR (team_id IS NOT NULL AND rp_is_team_mentor(team_id, auth.uid()))
  OR public.rp_is_meeting_attendee(id, auth.uid())
);

-- Rewrite rp_meeting_attendees SELECT policy to use the helper instead of an EXISTS into rp_meetings
DROP POLICY IF EXISTS rp_attendee_read ON public.rp_meeting_attendees;
CREATE POLICY rp_attendee_read ON public.rp_meeting_attendees
FOR SELECT
USING (
  rp_is_admin(auth.uid())
  OR profile_id = auth.uid()
  OR public.rp_can_view_meeting(meeting_id, auth.uid())
);
