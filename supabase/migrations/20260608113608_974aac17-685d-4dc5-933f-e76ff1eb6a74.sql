
-- Catalog
CREATE TABLE public.rp_badges (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'Award',
  criteria text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rp_badges TO anon, authenticated;
GRANT ALL ON public.rp_badges TO service_role;
ALTER TABLE public.rp_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_badges_public_read ON public.rp_badges FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY rp_badges_admin_write ON public.rp_badges FOR ALL TO authenticated
  USING (rp_is_admin(auth.uid())) WITH CHECK (rp_is_admin(auth.uid()));
CREATE TRIGGER rp_badges_updated_at BEFORE UPDATE ON public.rp_badges
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Awards
CREATE TABLE public.rp_team_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  badge_code text NOT NULL REFERENCES public.rp_badges(code) ON DELETE CASCADE,
  awarded_by uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  note text,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, badge_code)
);
GRANT SELECT ON public.rp_team_badges TO anon, authenticated;
GRANT ALL ON public.rp_team_badges TO service_role;
ALTER TABLE public.rp_team_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_team_badges_public_read ON public.rp_team_badges FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY rp_team_badges_admin_write ON public.rp_team_badges FOR ALL TO authenticated
  USING (rp_is_admin(auth.uid())) WITH CHECK (rp_is_admin(auth.uid()));
CREATE INDEX rp_team_badges_team_idx ON public.rp_team_badges(team_id);
CREATE INDEX rp_team_badges_code_idx ON public.rp_team_badges(badge_code);

-- Seed default catalog
INSERT INTO public.rp_badges (code, name, description, icon, criteria, sort_order) VALUES
  ('evidence_champion',   'Evidence Champion',         'Outstanding geo-tagged evidence collection across phases.',  'Camera',     'Highest evidence quality score in cohort.',                    10),
  ('fastest_phase',       'Fastest Phase Completion',  'First team to complete a phase in the cohort.',              'Zap',        'Earliest mentor-approved phase submission.',                   20),
  ('best_road_audit',     'Best Road Audit',           'Most rigorous road safety audit in the cohort.',             'ClipboardCheck','Top audit rubric score in Phase 2.',                        30),
  ('best_survey',         'Best Survey',               'Largest, cleanest community survey dataset.',                'Users',      'Highest survey-response score in Phase 2.',                    40),
  ('best_authority_pitch','Best Authority Pitch',      'Most compelling pitch to authorities in Phase 4.',           'Megaphone',  'Top pitch rubric score in Phase 4.',                           50),
  ('mentors_choice',      'Mentor''s Choice',          'Recognized by the assigned mentor for exemplary work.',      'Heart',      'Awarded manually by mentor recommendation.',                   60),
  ('impact_approved',     'Impact Approved',           'Solution accepted or implemented by authority.',             'CheckCircle2','Authority status moved to approved or implemented.',          70),
  ('community_voice',     'Community Voice',           'Strong community-engagement footprint.',                     'MessageCircle','Verified citizen feedback and stakeholder map.',              80)
ON CONFLICT (code) DO NOTHING;
