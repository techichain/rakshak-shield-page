-- Safeguard: block mass Gmail deletion unless a super_admin has explicitly enabled
-- a one-shot permission flag. Without an enabled, unexpired flag, the helper aborts.

CREATE TABLE IF NOT EXISTS public.admin_bulk_delete_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern text NOT NULL UNIQUE,                    -- e.g. 'gmail'
  enabled boolean NOT NULL DEFAULT false,
  max_rows integer NOT NULL DEFAULT 0,             -- 0 = blocked; safety cap when enabled
  enabled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  enabled_at timestamptz,
  expires_at timestamptz,                          -- must be in the future to be usable
  consumed_at timestamptz,                         -- set after a successful bulk delete
  consumed_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_bulk_delete_permissions TO authenticated;
GRANT ALL ON public.admin_bulk_delete_permissions TO service_role;

ALTER TABLE public.admin_bulk_delete_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admins can view bulk delete permissions"
  ON public.admin_bulk_delete_permissions
  FOR SELECT
  TO authenticated
  USING (public.rp_is_super_admin(auth.uid()));

CREATE TRIGGER admin_bulk_delete_permissions_set_updated_at
  BEFORE UPDATE ON public.admin_bulk_delete_permissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed a disabled gmail row so admins can flip it on, never auto-grants.
INSERT INTO public.admin_bulk_delete_permissions (pattern, enabled, max_rows)
VALUES ('gmail', false, 0)
ON CONFLICT (pattern) DO NOTHING;

-- Enable the gmail one-shot flag (super_admin only).
CREATE OR REPLACE FUNCTION public.admin_enable_gmail_bulk_delete(_max_rows integer, _ttl_minutes integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.rp_is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: super_admin required';
  END IF;
  IF _max_rows IS NULL OR _max_rows <= 0 OR _max_rows > 50 THEN
    RAISE EXCEPTION 'invalid max_rows (must be 1..50)';
  END IF;
  IF _ttl_minutes IS NULL OR _ttl_minutes <= 0 OR _ttl_minutes > 60 THEN
    RAISE EXCEPTION 'invalid ttl_minutes (must be 1..60)';
  END IF;

  UPDATE public.admin_bulk_delete_permissions
     SET enabled = true,
         max_rows = _max_rows,
         enabled_by = auth.uid(),
         enabled_at = now(),
         expires_at = now() + make_interval(mins => _ttl_minutes),
         consumed_at = NULL,
         consumed_count = NULL
   WHERE pattern = 'gmail'
   RETURNING id INTO v_id;

  INSERT INTO public.rp_audit_logs (actor_id, action, entity_type, entity_id, new_value)
  VALUES (auth.uid(), 'bulk_delete_flag_enabled', 'admin_bulk_delete_permissions', v_id,
          jsonb_build_object('pattern','gmail','max_rows',_max_rows,'ttl_minutes',_ttl_minutes));

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_enable_gmail_bulk_delete(integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_enable_gmail_bulk_delete(integer, integer) TO authenticated;

-- Perform the gmail deletion. Aborts unless: caller is super_admin, flag is enabled
-- and unexpired, requested deletion count is within max_rows, and an explicit
-- confirmation token is passed. The flag is consumed after one use.
CREATE OR REPLACE FUNCTION public.admin_delete_gmail_users(_confirm text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perm public.admin_bulk_delete_permissions;
  v_target_count integer;
  v_deleted integer;
BEGIN
  IF NOT public.rp_is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: super_admin required';
  END IF;
  IF _confirm IS DISTINCT FROM 'I_UNDERSTAND_DELETE_GMAIL_USERS' THEN
    RAISE EXCEPTION 'missing confirmation token';
  END IF;

  SELECT * INTO v_perm
    FROM public.admin_bulk_delete_permissions
   WHERE pattern = 'gmail'
   FOR UPDATE;

  IF v_perm.id IS NULL OR NOT v_perm.enabled
     OR v_perm.expires_at IS NULL OR v_perm.expires_at <= now()
     OR v_perm.consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'gmail bulk-delete flag is not enabled (or expired/consumed)';
  END IF;

  SELECT count(*) INTO v_target_count
    FROM auth.users WHERE email ILIKE '%@gmail.com';

  IF v_target_count > v_perm.max_rows THEN
    RAISE EXCEPTION 'target count % exceeds permitted max_rows %', v_target_count, v_perm.max_rows;
  END IF;

  -- Clean up dependent app data first.
  DELETE FROM public.rp_meetings
   WHERE created_by IN (SELECT id FROM auth.users WHERE email ILIKE '%@gmail.com');

  WITH d AS (
    DELETE FROM auth.users WHERE email ILIKE '%@gmail.com' RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM d;

  UPDATE public.admin_bulk_delete_permissions
     SET enabled = false,
         consumed_at = now(),
         consumed_count = v_deleted
   WHERE id = v_perm.id;

  INSERT INTO public.rp_audit_logs (actor_id, action, entity_type, entity_id, new_value)
  VALUES (auth.uid(), 'bulk_delete_gmail_users', 'auth.users', v_perm.id,
          jsonb_build_object('deleted', v_deleted, 'max_rows', v_perm.max_rows));

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_gmail_users(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_gmail_users(text) TO authenticated;