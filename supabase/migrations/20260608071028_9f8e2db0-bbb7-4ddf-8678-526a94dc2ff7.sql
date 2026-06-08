
-- Extensions for scheduled reminders
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Make team optional for mentor<->evaluator meetings
ALTER TABLE public.rp_meetings ALTER COLUMN team_id DROP NOT NULL;

-- Meeting type / audience
ALTER TABLE public.rp_meetings
  ADD COLUMN IF NOT EXISTS meeting_type text NOT NULL DEFAULT 'team_mentor';

ALTER TABLE public.rp_meetings
  DROP CONSTRAINT IF EXISTS rp_meetings_type_check;
ALTER TABLE public.rp_meetings
  ADD CONSTRAINT rp_meetings_type_check
  CHECK (meeting_type IN ('team_mentor','mentor_evaluator','evaluator_team','team_internal','other'));

-- Reminder bookkeeping
ALTER TABLE public.rp_meetings
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_30m_sent_at timestamptz;

-- Allow admins and team mentors to insert meetings without a team (mentor<->evaluator)
DROP POLICY IF EXISTS "rp_meet_team_or_mentor_insert" ON public.rp_meetings;
CREATE POLICY "rp_meet_insert_v2" ON public.rp_meetings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.rp_is_admin(auth.uid())
    OR (team_id IS NOT NULL AND public.rp_is_team_member(team_id, auth.uid()))
    OR (team_id IS NOT NULL AND public.rp_is_team_mentor(team_id, auth.uid()))
    OR (team_id IS NULL AND (
          public.rp_has_role(auth.uid(), 'mentor')
          OR public.rp_has_role(auth.uid(), 'evaluator')
        ))
  );

-- Allow attendees / admins / creator to read meetings even when team_id is null
DROP POLICY IF EXISTS "rp_meet_read" ON public.rp_meetings;
CREATE POLICY "rp_meet_read" ON public.rp_meetings
  FOR SELECT TO authenticated
  USING (
    public.rp_is_admin(auth.uid())
    OR created_by = auth.uid()
    OR (team_id IS NOT NULL AND public.rp_is_team_member(team_id, auth.uid()))
    OR (team_id IS NOT NULL AND public.rp_is_team_mentor(team_id, auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.rp_meeting_attendees a
      WHERE a.meeting_id = id AND a.profile_id = auth.uid()
    )
  );
