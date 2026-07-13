
-- Admin questionnaires: admin posts a set of questions scoped to a team+phase
CREATE TABLE public.rp_admin_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  phase_number integer,
  title text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_admin_questionnaires TO authenticated;
GRANT ALL ON public.rp_admin_questionnaires TO service_role;
ALTER TABLE public.rp_admin_questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_questionnaires admin all"
  ON public.rp_admin_questionnaires
  FOR ALL
  TO authenticated
  USING (public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_admin(auth.uid()));

CREATE POLICY "rp_questionnaires team read"
  ON public.rp_admin_questionnaires
  FOR SELECT
  TO authenticated
  USING (
    public.rp_is_admin(auth.uid())
    OR public.rp_is_team_member(team_id, auth.uid())
    OR public.rp_is_team_mentor(team_id, auth.uid())
  );

CREATE INDEX idx_rp_admin_questionnaires_team ON public.rp_admin_questionnaires(team_id, phase_number);

CREATE TRIGGER trg_rp_admin_questionnaires_updated_at
  BEFORE UPDATE ON public.rp_admin_questionnaires
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Responses from team members / leader
CREATE TABLE public.rp_questionnaire_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES public.rp_admin_questionnaires(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  respondent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (questionnaire_id, respondent_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_questionnaire_responses TO authenticated;
GRANT ALL ON public.rp_questionnaire_responses TO service_role;
ALTER TABLE public.rp_questionnaire_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_qresponses read"
  ON public.rp_questionnaire_responses
  FOR SELECT
  TO authenticated
  USING (
    public.rp_is_admin(auth.uid())
    OR respondent_id = auth.uid()
    OR public.rp_is_team_leader(team_id, auth.uid())
    OR public.rp_is_team_member(team_id, auth.uid())
  );

CREATE POLICY "rp_qresponses insert own"
  ON public.rp_questionnaire_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    respondent_id = auth.uid()
    AND public.rp_is_team_member(team_id, auth.uid())
  );

CREATE POLICY "rp_qresponses update own"
  ON public.rp_questionnaire_responses
  FOR UPDATE
  TO authenticated
  USING (respondent_id = auth.uid())
  WITH CHECK (respondent_id = auth.uid());

CREATE INDEX idx_rp_qresponses_q ON public.rp_questionnaire_responses(questionnaire_id);
CREATE INDEX idx_rp_qresponses_team ON public.rp_questionnaire_responses(team_id);

CREATE TRIGGER trg_rp_qresponses_updated_at
  BEFORE UPDATE ON public.rp_questionnaire_responses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
