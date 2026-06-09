GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_user_roles TO authenticated;
GRANT ALL ON public.rp_user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_profiles TO authenticated;
GRANT ALL ON public.rp_profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_role_approvals TO authenticated;
GRANT ALL ON public.rp_role_approvals TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_mentors TO authenticated;
GRANT SELECT ON public.rp_mentors TO anon;
GRANT ALL ON public.rp_mentors TO service_role;