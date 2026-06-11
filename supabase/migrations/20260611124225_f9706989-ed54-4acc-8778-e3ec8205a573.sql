CREATE TABLE public.application_file_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('resume','assignment')),
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','fulfilled','expired','cancelled')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  uploaded_file_id uuid REFERENCES public.application_files(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_afr_application ON public.application_file_requests(application_id);
CREATE INDEX idx_afr_token ON public.application_file_requests(token);
CREATE INDEX idx_afr_status ON public.application_file_requests(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_file_requests TO authenticated;
GRANT ALL ON public.application_file_requests TO service_role;

ALTER TABLE public.application_file_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "afr_admin_select" ON public.application_file_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "afr_admin_insert" ON public.application_file_requests
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "afr_admin_update" ON public.application_file_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "afr_admin_delete" ON public.application_file_requests
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_afr_updated_at
  BEFORE UPDATE ON public.application_file_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Public token lookup: returns the single matching request (with applicant info) or empty.
CREATE OR REPLACE FUNCTION public.application_file_request_by_token(_token text)
RETURNS TABLE (
  id uuid,
  application_id uuid,
  kind text,
  status text,
  expires_at timestamptz,
  fulfilled_at timestamptz,
  full_name text,
  email text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.application_id, r.kind, r.status, r.expires_at, r.fulfilled_at,
         a.full_name, a.email
  FROM public.application_file_requests r
  JOIN public.applications a ON a.id = r.application_id
  WHERE r.token = _token
$$;

GRANT EXECUTE ON FUNCTION public.application_file_request_by_token(text) TO anon, authenticated;