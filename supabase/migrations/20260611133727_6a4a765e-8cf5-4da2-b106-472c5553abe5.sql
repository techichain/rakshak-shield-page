CREATE TABLE IF NOT EXISTS public.rp_role_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role rp_app_role NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  note text,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  accepted_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rp_role_invites_email_role_pending_uq
  ON public.rp_role_invites (lower(email), role)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS rp_role_invites_status_idx
  ON public.rp_role_invites (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_role_invites TO authenticated;
GRANT ALL ON public.rp_role_invites TO service_role;

ALTER TABLE public.rp_role_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY rp_role_invites_admin_all ON public.rp_role_invites
  TO authenticated
  USING (public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_admin(auth.uid()));

CREATE TRIGGER rp_role_invites_updated
  BEFORE UPDATE ON public.rp_role_invites
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-grant invited roles when the matching user creates an rp_profile.
CREATE OR REPLACE FUNCTION public.rp_tg_apply_role_invites()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;
  FOR r IN
    SELECT id, role
    FROM public.rp_role_invites
    WHERE status = 'pending' AND lower(email) = lower(NEW.email)
  LOOP
    INSERT INTO public.rp_user_roles (user_id, role)
    VALUES (NEW.id, r.role)
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.rp_role_invites
       SET status = 'accepted',
           accepted_user_id = NEW.id,
           reviewed_at = now()
     WHERE id = r.id;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rp_tg_apply_role_invites_after_profile ON public.rp_profiles;
CREATE TRIGGER rp_tg_apply_role_invites_after_profile
  AFTER INSERT ON public.rp_profiles
  FOR EACH ROW EXECUTE FUNCTION public.rp_tg_apply_role_invites();