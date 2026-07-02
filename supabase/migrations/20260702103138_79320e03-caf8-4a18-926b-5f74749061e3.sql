
-- Mentor resource sharing
CREATE TABLE IF NOT EXISTS public.rp_mentor_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES public.rp_profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.rp_teams(id) ON DELETE CASCADE, -- null = all mentor's teams
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  kind text NOT NULL CHECK (kind IN ('file','link')),
  external_url text CHECK (external_url IS NULL OR char_length(external_url) <= 2000),
  file_name text,
  file_type text,
  file_size bigint,
  storage_path text,
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_mentor_resources TO authenticated;
GRANT ALL ON public.rp_mentor_resources TO service_role;

CREATE INDEX IF NOT EXISTS rp_mentor_resources_mentor_idx ON public.rp_mentor_resources(mentor_id);
CREATE INDEX IF NOT EXISTS rp_mentor_resources_team_idx ON public.rp_mentor_resources(team_id);

CREATE TRIGGER rp_mentor_resources_set_updated_at
BEFORE UPDATE ON public.rp_mentor_resources
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.rp_mentor_resources ENABLE ROW LEVEL SECURITY;

-- Helper: can this user view this mentor resource row?
CREATE OR REPLACE FUNCTION public.rp_can_view_mentor_resource(_mentor uuid, _team uuid, _user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.rp_is_admin(_user)
    OR _mentor = _user
    OR (
      _team IS NOT NULL
      AND (
        public.rp_is_team_member(_team, _user)
        OR public.rp_is_team_leader(_team, _user)
      )
    )
    OR (
      _team IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.rp_teams t
        JOIN public.rp_mentors m ON m.id = t.assigned_mentor_id
        WHERE m.profile_id = _mentor
          AND (
            t.team_leader_id = _user
            OR EXISTS (SELECT 1 FROM public.rp_team_members tm WHERE tm.team_id = t.id AND tm.profile_id = _user)
          )
      )
    )
$$;

CREATE POLICY "rp_mentor_resources_select"
ON public.rp_mentor_resources FOR SELECT TO authenticated
USING (public.rp_can_view_mentor_resource(mentor_id, team_id, auth.uid()));

CREATE POLICY "rp_mentor_resources_insert"
ON public.rp_mentor_resources FOR INSERT TO authenticated
WITH CHECK (
  mentor_id = auth.uid()
  AND public.rp_has_role(auth.uid(), 'mentor'::rp_app_role)
);

CREATE POLICY "rp_mentor_resources_update_own"
ON public.rp_mentor_resources FOR UPDATE TO authenticated
USING (mentor_id = auth.uid())
WITH CHECK (mentor_id = auth.uid());

CREATE POLICY "rp_mentor_resources_delete_own_or_admin"
ON public.rp_mentor_resources FOR DELETE TO authenticated
USING (mentor_id = auth.uid() OR public.rp_is_admin(auth.uid()));
