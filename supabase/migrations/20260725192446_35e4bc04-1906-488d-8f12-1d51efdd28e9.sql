ALTER TABLE public.rp_location_photos
  ADD COLUMN media_type text NOT NULL DEFAULT 'photo' CHECK (media_type IN ('photo','video')),
  ADD COLUMN phase_number int;
ALTER TABLE public.rp_location_photos ALTER COLUMN location_id DROP NOT NULL;

ALTER TABLE public.rp_authority_reports
  ADD COLUMN implementation_status text CHECK (implementation_status IN ('not_started','in_progress','completed','rejected')),
  ADD COLUMN implementation_notes text,
  ADD COLUMN approval_letter_url text;

CREATE TABLE public.rp_authority_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.rp_authority_reports(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  update_text text NOT NULL,
  status text,
  file_path text,
  created_by uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rp_authority_updates_report_idx ON public.rp_authority_updates (report_id, created_at DESC);
CREATE INDEX rp_authority_updates_team_idx ON public.rp_authority_updates (team_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_authority_updates TO authenticated;
GRANT ALL ON public.rp_authority_updates TO service_role;

ALTER TABLE public.rp_authority_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_auth_updates_team_rw"
  ON public.rp_authority_updates FOR ALL TO authenticated
  USING (public.rp_is_team_member(team_id, auth.uid()) OR public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_team_member(team_id, auth.uid()) OR public.rp_is_admin(auth.uid()));

CREATE POLICY "rp_auth_updates_authority_scoped_read"
  ON public.rp_authority_updates FOR SELECT TO authenticated
  USING (
    public.rp_has_role(auth.uid(), 'authority'::rp_app_role)
    AND EXISTS (
      SELECT 1 FROM public.rp_teams t
      JOIN public.rp_profiles p ON p.id = auth.uid()
      WHERE t.id = rp_authority_updates.team_id
        AND (array_length(p.jurisdiction_states, 1) IS NULL OR t.state = ANY (p.jurisdiction_states))
    )
  );

CREATE POLICY "rp_auth_updates_mentor_read"
  ON public.rp_authority_updates FOR SELECT TO authenticated
  USING (public.rp_is_team_mentor(team_id, auth.uid()));

CREATE POLICY "Authority and admins can update rp_authority_updates"
  ON public.rp_authority_updates FOR UPDATE TO authenticated
  USING (public.rp_has_role(auth.uid(), 'authority'::rp_app_role) OR public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_has_role(auth.uid(), 'authority'::rp_app_role) OR public.rp_is_admin(auth.uid()));