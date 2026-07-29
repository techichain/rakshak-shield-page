-- 1) Restrict public-role policies to authenticated
DROP POLICY IF EXISTS rp_meet_insert_v3 ON public.rp_meetings;
CREATE POLICY rp_meet_insert_v3 ON public.rp_meetings
FOR INSERT TO authenticated
WITH CHECK (
  rp_is_admin(auth.uid())
  OR ((team_id IS NOT NULL) AND (rp_is_team_leader(team_id, auth.uid()) OR rp_is_team_mentor(team_id, auth.uid())))
  OR ((team_id IS NULL) AND (rp_has_role(auth.uid(), 'mentor'::rp_app_role) OR rp_has_role(auth.uid(), 'evaluator'::rp_app_role)))
);

DROP POLICY IF EXISTS rp_meet_read ON public.rp_meetings;
CREATE POLICY rp_meet_read ON public.rp_meetings
FOR SELECT TO authenticated
USING (
  rp_is_admin(auth.uid())
  OR (created_by = auth.uid())
  OR ((team_id IS NOT NULL) AND rp_is_team_member(team_id, auth.uid()))
  OR ((team_id IS NOT NULL) AND rp_is_team_mentor(team_id, auth.uid()))
  OR rp_is_meeting_attendee(id, auth.uid())
);

DROP POLICY IF EXISTS rp_attendee_read ON public.rp_meeting_attendees;
CREATE POLICY rp_attendee_read ON public.rp_meeting_attendees
FOR SELECT TO authenticated
USING (
  rp_is_admin(auth.uid())
  OR (profile_id = auth.uid())
  OR rp_can_view_meeting(meeting_id, auth.uid())
);

DROP POLICY IF EXISTS rp_sub_member_read ON public.rp_submissions;
CREATE POLICY rp_sub_member_read ON public.rp_submissions
FOR SELECT TO authenticated
USING (
  rp_is_admin(auth.uid())
  OR rp_is_team_member(team_id, auth.uid())
  OR rp_is_team_mentor(team_id, auth.uid())
);

DROP POLICY IF EXISTS rp_sub_leader_write ON public.rp_submissions;
CREATE POLICY rp_sub_leader_write ON public.rp_submissions
FOR INSERT TO authenticated
WITH CHECK (
  rp_is_admin(auth.uid())
  OR rp_is_team_leader(team_id, auth.uid())
  OR rp_is_team_mentor(team_id, auth.uid())
);

DROP POLICY IF EXISTS rp_sub_leader_update ON public.rp_submissions;
CREATE POLICY rp_sub_leader_update ON public.rp_submissions
FOR UPDATE TO authenticated
USING (
  rp_is_admin(auth.uid())
  OR rp_is_team_leader(team_id, auth.uid())
  OR rp_is_team_mentor(team_id, auth.uid())
)
WITH CHECK (
  rp_is_admin(auth.uid())
  OR rp_is_team_leader(team_id, auth.uid())
  OR rp_is_team_mentor(team_id, auth.uid())
);

DROP POLICY IF EXISTS rp_sub_leader_delete ON public.rp_submissions;
CREATE POLICY rp_sub_leader_delete ON public.rp_submissions
FOR DELETE TO authenticated
USING (
  rp_is_admin(auth.uid())
  OR rp_is_team_leader(team_id, auth.uid())
  OR rp_is_team_mentor(team_id, auth.uid())
);

-- 2) Scope evaluator cross-team reads to assigned teams
CREATE OR REPLACE FUNCTION public.rp_is_team_evaluator(_team uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.rp_has_role(_user, 'evaluator'::rp_app_role)
     AND EXISTS (
       SELECT 1 FROM public.rp_evaluations e
       WHERE e.team_id = _team AND e.evaluator_id = _user
     )
$$;

DROP POLICY IF EXISTS rp_evf_evaluator_select ON public.rp_evidence_files;
CREATE POLICY rp_evf_evaluator_select ON public.rp_evidence_files
FOR SELECT TO authenticated
USING (public.rp_is_team_evaluator(team_id, auth.uid()));

DROP POLICY IF EXISTS rp_evr_evaluator_select ON public.rp_evidence_records;
CREATE POLICY rp_evr_evaluator_select ON public.rp_evidence_records
FOR SELECT TO authenticated
USING (public.rp_is_team_evaluator(team_id, auth.uid()));

DROP POLICY IF EXISTS rp_tu_evaluator_select ON public.rp_team_updates;
CREATE POLICY rp_tu_evaluator_select ON public.rp_team_updates
FOR SELECT TO authenticated
USING (public.rp_is_team_evaluator(team_id, auth.uid()));