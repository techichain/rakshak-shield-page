
CREATE TABLE public.rp_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  mentor_id uuid REFERENCES public.rp_mentors(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  agenda text NOT NULL DEFAULT '',
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  meeting_link text,
  location text,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','confirmed','cancelled','completed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_meetings TO authenticated;
GRANT ALL ON public.rp_meetings TO service_role;
ALTER TABLE public.rp_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_meet_team_or_mentor_read" ON public.rp_meetings
  FOR SELECT TO authenticated
  USING (
    public.rp_is_admin(auth.uid())
    OR public.rp_is_team_member(team_id, auth.uid())
    OR public.rp_is_team_mentor(team_id, auth.uid())
  );

CREATE POLICY "rp_meet_team_or_mentor_insert" ON public.rp_meetings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.rp_is_admin(auth.uid())
    OR public.rp_is_team_member(team_id, auth.uid())
    OR public.rp_is_team_mentor(team_id, auth.uid())
  );

CREATE POLICY "rp_meet_creator_or_admin_update" ON public.rp_meetings
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.rp_is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.rp_is_admin(auth.uid()));

CREATE POLICY "rp_meet_creator_or_admin_delete" ON public.rp_meetings
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.rp_is_admin(auth.uid()));

CREATE TRIGGER rp_meetings_set_updated_at
  BEFORE UPDATE ON public.rp_meetings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX rp_meet_team_idx ON public.rp_meetings(team_id);
CREATE INDEX rp_meet_start_idx ON public.rp_meetings(scheduled_start);

-- =========================
CREATE TABLE public.rp_meeting_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.rp_meetings(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.rp_profiles(id) ON DELETE CASCADE,
  rsvp text NOT NULL DEFAULT 'pending' CHECK (rsvp IN ('pending','going','not_going','maybe')),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_meeting_attendees TO authenticated;
GRANT ALL ON public.rp_meeting_attendees TO service_role;
ALTER TABLE public.rp_meeting_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_attendee_read" ON public.rp_meeting_attendees
  FOR SELECT TO authenticated
  USING (
    public.rp_is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.rp_meetings m
      WHERE m.id = meeting_id
        AND (
          public.rp_is_team_member(m.team_id, auth.uid())
          OR public.rp_is_team_mentor(m.team_id, auth.uid())
        )
    )
  );

CREATE POLICY "rp_attendee_self_insert" ON public.rp_meeting_attendees
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() OR public.rp_is_admin(auth.uid()));

CREATE POLICY "rp_attendee_self_update" ON public.rp_meeting_attendees
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() OR public.rp_is_admin(auth.uid()))
  WITH CHECK (profile_id = auth.uid() OR public.rp_is_admin(auth.uid()));

CREATE POLICY "rp_attendee_self_delete" ON public.rp_meeting_attendees
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid() OR public.rp_is_admin(auth.uid()));

CREATE TRIGGER rp_meeting_attendees_set_updated_at
  BEFORE UPDATE ON public.rp_meeting_attendees
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX rp_attendee_meeting_idx ON public.rp_meeting_attendees(meeting_id);
CREATE INDEX rp_attendee_profile_idx ON public.rp_meeting_attendees(profile_id);
