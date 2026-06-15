
CREATE TABLE public.rp_mentor_team_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_profile_id uuid NOT NULL REFERENCES public.rp_profiles(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  college text,
  city text,
  state text,
  leader_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_team_id uuid REFERENCES public.rp_teams(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rp_mentor_team_requests_status_idx ON public.rp_mentor_team_requests(status, created_at DESC);
CREATE INDEX rp_mentor_team_requests_mentor_idx ON public.rp_mentor_team_requests(mentor_profile_id);

GRANT SELECT, INSERT, UPDATE ON public.rp_mentor_team_requests TO authenticated;
GRANT ALL ON public.rp_mentor_team_requests TO service_role;

ALTER TABLE public.rp_mentor_team_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_mtr_admin_all" ON public.rp_mentor_team_requests
  FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_admin(auth.uid()));

CREATE POLICY "rp_mtr_mentor_select_own" ON public.rp_mentor_team_requests
  FOR SELECT TO authenticated
  USING (mentor_profile_id = auth.uid());

CREATE POLICY "rp_mtr_mentor_insert_own" ON public.rp_mentor_team_requests
  FOR INSERT TO authenticated
  WITH CHECK (mentor_profile_id = auth.uid() AND public.rp_has_role(auth.uid(), 'mentor'));

CREATE TRIGGER rp_mtr_set_updated_at
  BEFORE UPDATE ON public.rp_mentor_team_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
