ALTER TABLE public.rp_doubts
  ADD COLUMN IF NOT EXISTS escalated_at    timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_to    uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sla_due_at      timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_count int NOT NULL DEFAULT 0;

CREATE TABLE public.rp_team_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  update_type text NOT NULL CHECK (update_type IN ('exam_schedule','availability','note','other')),
  title text NOT NULL,
  details text,
  start_date date,
  end_date date,
  file_path text,
  created_by uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rp_team_updates_team_idx ON public.rp_team_updates (team_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_team_updates TO authenticated;
GRANT ALL ON public.rp_team_updates TO service_role;

ALTER TABLE public.rp_team_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY rp_tu_admin_all ON public.rp_team_updates
  FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_admin(auth.uid()));

CREATE POLICY rp_tu_member_rw ON public.rp_team_updates
  FOR ALL TO authenticated
  USING (public.rp_is_team_member(team_id, auth.uid()) OR public.rp_is_team_mentor(team_id, auth.uid()))
  WITH CHECK (public.rp_is_team_member(team_id, auth.uid()));

CREATE POLICY rp_tu_evaluator_select ON public.rp_team_updates
  FOR SELECT TO authenticated
  USING (public.rp_has_role(auth.uid(), 'evaluator'::rp_app_role));