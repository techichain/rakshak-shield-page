
-- applications
DROP POLICY IF EXISTS applications_public_insert ON public.applications;
CREATE POLICY applications_public_insert ON public.applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'submitted'::application_status
    AND internal_score IS NULL
    AND decision_notes IS NULL
    AND assigned_reviewer_id IS NULL
  );

-- application_files
DROP POLICY IF EXISTS application_files_public_insert ON public.application_files;
CREATE POLICY application_files_public_insert ON public.application_files
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id)
  );

-- page_events
DROP POLICY IF EXISTS page_events_public_insert ON public.page_events;
CREATE POLICY page_events_public_insert ON public.page_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    event_type IN ('page_view','cta_click','form_start','form_submit','form_error','outbound_click','scroll_depth')
    AND length(path) <= 512
    AND (referrer IS NULL OR length(referrer) <= 1024)
    AND (user_agent IS NULL OR length(user_agent) <= 1024)
  );

-- rp_mentor_applications
DROP POLICY IF EXISTS rp_mentor_app_public_insert ON public.rp_mentor_applications;
CREATE POLICY rp_mentor_app_public_insert ON public.rp_mentor_applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND review_notes IS NULL
    AND created_mentor_id IS NULL
  );
