
-- 1. Evaluator/Admin approval queue
CREATE TABLE public.rp_role_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_role rp_app_role NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rp_role_approvals_status_idx ON public.rp_role_approvals(status, requested_at DESC);
CREATE INDEX rp_role_approvals_user_idx ON public.rp_role_approvals(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_role_approvals TO authenticated;
GRANT ALL ON public.rp_role_approvals TO service_role;

ALTER TABLE public.rp_role_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_role_approvals_self_insert" ON public.rp_role_approvals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "rp_role_approvals_self_read" ON public.rp_role_approvals
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.rp_is_admin(auth.uid()));
CREATE POLICY "rp_role_approvals_admin_all" ON public.rp_role_approvals
  FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_admin(auth.uid()));

CREATE TRIGGER rp_role_approvals_updated
  BEFORE UPDATE ON public.rp_role_approvals
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. Audit trigger on rp_user_roles changes
CREATE OR REPLACE FUNCTION public.rp_tg_audit_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.rp_audit_logs (actor_id, action, entity_type, entity_id, new_value)
    VALUES (auth.uid(), 'role_granted', 'rp_user_roles', NEW.id,
            jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role::text));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.rp_audit_logs (actor_id, action, entity_type, entity_id, old_value)
    VALUES (auth.uid(), 'role_revoked', 'rp_user_roles', OLD.id,
            jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role::text));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS rp_tg_audit_user_roles ON public.rp_user_roles;
CREATE TRIGGER rp_tg_audit_user_roles
  AFTER INSERT OR DELETE ON public.rp_user_roles
  FOR EACH ROW EXECUTE FUNCTION public.rp_tg_audit_user_roles();

-- 3. Audit trigger on rp_role_approvals reviews
CREATE OR REPLACE FUNCTION public.rp_tg_audit_role_approvals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.rp_audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (auth.uid(),
            'role_approval_' || NEW.status,
            'rp_role_approvals',
            NEW.id,
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('user_id', NEW.user_id, 'role', NEW.requested_role::text, 'status', NEW.status, 'notes', NEW.notes));
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.rp_audit_logs (actor_id, action, entity_type, entity_id, new_value)
    VALUES (NEW.user_id, 'role_approval_requested', 'rp_role_approvals', NEW.id,
            jsonb_build_object('user_id', NEW.user_id, 'role', NEW.requested_role::text));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rp_tg_audit_role_approvals ON public.rp_role_approvals;
CREATE TRIGGER rp_tg_audit_role_approvals
  AFTER INSERT OR UPDATE ON public.rp_role_approvals
  FOR EACH ROW EXECUTE FUNCTION public.rp_tg_audit_role_approvals();

-- 4. Notify admins + audit on submission creation/updates
CREATE OR REPLACE FUNCTION public.rp_tg_notify_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_name text;
  v_admin_id uuid;
  v_title text;
  v_action text;
BEGIN
  SELECT team_name INTO v_team_name FROM public.rp_teams WHERE id = NEW.team_id;

  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_title := format('New submission: %s (Phase %s) — %s', NEW.title, NEW.phase_number, COALESCE(v_team_name,'team'));
  ELSIF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.submitted_at IS DISTINCT FROM NEW.submitted_at) THEN
    v_action := 'status_' || NEW.status::text;
    v_title := format('Submission updated: %s — %s (Phase %s) [%s]', COALESCE(v_team_name,'team'), NEW.title, NEW.phase_number, NEW.status);
  ELSE
    RETURN NEW;
  END IF;

  -- audit
  INSERT INTO public.rp_audit_logs (actor_id, action, entity_type, entity_id, new_value)
  VALUES (auth.uid(), 'submission_' || v_action, 'rp_submissions', NEW.id,
          jsonb_build_object('team_id', NEW.team_id, 'phase', NEW.phase_number, 'status', NEW.status::text, 'title', NEW.title));

  -- notify every admin (cfi_admin + super_admin)
  FOR v_admin_id IN
    SELECT user_id FROM public.rp_user_roles WHERE role IN ('cfi_admin','super_admin')
  LOOP
    INSERT INTO public.rp_notifications (recipient_id, title, message, type, related_entity_type, related_entity_id, action_link)
    VALUES (v_admin_id, v_title, NEW.summary, 'submission_' || v_action, 'rp_submissions', NEW.id,
            '/rakshak-platform/admin');
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rp_tg_notify_submission ON public.rp_submissions;
CREATE TRIGGER rp_tg_notify_submission
  AFTER INSERT OR UPDATE ON public.rp_submissions
  FOR EACH ROW EXECUTE FUNCTION public.rp_tg_notify_submission();

-- 5. Helper: super admin check
CREATE OR REPLACE FUNCTION public.rp_is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.rp_user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;
