
-- Drop broad SELECT policies that enable LIST on public buckets
DROP POLICY IF EXISTS "Public read public-docs" ON storage.objects;
DROP POLICY IF EXISTS "observation_photos_public_read" ON storage.objects;

-- Revoke execute on internal SECURITY DEFINER helpers from public/anon/authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rp_has_role(uuid, rp_app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rp_is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rp_is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rp_is_team_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rp_is_team_mentor(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rp_shares_team(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rp_recompute_team_score(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rp_tg_audit_role_approvals() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rp_tg_audit_user_roles() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rp_tg_eval_recompute() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rp_tg_notify_submission() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Ensure service_role retains execute (it does by default, but be explicit for RLS helpers)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.rp_has_role(uuid, rp_app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.rp_is_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rp_is_super_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rp_is_team_member(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rp_is_team_mentor(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rp_shares_team(uuid, uuid) TO service_role;
