
-- Helper: is this user the team leader?
CREATE OR REPLACE FUNCTION public.rp_is_team_leader(_team uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.rp_teams WHERE id = _team AND team_leader_id = _user)
$$;

-- Tighten submissions: split read (any team member/mentor/admin) from write (leader/mentor/admin)
DROP POLICY IF EXISTS rp_sub_member_rw ON public.rp_submissions;

CREATE POLICY rp_sub_member_read ON public.rp_submissions
  FOR SELECT
  USING (
    public.rp_is_admin(auth.uid())
    OR public.rp_is_team_member(team_id, auth.uid())
    OR public.rp_is_team_mentor(team_id, auth.uid())
  );

CREATE POLICY rp_sub_leader_write ON public.rp_submissions
  FOR INSERT
  WITH CHECK (
    public.rp_is_admin(auth.uid())
    OR public.rp_is_team_leader(team_id, auth.uid())
    OR public.rp_is_team_mentor(team_id, auth.uid())
  );

CREATE POLICY rp_sub_leader_update ON public.rp_submissions
  FOR UPDATE
  USING (
    public.rp_is_admin(auth.uid())
    OR public.rp_is_team_leader(team_id, auth.uid())
    OR public.rp_is_team_mentor(team_id, auth.uid())
  )
  WITH CHECK (
    public.rp_is_admin(auth.uid())
    OR public.rp_is_team_leader(team_id, auth.uid())
    OR public.rp_is_team_mentor(team_id, auth.uid())
  );

CREATE POLICY rp_sub_leader_delete ON public.rp_submissions
  FOR DELETE
  USING (
    public.rp_is_admin(auth.uid())
    OR public.rp_is_team_leader(team_id, auth.uid())
    OR public.rp_is_team_mentor(team_id, auth.uid())
  );

-- Tighten team meeting creation: no plain team members
DROP POLICY IF EXISTS rp_meet_insert_v2 ON public.rp_meetings;

CREATE POLICY rp_meet_insert_v3 ON public.rp_meetings
  FOR INSERT
  WITH CHECK (
    public.rp_is_admin(auth.uid())
    OR (
      team_id IS NOT NULL AND (
        public.rp_is_team_leader(team_id, auth.uid())
        OR public.rp_is_team_mentor(team_id, auth.uid())
      )
    )
    OR (
      team_id IS NULL AND (
        public.rp_has_role(auth.uid(), 'mentor'::rp_app_role)
        OR public.rp_has_role(auth.uid(), 'evaluator'::rp_app_role)
      )
    )
  );

-- Backfill trigger: link new signups to any pre-created team-member row and grant role
CREATE OR REPLACE FUNCTION public.rp_tg_link_team_member_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_count integer;
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.rp_team_members
     SET profile_id = NEW.id
   WHERE profile_id IS NULL
     AND lower(email) = lower(NEW.email);

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count > 0 THEN
    INSERT INTO public.rp_user_roles (user_id, role)
    VALUES (NEW.id, 'team_member'::rp_app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rp_tg_link_team_member_on_signup() FROM anon, authenticated;

DROP TRIGGER IF EXISTS rp_link_team_member_on_signup ON auth.users;
CREATE TRIGGER rp_link_team_member_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.rp_tg_link_team_member_on_signup();
