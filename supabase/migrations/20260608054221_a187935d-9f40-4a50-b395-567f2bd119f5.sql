
CREATE TABLE public.rp_rubrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_number integer NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  criteria jsonb NOT NULL,
  max_total_score numeric(6,2) NOT NULL DEFAULT 100,
  phase_weight numeric(5,2) NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rp_rubrics TO authenticated, anon;
GRANT ALL ON public.rp_rubrics TO service_role;
ALTER TABLE public.rp_rubrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rp_rubrics_read_all" ON public.rp_rubrics FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "rp_rubrics_admin_write" ON public.rp_rubrics FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid())) WITH CHECK (public.rp_is_admin(auth.uid()));
CREATE TRIGGER rp_rubrics_updated BEFORE UPDATE ON public.rp_rubrics
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.rp_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.rp_submissions(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  phase_number integer NOT NULL,
  evaluator_id uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  rubric_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_score numeric(6,2) NOT NULL DEFAULT 0,
  weighted_score numeric(6,2) NOT NULL DEFAULT 0,
  comments text,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, evaluator_id)
);
CREATE INDEX rp_eval_team_idx ON public.rp_evaluations(team_id);
CREATE INDEX rp_eval_phase_idx ON public.rp_evaluations(phase_number);
CREATE INDEX rp_eval_evaluator_idx ON public.rp_evaluations(evaluator_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_evaluations TO authenticated;
GRANT ALL ON public.rp_evaluations TO service_role;
ALTER TABLE public.rp_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rp_eval_admin_all" ON public.rp_evaluations FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid())) WITH CHECK (public.rp_is_admin(auth.uid()));
CREATE POLICY "rp_eval_own_rw" ON public.rp_evaluations FOR ALL TO authenticated
  USING (evaluator_id = auth.uid()) WITH CHECK (evaluator_id = auth.uid());
CREATE POLICY "rp_eval_team_read" ON public.rp_evaluations FOR SELECT TO authenticated
  USING (
    status = 'submitted' AND (
      public.rp_is_team_member(team_id, auth.uid())
      OR public.rp_is_team_mentor(team_id, auth.uid())
    )
  );
CREATE TRIGGER rp_eval_updated BEFORE UPDATE ON public.rp_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.rp_teams ADD COLUMN IF NOT EXISTS final_score numeric(6,2) NOT NULL DEFAULT 0;
ALTER TABLE public.rp_teams ADD COLUMN IF NOT EXISTS evaluated_phases integer NOT NULL DEFAULT 0;

CREATE OR REPLACE VIEW public.rp_leaderboard_view AS
SELECT
  t.id AS team_id,
  t.team_name,
  t.city,
  t.state,
  t.college,
  t.cohort_id,
  c.name AS cohort_name,
  t.current_phase,
  t.final_score,
  t.evaluated_phases,
  RANK() OVER (PARTITION BY t.cohort_id ORDER BY t.final_score DESC) AS cohort_rank,
  RANK() OVER (ORDER BY t.final_score DESC) AS overall_rank
FROM public.rp_teams t
LEFT JOIN public.rp_cohorts c ON c.id = t.cohort_id
WHERE t.status NOT IN ('dropped','disqualified','archived');
GRANT SELECT ON public.rp_leaderboard_view TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.rp_recompute_team_score(_team_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score numeric(6,2);
  v_phases integer;
BEGIN
  SELECT COALESCE(SUM(per_phase.avg_weighted), 0), COUNT(*)
  INTO v_score, v_phases
  FROM (
    SELECT phase_number, AVG(weighted_score) AS avg_weighted
    FROM public.rp_evaluations
    WHERE team_id = _team_id AND status = 'submitted'
    GROUP BY phase_number
  ) per_phase;
  UPDATE public.rp_teams
    SET final_score = COALESCE(v_score,0), evaluated_phases = COALESCE(v_phases,0), updated_at = now()
    WHERE id = _team_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rp_tg_eval_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.rp_recompute_team_score(OLD.team_id);
    RETURN OLD;
  ELSE
    PERFORM public.rp_recompute_team_score(NEW.team_id);
    RETURN NEW;
  END IF;
END;
$$;
CREATE TRIGGER rp_eval_recompute_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.rp_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.rp_tg_eval_recompute();

INSERT INTO public.rp_rubrics (phase_number, title, description, criteria, max_total_score, phase_weight) VALUES
(0, 'Onboarding & Team Readiness', 'Baseline team setup, member profiles, training completion.',
 '[{"key":"profile","label":"Profile completeness","max_score":25,"description":"All members onboarded with profile data"},
   {"key":"training","label":"Training modules completed","max_score":25,"description":"Required orientation modules"},
   {"key":"plan","label":"Field plan submitted","max_score":25,"description":"Initial action plan quality"},
   {"key":"communication","label":"Communication setup","max_score":25,"description":"Mentor channel and reporting cadence"}]'::jsonb, 100, 10),
(1, 'Site Discovery & Mapping', 'Locating unsafe spots, mapping with photo evidence.',
 '[{"key":"coverage","label":"Geographic coverage","max_score":25,"description":"Spread and density of mapped sites"},
   {"key":"evidence","label":"Evidence quality","max_score":25,"description":"Geotagged photos, clarity, captions"},
   {"key":"classification","label":"Issue classification","max_score":25,"description":"Accurate categorisation and severity"},
   {"key":"reporting","label":"Reporting discipline","max_score":25,"description":"Timeliness and completeness"}]'::jsonb, 100, 20),
(2, 'Final Site Selection & Diagnosis', 'Selecting highest-impact sites and root-cause analysis.',
 '[{"key":"selection","label":"Site selection rationale","max_score":25,"description":"Evidence-driven prioritisation"},
   {"key":"diagnosis","label":"Root cause diagnosis","max_score":25,"description":"Depth of analysis"},
   {"key":"stakeholders","label":"Stakeholder mapping","max_score":25,"description":"Authorities, residents, users"},
   {"key":"baseline","label":"Baseline metrics","max_score":25,"description":"Pre-intervention data"}]'::jsonb, 100, 20),
(3, 'Intervention Design & Authority Engagement', 'Designing solutions and engaging local authority.',
 '[{"key":"design","label":"Intervention design","max_score":30,"description":"Feasibility, safety, innovation"},
   {"key":"authority","label":"Authority engagement","max_score":30,"description":"Outreach, follow-ups, responses"},
   {"key":"community","label":"Community engagement","max_score":20,"description":"Awareness, buy-in"},
   {"key":"timeline","label":"Execution plan","max_score":20,"description":"Realistic schedule and milestones"}]'::jsonb, 100, 25),
(4, 'Impact, Sustainability & Final Report', 'Measured impact and sustainability of intervention.',
 '[{"key":"impact","label":"Measured impact","max_score":35,"description":"Before/after metrics, behavior change"},
   {"key":"sustainability","label":"Sustainability plan","max_score":25,"description":"Long-term ownership and maintenance"},
   {"key":"documentation","label":"Final report quality","max_score":25,"description":"Clarity, evidence, narrative"},
   {"key":"learnings","label":"Reflection and learnings","max_score":15,"description":"Honest critique and next steps"}]'::jsonb, 100, 25)
ON CONFLICT (phase_number) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, criteria = EXCLUDED.criteria,
  max_total_score = EXCLUDED.max_total_score, phase_weight = EXCLUDED.phase_weight;
