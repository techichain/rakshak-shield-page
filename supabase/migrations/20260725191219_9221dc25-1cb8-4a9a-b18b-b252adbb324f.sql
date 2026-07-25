CREATE TABLE public.rp_evidence_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  phase_number int,
  record_type text NOT NULL CHECK (record_type IN ('crash_data','rti','fir','police_complaint','media_report','other')),
  title text NOT NULL,
  reference_no text,
  filed_on date,
  authority text,
  status text CHECK (status IN ('draft','filed','acknowledged','responded','closed')),
  description text,
  created_by uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rp_evidence_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.rp_evidence_records(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  file_size bigint,
  uploaded_by uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rp_evidence_records_team_idx ON public.rp_evidence_records (team_id, record_type, created_at DESC);
CREATE INDEX rp_evidence_files_record_idx ON public.rp_evidence_files (record_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_evidence_records TO authenticated;
GRANT ALL ON public.rp_evidence_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_evidence_files TO authenticated;
GRANT ALL ON public.rp_evidence_files TO service_role;

ALTER TABLE public.rp_evidence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rp_evidence_files ENABLE ROW LEVEL SECURITY;

-- Mirrors public.rp_submission_files / rp_locations policy shape.
CREATE POLICY rp_evr_admin_all ON public.rp_evidence_records
  FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_admin(auth.uid()));

CREATE POLICY rp_evr_member_rw ON public.rp_evidence_records
  FOR ALL TO authenticated
  USING (public.rp_is_team_member(team_id, auth.uid()) OR public.rp_is_team_mentor(team_id, auth.uid()))
  WITH CHECK (public.rp_is_team_member(team_id, auth.uid()));

CREATE POLICY rp_evr_evaluator_select ON public.rp_evidence_records
  FOR SELECT TO authenticated
  USING (public.rp_has_role(auth.uid(), 'evaluator'::rp_app_role));

CREATE POLICY rp_evf_admin_all ON public.rp_evidence_files
  FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_admin(auth.uid()));

CREATE POLICY rp_evf_member_rw ON public.rp_evidence_files
  FOR ALL TO authenticated
  USING (public.rp_is_team_member(team_id, auth.uid()) OR public.rp_is_team_mentor(team_id, auth.uid()))
  WITH CHECK (public.rp_is_team_member(team_id, auth.uid()));

CREATE POLICY rp_evf_evaluator_select ON public.rp_evidence_files
  FOR SELECT TO authenticated
  USING (public.rp_has_role(auth.uid(), 'evaluator'::rp_app_role));

CREATE TRIGGER rp_evidence_records_set_updated_at
  BEFORE UPDATE ON public.rp_evidence_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();