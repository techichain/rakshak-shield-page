
-- 1. search_path on queue helpers
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

-- 2. Relocate pg_net
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, service_role;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

-- 3. Restrictive policy on rp_email_otps
DROP POLICY IF EXISTS "rp_email_otps_no_client_access" ON public.rp_email_otps;
CREATE POLICY "rp_email_otps_no_client_access"
  ON public.rp_email_otps
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- 4. Revoke EXECUTE on functions that should not be reachable via the Data API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rp_tg_apply_role_invites() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rp_tg_audit_role_approvals() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rp_tg_audit_user_roles() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rp_tg_eval_recompute() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rp_tg_notify_submission() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rp_recompute_team_score(uuid) FROM anon, authenticated, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.admin_enable_gmail_bulk_delete(integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_gmail_users(text) FROM anon, PUBLIC;
