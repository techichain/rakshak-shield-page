CREATE TABLE public.rp_cohort_phase_schedule (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id    uuid NOT NULL REFERENCES public.rp_cohorts(id) ON DELETE CASCADE,
  phase_number int  NOT NULL CHECK (phase_number BETWEEN 0 AND 4),
  starts_on    date,
  deadline     timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, phase_number)
);

GRANT SELECT ON public.rp_cohort_phase_schedule TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.rp_cohort_phase_schedule TO authenticated;
GRANT ALL ON public.rp_cohort_phase_schedule TO service_role;

ALTER TABLE public.rp_cohort_phase_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY rp_cohort_phase_schedule_admin_write
  ON public.rp_cohort_phase_schedule
  FOR ALL
  USING (public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_admin(auth.uid()));

CREATE POLICY rp_cohort_phase_schedule_read_auth
  ON public.rp_cohort_phase_schedule
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER rp_cohort_phase_schedule_updated
  BEFORE UPDATE ON public.rp_cohort_phase_schedule
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.rp_team_phase_progress
  ADD COLUMN deadline_reminder_sent_at timestamptz,
  ADD COLUMN overdue_at                timestamptz;