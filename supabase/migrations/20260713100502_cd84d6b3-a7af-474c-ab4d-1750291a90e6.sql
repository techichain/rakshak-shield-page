-- rp_doubts: team-scoped Q&A between team members and their mentor/admins
CREATE TABLE public.rp_doubts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  phase_number int,
  posted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  posted_by_role text NOT NULL CHECK (posted_by_role IN ('team_leader','team_member')),
  question text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved')),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_text text,
  resolved_at timestamptz,
  last_reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rp_doubts_team_idx ON public.rp_doubts (team_id, created_at DESC);
CREATE INDEX rp_doubts_status_idx ON public.rp_doubts (status, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_doubts TO authenticated;
GRANT ALL ON public.rp_doubts TO service_role;

ALTER TABLE public.rp_doubts ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "rp_doubts admin all" ON public.rp_doubts
  FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_admin(auth.uid()));

-- Team members/leader + assigned mentor of the team can SELECT
CREATE POLICY "rp_doubts select team+mentor" ON public.rp_doubts
  FOR SELECT TO authenticated
  USING (
    public.rp_is_team_member(team_id, auth.uid())
    OR public.rp_is_team_mentor(team_id, auth.uid())
  );

-- Team leader/members can INSERT for their own team
CREATE POLICY "rp_doubts insert own team" ON public.rp_doubts
  FOR INSERT TO authenticated
  WITH CHECK (
    posted_by = auth.uid()
    AND public.rp_is_team_member(team_id, auth.uid())
  );

-- Assigned mentor can UPDATE (admins already covered by admin-all policy)
CREATE POLICY "rp_doubts update mentor" ON public.rp_doubts
  FOR UPDATE TO authenticated
  USING (public.rp_is_team_mentor(team_id, auth.uid()))
  WITH CHECK (public.rp_is_team_mentor(team_id, auth.uid()));

CREATE TRIGGER rp_doubts_set_updated_at
  BEFORE UPDATE ON public.rp_doubts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
