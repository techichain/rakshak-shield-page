CREATE TABLE public.rp_phase_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid REFERENCES public.rp_cohorts(id) ON DELETE CASCADE,
  phase_number int NOT NULL CHECK (phase_number BETWEEN 0 AND 4),
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  rank int NOT NULL,
  score numeric,
  computed_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  UNIQUE (phase_number, team_id)
);

CREATE INDEX rp_phase_ranks_phase_idx ON public.rp_phase_ranks (phase_number, rank);

GRANT SELECT ON public.rp_phase_ranks TO authenticated;
GRANT ALL ON public.rp_phase_ranks TO service_role;

ALTER TABLE public.rp_phase_ranks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_phase_ranks_admin_manage" ON public.rp_phase_ranks
  FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_admin(auth.uid()));

CREATE POLICY "rp_phase_ranks_read" ON public.rp_phase_ranks
  FOR SELECT TO authenticated
  USING (true);

ALTER TABLE public.rp_notifications ADD COLUMN email_sent_at timestamptz;