
-- ============ ENUMS ============
CREATE TYPE public.rp_app_role AS ENUM (
  'super_admin','cfi_admin','team_leader','team_member','mentor','evaluator','authority','finance','leadership_viewer'
);
CREATE TYPE public.rp_team_status AS ENUM (
  'pending_approval','approved','active','delayed','at_risk','completed','dropped','disqualified','archived'
);
CREATE TYPE public.rp_risk_status AS ENUM ('on_track','attention','at_risk');
CREATE TYPE public.rp_phase_status AS ENUM (
  'not_started','draft','submitted','under_mentor_review','changes_requested','resubmitted',
  'mentor_approved','under_admin_review','admin_approved','rejected','completed'
);
CREATE TYPE public.rp_cohort_status AS ENUM ('draft','active','completed','archived');
CREATE TYPE public.rp_severity AS ENUM ('low','medium','high','critical');

-- ============ ROLES TABLE ============
CREATE TABLE public.rp_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.rp_app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.rp_user_roles TO authenticated;
GRANT ALL ON public.rp_user_roles TO service_role;
ALTER TABLE public.rp_user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rp_has_role(_user_id uuid, _role public.rp_app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rp_user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.rp_is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rp_user_roles
    WHERE user_id = _user_id AND role IN ('cfi_admin','super_admin')
  )
$$;

CREATE POLICY rp_user_roles_self_select ON public.rp_user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.rp_is_admin(auth.uid()));
CREATE POLICY rp_user_roles_admin_all ON public.rp_user_roles
  FOR ALL TO authenticated USING (public.rp_is_admin(auth.uid())) WITH CHECK (public.rp_is_admin(auth.uid()));

-- ============ PROFILES ============
CREATE TABLE public.rp_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  city text,
  state text,
  organization text,
  avatar_url text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.rp_profiles TO authenticated;
GRANT ALL ON public.rp_profiles TO service_role;
ALTER TABLE public.rp_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_profiles_self_rw ON public.rp_profiles
  FOR ALL TO authenticated USING (id = auth.uid() OR public.rp_is_admin(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.rp_is_admin(auth.uid()));
CREATE POLICY rp_profiles_authenticated_read ON public.rp_profiles
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER rp_profiles_updated BEFORE UPDATE ON public.rp_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ COHORTS ============
CREATE TABLE public.rp_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  year int NOT NULL,
  region text,
  description text,
  start_date date,
  end_date date,
  status public.rp_cohort_status NOT NULL DEFAULT 'draft',
  participating_states text[] DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rp_cohorts TO authenticated;
GRANT ALL ON public.rp_cohorts TO service_role;
ALTER TABLE public.rp_cohorts ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_cohorts_read_all ON public.rp_cohorts FOR SELECT TO authenticated USING (true);
CREATE POLICY rp_cohorts_admin_write ON public.rp_cohorts FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid())) WITH CHECK (public.rp_is_admin(auth.uid()));
CREATE TRIGGER rp_cohorts_updated BEFORE UPDATE ON public.rp_cohorts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ MENTORS ============
CREATE TABLE public.rp_mentors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.rp_profiles(id) ON DELETE CASCADE,
  expertise text,
  organization text,
  max_teams int NOT NULL DEFAULT 5,
  current_team_count int NOT NULL DEFAULT 0,
  rating numeric(3,2),
  avg_response_time_hours numeric(6,2),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rp_mentors TO authenticated;
GRANT ALL ON public.rp_mentors TO service_role;
ALTER TABLE public.rp_mentors ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_mentors_read ON public.rp_mentors FOR SELECT TO authenticated USING (true);
CREATE POLICY rp_mentors_admin_write ON public.rp_mentors FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid())) WITH CHECK (public.rp_is_admin(auth.uid()));
CREATE POLICY rp_mentors_self_update ON public.rp_mentors FOR UPDATE TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE TRIGGER rp_mentors_updated BEFORE UPDATE ON public.rp_mentors
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ TEAMS ============
CREATE TABLE public.rp_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.rp_cohorts(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  college text,
  city text,
  state text,
  team_leader_id uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  current_phase int NOT NULL DEFAULT 0,
  assigned_mentor_id uuid REFERENCES public.rp_mentors(id) ON DELETE SET NULL,
  assigned_evaluator_id uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  status public.rp_team_status NOT NULL DEFAULT 'pending_approval',
  risk_status public.rp_risk_status NOT NULL DEFAULT 'on_track',
  risk_reason text,
  completion_percentage int NOT NULL DEFAULT 0,
  health_score int NOT NULL DEFAULT 100,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rp_teams_cohort_idx ON public.rp_teams(cohort_id);
CREATE INDEX rp_teams_mentor_idx ON public.rp_teams(assigned_mentor_id);
CREATE INDEX rp_teams_state_idx ON public.rp_teams(state);
GRANT SELECT ON public.rp_teams TO authenticated;
GRANT ALL ON public.rp_teams TO service_role;
ALTER TABLE public.rp_teams ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER rp_teams_updated BEFORE UPDATE ON public.rp_teams
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ TEAM MEMBERS ============
CREATE TABLE public.rp_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  college text,
  department text,
  year text,
  role_in_team text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rp_team_members_team_idx ON public.rp_team_members(team_id);
CREATE INDEX rp_team_members_profile_idx ON public.rp_team_members(profile_id);
GRANT SELECT, INSERT ON public.rp_team_members TO authenticated;
GRANT ALL ON public.rp_team_members TO service_role;
ALTER TABLE public.rp_team_members ENABLE ROW LEVEL SECURITY;

-- Helper functions for membership / mentorship
CREATE OR REPLACE FUNCTION public.rp_is_team_member(_team uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rp_team_members WHERE team_id = _team AND profile_id = _user
  ) OR EXISTS (
    SELECT 1 FROM public.rp_teams WHERE id = _team AND team_leader_id = _user
  )
$$;
CREATE OR REPLACE FUNCTION public.rp_is_team_mentor(_team uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rp_teams t
    JOIN public.rp_mentors m ON m.id = t.assigned_mentor_id
    WHERE t.id = _team AND m.profile_id = _user
  )
$$;

-- TEAMS policies (using helpers)
CREATE POLICY rp_teams_admin_all ON public.rp_teams FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid())) WITH CHECK (public.rp_is_admin(auth.uid()));
CREATE POLICY rp_teams_member_read ON public.rp_teams FOR SELECT TO authenticated
  USING (public.rp_is_team_member(id, auth.uid()) OR public.rp_is_team_mentor(id, auth.uid()));

-- TEAM MEMBERS policies
CREATE POLICY rp_team_members_admin_all ON public.rp_team_members FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid())) WITH CHECK (public.rp_is_admin(auth.uid()));
CREATE POLICY rp_team_members_team_read ON public.rp_team_members FOR SELECT TO authenticated
  USING (public.rp_is_team_member(team_id, auth.uid()) OR public.rp_is_team_mentor(team_id, auth.uid()));

-- ============ PHASE TEMPLATES ============
CREATE TABLE public.rp_phase_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_number int NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  default_duration_days int NOT NULL DEFAULT 21,
  required_deliverables jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rp_phase_templates TO authenticated;
GRANT ALL ON public.rp_phase_templates TO service_role;
ALTER TABLE public.rp_phase_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_phase_templates_read ON public.rp_phase_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY rp_phase_templates_admin_write ON public.rp_phase_templates FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid())) WITH CHECK (public.rp_is_admin(auth.uid()));

-- ============ TEAM PHASE PROGRESS ============
CREATE TABLE public.rp_team_phase_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  phase_number int NOT NULL,
  status public.rp_phase_status NOT NULL DEFAULT 'not_started',
  completion_percentage int NOT NULL DEFAULT 0,
  deadline timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  mentor_reviewed_at timestamptz,
  admin_reviewed_at timestamptz,
  completed_at timestamptz,
  mentor_status text,
  admin_status text,
  revision_count int NOT NULL DEFAULT 0,
  is_at_risk boolean NOT NULL DEFAULT false,
  at_risk_reason text,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, phase_number)
);
CREATE INDEX rp_tpp_team_idx ON public.rp_team_phase_progress(team_id);
GRANT SELECT ON public.rp_team_phase_progress TO authenticated;
GRANT ALL ON public.rp_team_phase_progress TO service_role;
ALTER TABLE public.rp_team_phase_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_tpp_admin_all ON public.rp_team_phase_progress FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid())) WITH CHECK (public.rp_is_admin(auth.uid()));
CREATE POLICY rp_tpp_member_read ON public.rp_team_phase_progress FOR SELECT TO authenticated
  USING (public.rp_is_team_member(team_id, auth.uid()) OR public.rp_is_team_mentor(team_id, auth.uid()));
CREATE TRIGGER rp_tpp_updated BEFORE UPDATE ON public.rp_team_phase_progress
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ LOCATIONS ============
CREATE TABLE public.rp_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  phase_number int NOT NULL DEFAULT 0,
  location_name text NOT NULL,
  address text,
  city text,
  state text,
  latitude numeric(10,6),
  longitude numeric(10,6),
  issue_type text,
  severity public.rp_severity DEFAULT 'medium',
  description text,
  is_final_selected boolean NOT NULL DEFAULT false,
  authority_jurisdiction text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rp_locations_team_idx ON public.rp_locations(team_id);
GRANT SELECT, INSERT, UPDATE ON public.rp_locations TO authenticated;
GRANT ALL ON public.rp_locations TO service_role;
ALTER TABLE public.rp_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_loc_admin_all ON public.rp_locations FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid())) WITH CHECK (public.rp_is_admin(auth.uid()));
CREATE POLICY rp_loc_member_rw ON public.rp_locations FOR ALL TO authenticated
  USING (public.rp_is_team_member(team_id, auth.uid()) OR public.rp_is_team_mentor(team_id, auth.uid()))
  WITH CHECK (public.rp_is_team_member(team_id, auth.uid()));

-- ============ SUBMISSIONS ============
CREATE TABLE public.rp_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  phase_number int NOT NULL,
  title text NOT NULL,
  summary text,
  status public.rp_phase_status NOT NULL DEFAULT 'draft',
  submitted_by uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  mentor_review_status text,
  admin_review_status text,
  evaluator_score numeric(5,2),
  revision_number int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rp_sub_team_idx ON public.rp_submissions(team_id);
CREATE INDEX rp_sub_status_idx ON public.rp_submissions(status);
GRANT SELECT, INSERT, UPDATE ON public.rp_submissions TO authenticated;
GRANT ALL ON public.rp_submissions TO service_role;
ALTER TABLE public.rp_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_sub_admin_all ON public.rp_submissions FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid())) WITH CHECK (public.rp_is_admin(auth.uid()));
CREATE POLICY rp_sub_member_rw ON public.rp_submissions FOR ALL TO authenticated
  USING (public.rp_is_team_member(team_id, auth.uid()) OR public.rp_is_team_mentor(team_id, auth.uid()))
  WITH CHECK (public.rp_is_team_member(team_id, auth.uid()));
CREATE TRIGGER rp_sub_updated BEFORE UPDATE ON public.rp_submissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ SUBMISSION FILES ============
CREATE TABLE public.rp_submission_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.rp_submissions(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text,
  file_url text NOT NULL,
  storage_path text,
  file_size bigint,
  uploaded_by uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  evidence_type text,
  latitude numeric(10,6),
  longitude numeric(10,6),
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rp_sf_sub_idx ON public.rp_submission_files(submission_id);
GRANT SELECT, INSERT ON public.rp_submission_files TO authenticated;
GRANT ALL ON public.rp_submission_files TO service_role;
ALTER TABLE public.rp_submission_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_sf_admin_all ON public.rp_submission_files FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid())) WITH CHECK (public.rp_is_admin(auth.uid()));
CREATE POLICY rp_sf_member_rw ON public.rp_submission_files FOR ALL TO authenticated
  USING (public.rp_is_team_member(team_id, auth.uid()) OR public.rp_is_team_mentor(team_id, auth.uid()))
  WITH CHECK (public.rp_is_team_member(team_id, auth.uid()));

-- ============ FEEDBACK ============
CREATE TABLE public.rp_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.rp_submissions(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  phase_number int NOT NULL,
  reviewer_id uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  reviewer_role text NOT NULL,
  feedback_text text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  score numeric(5,2),
  rubric_scores jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rp_fb_sub_idx ON public.rp_feedback(submission_id);
GRANT SELECT, INSERT ON public.rp_feedback TO authenticated;
GRANT ALL ON public.rp_feedback TO service_role;
ALTER TABLE public.rp_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_fb_admin_all ON public.rp_feedback FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid())) WITH CHECK (public.rp_is_admin(auth.uid()));
CREATE POLICY rp_fb_member_read ON public.rp_feedback FOR SELECT TO authenticated
  USING (public.rp_is_team_member(team_id, auth.uid()) OR public.rp_is_team_mentor(team_id, auth.uid()));
CREATE POLICY rp_fb_mentor_write ON public.rp_feedback FOR INSERT TO authenticated
  WITH CHECK (public.rp_is_team_mentor(team_id, auth.uid()) OR public.rp_is_admin(auth.uid()));
CREATE POLICY rp_fb_member_reply ON public.rp_feedback FOR INSERT TO authenticated
  WITH CHECK (public.rp_is_team_member(team_id, auth.uid()) AND reviewer_role = 'team');

-- ============ NOTIFICATIONS ============
CREATE TABLE public.rp_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  type text NOT NULL,
  related_entity_type text,
  related_entity_id uuid,
  action_link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rp_notif_recipient_idx ON public.rp_notifications(recipient_id, is_read);
GRANT SELECT, UPDATE ON public.rp_notifications TO authenticated;
GRANT ALL ON public.rp_notifications TO service_role;
ALTER TABLE public.rp_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_notif_own ON public.rp_notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() OR public.rp_is_admin(auth.uid()));
CREATE POLICY rp_notif_own_update ON public.rp_notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rp_notifications;

-- ============ AUDIT LOGS ============
CREATE TABLE public.rp_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rp_audit_entity_idx ON public.rp_audit_logs(entity_type, entity_id);
GRANT SELECT ON public.rp_audit_logs TO authenticated;
GRANT ALL ON public.rp_audit_logs TO service_role;
ALTER TABLE public.rp_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_audit_admin_read ON public.rp_audit_logs FOR SELECT TO authenticated
  USING (public.rp_is_admin(auth.uid()));

-- ============ SEED PHASE TEMPLATES ============
INSERT INTO public.rp_phase_templates (phase_number, title, description, default_duration_days, required_deliverables, checklist) VALUES
(0, 'Problem Identification', 'Shortlist 3 unsafe road locations and finalize 1 with initial evidence.', 14,
 '["3 shortlisted locations","Photos / videos","Initial problem description","Final selected location","2-3 page report"]'::jsonb,
 '["Add 3 candidate locations","Upload geo-tagged photos","Write initial problem description","Mark final selected location","Submit Phase 0 report"]'::jsonb),
(1, 'Research and Evidence Collection', 'Conduct detailed research and gather evidence around the selected location.', 21,
 '["Research report","RTI / FIR references","News links","Accident history","Stakeholder list","Authority mapping","Evidence files"]'::jsonb,
 '["Compile news + accident history","Collect RTI / FIR references","Map stakeholders and authorities","Upload research report","Submit Phase 1 for mentor review"]'::jsonb),
(2, 'Community Survey and Road Safety Audit', 'Run community surveys and a formal road safety audit on the selected site.', 28,
 '["Mentor-approved survey questionnaire","Survey responses","Road safety audit checklist","Geo-tagged audit photos","Audit report"]'::jsonb,
 '["Draft survey questionnaire","Get mentor approval","Run community survey","Complete RSA checklist","Upload audit report"]'::jsonb),
(3, 'Case Study and Draft Solution', 'Analyse comparable case studies and prepare the first draft solution.', 21,
 '["Comparable case studies","Proposed solution draft","Design references","Feasibility notes","Revised solution report"]'::jsonb,
 '["Document 2-3 comparable case studies","Draft proposed solution","Add design references","Capture feasibility + cost notes","Submit Phase 3 for review"]'::jsonb),
(4, 'Final Report and Authority Pitch', 'Prepare final solution report and pitch the relevant authority.', 28,
 '["Final report","Pitch deck","Authority submission proof","Authority feedback","Approval letter (if any)"]'::jsonb,
 '["Finalize report","Prepare pitch deck","Submit to authority","Capture authority feedback","Upload approval letter"]'::jsonb);

-- ============ PROMOTE EXISTING ADMIN ============
INSERT INTO public.rp_profiles (id, full_name, email, status)
SELECT id,
       COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)),
       email,
       'active'
FROM auth.users
WHERE email = 'admin@gmail.com'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.rp_user_roles (user_id, role)
SELECT id, 'cfi_admin'::public.rp_app_role
FROM auth.users
WHERE email = 'admin@gmail.com'
ON CONFLICT DO NOTHING;
