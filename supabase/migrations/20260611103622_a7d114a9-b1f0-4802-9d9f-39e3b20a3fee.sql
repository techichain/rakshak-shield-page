GRANT EXECUTE ON FUNCTION public.rp_is_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rp_has_role(uuid, rp_app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rp_is_super_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rp_is_team_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rp_is_team_mentor(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rp_shares_team(uuid, uuid) TO authenticated, anon;