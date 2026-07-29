CREATE OR REPLACE FUNCTION public.rp_profiles_public_rows()
RETURNS TABLE(
  id uuid, full_name text, email text, phone text, city text, state text,
  organization text, college text, blood_group text, address text,
  avatar_url text, status text, created_at timestamptz, updated_at timestamptz,
  jurisdiction_states text[], timezone text, login_id text, profile_completed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.full_name, p.email, p.phone, p.city, p.state, p.organization,
         p.college, p.blood_group, p.address, p.avatar_url, p.status,
         p.created_at, p.updated_at, p.jurisdiction_states, p.timezone,
         p.login_id, p.profile_completed_at
  FROM public.rp_profiles p
  WHERE auth.uid() IS NOT NULL
    AND (p.id = auth.uid() OR public.rp_is_admin(auth.uid()) OR public.rp_shares_team(auth.uid(), p.id))
$$;

REVOKE ALL ON FUNCTION public.rp_profiles_public_rows() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rp_profiles_public_rows() TO authenticated, service_role;

DROP VIEW IF EXISTS public.rp_profiles_public;

CREATE VIEW public.rp_profiles_public WITH (security_invoker = true) AS
  SELECT * FROM public.rp_profiles_public_rows();

REVOKE ALL ON public.rp_profiles_public FROM anon;
GRANT SELECT ON public.rp_profiles_public TO authenticated;
GRANT ALL ON public.rp_profiles_public TO service_role;