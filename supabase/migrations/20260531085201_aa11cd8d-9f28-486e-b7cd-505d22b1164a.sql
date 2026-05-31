
-- Public submission path (anon) + authenticated reads/writes via RLS
GRANT INSERT ON public.applications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;

GRANT INSERT ON public.application_files TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_files TO authenticated;
GRANT ALL ON public.application_files TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_reviews TO authenticated;
GRANT ALL ON public.application_reviews TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_status_events TO authenticated;
GRANT ALL ON public.application_status_events TO service_role;

GRANT INSERT ON public.page_events TO anon;
GRANT SELECT, INSERT ON public.page_events TO authenticated;
GRANT ALL ON public.page_events TO service_role;
