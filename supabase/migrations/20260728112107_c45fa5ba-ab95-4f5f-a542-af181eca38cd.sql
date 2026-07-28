ALTER TABLE public.rp_meetings
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'team';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rp_meetings_audience_check'
  ) THEN
    ALTER TABLE public.rp_meetings
      ADD CONSTRAINT rp_meetings_audience_check
      CHECK (audience IN ('team','all_teams','custom'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.rp_rubric_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_number int NOT NULL CHECK (phase_number BETWEEN 0 AND 4),
  version int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_max_score numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phase_number, version)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_rubric_templates TO authenticated;
GRANT ALL ON public.rp_rubric_templates TO service_role;

ALTER TABLE public.rp_rubric_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rp_rubric_templates_admin_all ON public.rp_rubric_templates;
CREATE POLICY rp_rubric_templates_admin_all ON public.rp_rubric_templates
  FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_admin(auth.uid()));

DROP POLICY IF EXISTS rp_rubric_templates_read ON public.rp_rubric_templates;
CREATE POLICY rp_rubric_templates_read ON public.rp_rubric_templates
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS rp_rubric_templates_updated ON public.rp_rubric_templates;
CREATE TRIGGER rp_rubric_templates_updated
  BEFORE UPDATE ON public.rp_rubric_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();