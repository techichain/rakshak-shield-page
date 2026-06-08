
CREATE TABLE public.rp_mentor_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  city text,
  state text,
  organization text,
  designation text,
  expertise text,
  years_experience integer,
  linkedin_url text,
  motivation text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_mentor_id uuid REFERENCES public.rp_mentors(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_mentor_applications TO authenticated;
GRANT INSERT ON public.rp_mentor_applications TO anon;
GRANT ALL ON public.rp_mentor_applications TO service_role;

ALTER TABLE public.rp_mentor_applications ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can submit
CREATE POLICY "rp_mentor_app_public_insert" ON public.rp_mentor_applications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Admins manage
CREATE POLICY "rp_mentor_app_admin_all" ON public.rp_mentor_applications
  FOR ALL TO authenticated USING (public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_admin(auth.uid()));

CREATE TRIGGER rp_mentor_app_updated_at BEFORE UPDATE ON public.rp_mentor_applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX rp_mentor_app_status_idx ON public.rp_mentor_applications(status);
