
ALTER TABLE public.rp_mentor_resources
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'mentor'
  CHECK (source IN ('mentor','admin'));

CREATE INDEX IF NOT EXISTS rp_mentor_resources_source_idx
  ON public.rp_mentor_resources (source);

-- Additive SELECT policy: any authenticated user can read global admin resources.
-- Team-scoped admin resources (team_id set) are still gated by the existing
-- rp_can_view_mentor_resource(...) policy, which already allows the team's
-- members, leader, mentor, and admins.
DROP POLICY IF EXISTS rp_mentor_resources_select_admin_global
  ON public.rp_mentor_resources;

CREATE POLICY rp_mentor_resources_select_admin_global
  ON public.rp_mentor_resources
  FOR SELECT
  TO authenticated
  USING (source = 'admin' AND team_id IS NULL);
