
-- Knowledge hub articles
CREATE TABLE public.rp_knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  excerpt text,
  body_md text NOT NULL DEFAULT '',
  hero_image_url text,
  tags text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT false,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rp_knowledge_articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_knowledge_articles TO authenticated;
GRANT ALL ON public.rp_knowledge_articles TO service_role;
ALTER TABLE public.rp_knowledge_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read published articles" ON public.rp_knowledge_articles
  FOR SELECT TO anon, authenticated USING (is_published = true OR public.rp_is_admin(auth.uid()));
CREATE POLICY "Admins manage articles" ON public.rp_knowledge_articles
  FOR ALL TO authenticated USING (public.rp_is_admin(auth.uid())) WITH CHECK (public.rp_is_admin(auth.uid()));
CREATE TRIGGER rp_knowledge_articles_updated
  BEFORE UPDATE ON public.rp_knowledge_articles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Authority reports (team submissions to authorities)
CREATE TABLE public.rp_authority_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.rp_locations(id) ON DELETE SET NULL,
  authority_name text NOT NULL,
  authority_category text NOT NULL DEFAULT 'municipal',
  contact_person text,
  contact_email text,
  contact_phone text,
  subject text NOT NULL,
  message text NOT NULL DEFAULT '',
  attachment_url text,
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  response_text text,
  response_status text,
  response_at timestamptz,
  response_attachment_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rp_authority_reports_team_idx ON public.rp_authority_reports(team_id);
CREATE INDEX rp_authority_reports_status_idx ON public.rp_authority_reports(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_authority_reports TO authenticated;
GRANT ALL ON public.rp_authority_reports TO service_role;
ALTER TABLE public.rp_authority_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can manage own authority reports" ON public.rp_authority_reports
  FOR ALL TO authenticated
  USING (public.rp_is_team_member(team_id, auth.uid()) OR public.rp_is_admin(auth.uid()) OR public.rp_has_role(auth.uid(),'authority'))
  WITH CHECK (public.rp_is_team_member(team_id, auth.uid()) OR public.rp_is_admin(auth.uid()));

CREATE POLICY "Authority and admins can update response" ON public.rp_authority_reports
  FOR UPDATE TO authenticated
  USING (public.rp_has_role(auth.uid(),'authority') OR public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_has_role(auth.uid(),'authority') OR public.rp_is_admin(auth.uid()));

CREATE TRIGGER rp_authority_reports_updated
  BEFORE UPDATE ON public.rp_authority_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed a few knowledge articles
INSERT INTO public.rp_knowledge_articles (slug, title, category, excerpt, body_md, tags, is_published, published_at) VALUES
('road-safety-audit-basics', 'Road Safety Audit Basics', 'foundations',
  'A practical introduction to conducting youth-led road safety audits in Indian cities.',
  E'# Road Safety Audit Basics\n\nA road safety audit is a structured examination of a road or intersection to identify safety concerns.\n\n## Why it matters\n- 150,000+ road deaths each year in India.\n- Most crashes are preventable through better design and enforcement.\n\n## Five steps for a Project Rakshak audit\n1. Pick a location with documented incident history.\n2. Observe at peak and off-peak hours.\n3. Capture geotagged photos of every issue.\n4. Survey 30+ road users.\n5. Draft recommendations using the iRAP framework.\n', ARRAY['audit','foundations'], true, now()),
('writing-a-good-authority-letter', 'Writing a Good Authority Letter', 'advocacy',
  'How to write an authority letter that actually gets a response.',
  E'# Writing a Good Authority Letter\n\nKeep it short, factual, and actionable.\n\n- Address the right department (NHAI vs PWD vs Municipal).\n- Include 1 cover paragraph + 3 bullet findings + 1 recommendation.\n- Attach geotagged photos and one map snapshot.\n- Always copy your mentor and the CFI team.\n', ARRAY['advocacy','letters'], true, now()),
('using-the-hotspot-map', 'Using the Hotspot Map', 'platform',
  'A quick tour of the public hotspot map and how teams contribute to it.',
  E'# Using the Hotspot Map\n\nEvery team submission becomes a pin on the public map once approved.\n\n## What gets shown\n- Approximate location\n- Severity tier\n- Issue category\n\n## What is hidden\n- Member names\n- Exact photos with PII\n', ARRAY['platform','maps'], true, now());
