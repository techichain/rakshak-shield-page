
-- 1. Drop observations from the realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.observations;

-- 2. Authority jurisdiction scoping
ALTER TABLE public.rp_profiles
  ADD COLUMN IF NOT EXISTS jurisdiction_states text[] NOT NULL DEFAULT '{}'::text[];

DROP POLICY IF EXISTS "Team members can manage own authority reports" ON public.rp_authority_reports;

CREATE POLICY rp_auth_reports_team_rw ON public.rp_authority_reports
  FOR ALL TO authenticated
  USING (public.rp_is_team_member(team_id, auth.uid()) OR public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_team_member(team_id, auth.uid()) OR public.rp_is_admin(auth.uid()));

CREATE POLICY rp_auth_reports_authority_scoped_read ON public.rp_authority_reports
  FOR SELECT TO authenticated
  USING (
    public.rp_has_role(auth.uid(), 'authority')
    AND EXISTS (
      SELECT 1
      FROM public.rp_teams t
      JOIN public.rp_profiles p ON p.id = auth.uid()
      WHERE t.id = rp_authority_reports.team_id
        AND (
          array_length(p.jurisdiction_states, 1) IS NULL
          OR t.state = ANY(p.jurisdiction_states)
        )
    )
  );
