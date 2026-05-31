
-- ============================================================================
-- Project Rakshak Mentor Portal — Phase 0 schema
-- Track-aware applications (mentor, auditor, ngo_partner, student_team)
-- ============================================================================

CREATE TYPE public.application_track AS ENUM ('mentor', 'auditor', 'ngo_partner', 'student_team');

CREATE TYPE public.application_status AS ENUM (
  'submitted',
  'under_review',
  'shortlisted',
  'interview',
  'selected',
  'rejected',
  'withdrawn'
);

CREATE TYPE public.application_file_kind AS ENUM ('assignment', 'cv', 'other');

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track public.application_track NOT NULL,
  status public.application_status NOT NULL DEFAULT 'submitted',

  -- Common applicant fields (shared across tracks)
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'India',
  organisation TEXT,
  designation TEXT,
  linkedin_url TEXT,
  years_experience INTEGER,
  expertise_domain TEXT,

  -- Track-specific structured payload (mentor-specific Qs, NGO-specific Qs, etc.)
  track_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Admin / pipeline
  internal_score NUMERIC(5,2),
  decision_notes TEXT,
  assigned_reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_applications_track ON public.applications(track);
CREATE INDEX idx_applications_status ON public.applications(status);
CREATE INDEX idx_applications_email ON public.applications(email);
CREATE INDEX idx_applications_submitted_at ON public.applications(submitted_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT INSERT ON public.applications TO anon;  -- public form submission
GRANT ALL ON public.applications TO service_role;

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated applicants) can submit
CREATE POLICY applications_public_insert ON public.applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read / update / delete
CREATE POLICY applications_admin_select ON public.applications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY applications_admin_update ON public.applications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY applications_admin_delete ON public.applications
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- application_files (assignment uploads, CV, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE public.application_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  kind public.application_file_kind NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'mentor-applications',
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_application_files_application_id ON public.application_files(application_id);

GRANT SELECT, INSERT, DELETE ON public.application_files TO authenticated;
GRANT INSERT ON public.application_files TO anon;
GRANT ALL ON public.application_files TO service_role;

ALTER TABLE public.application_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY application_files_public_insert ON public.application_files
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY application_files_admin_select ON public.application_files
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY application_files_admin_delete ON public.application_files
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- application_reviews (reviewer notes + scoring; multiple per application)
-- ---------------------------------------------------------------------------
CREATE TABLE public.application_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score NUMERIC(5,2),
  notes TEXT,
  recommendation TEXT,  -- e.g. 'shortlist', 'reject', 'hold'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_application_reviews_application_id ON public.application_reviews(application_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_reviews TO authenticated;
GRANT ALL ON public.application_reviews TO service_role;

ALTER TABLE public.application_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY application_reviews_admin_all ON public.application_reviews
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_application_reviews_updated_at
  BEFORE UPDATE ON public.application_reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- application_status_events (status history)
-- ---------------------------------------------------------------------------
CREATE TABLE public.application_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  from_status public.application_status,
  to_status public.application_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_application_status_events_app ON public.application_status_events(application_id);

GRANT SELECT, INSERT ON public.application_status_events TO authenticated;
GRANT ALL ON public.application_status_events TO service_role;

ALTER TABLE public.application_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_status_events_admin_all ON public.application_status_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- page_events (lightweight visitor analytics)
-- ---------------------------------------------------------------------------
CREATE TABLE public.page_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,  -- 'page_view', 'apply_start', 'apply_submit', 'jd_download', 'assignment_download'
  path TEXT NOT NULL,
  track public.application_track,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  session_id TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_events_created_at ON public.page_events(created_at DESC);
CREATE INDEX idx_page_events_event_type ON public.page_events(event_type);
CREATE INDEX idx_page_events_path ON public.page_events(path);

GRANT INSERT ON public.page_events TO anon, authenticated;
GRANT SELECT ON public.page_events TO authenticated;
GRANT ALL ON public.page_events TO service_role;

ALTER TABLE public.page_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY page_events_public_insert ON public.page_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY page_events_admin_select ON public.page_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- Storage bucket for assignment uploads (PRIVATE — admin reads via signed URL)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mentor-applications',
  'mentor-applications',
  false,
  26214400,  -- 25 MB
  ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/zip','application/x-zip-compressed']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone can upload (anonymous applicants)
CREATE POLICY mentor_apps_anon_upload ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'mentor-applications');

-- Only admins can read uploaded files
CREATE POLICY mentor_apps_admin_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'mentor-applications' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY mentor_apps_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'mentor-applications' AND public.has_role(auth.uid(), 'admin'::app_role));
