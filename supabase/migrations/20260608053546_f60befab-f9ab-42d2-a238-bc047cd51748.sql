
-- 1. Extend rp_locations with authority + ranking metadata
ALTER TABLE public.rp_locations
  ADD COLUMN IF NOT EXISTS submitted_to_authority_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS authority_response TEXT,
  ADD COLUMN IF NOT EXISTS priority_rank INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_rp_locations_city_final ON public.rp_locations (city, is_final_selected);
CREATE INDEX IF NOT EXISTS idx_rp_locations_team_phase ON public.rp_locations (team_id, phase_number);

DROP TRIGGER IF EXISTS rp_locations_set_updated_at ON public.rp_locations;
CREATE TRIGGER rp_locations_set_updated_at
  BEFORE UPDATE ON public.rp_locations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. New table: rp_location_photos (geo-tagged evidence for a location)
CREATE TABLE IF NOT EXISTS public.rp_location_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.rp_locations(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  caption TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  taken_at TIMESTAMPTZ,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rp_location_photos_location ON public.rp_location_photos (location_id);
CREATE INDEX IF NOT EXISTS idx_rp_location_photos_team ON public.rp_location_photos (team_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_location_photos TO authenticated;
GRANT ALL ON public.rp_location_photos TO service_role;

ALTER TABLE public.rp_location_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_location_photos_select"
  ON public.rp_location_photos FOR SELECT TO authenticated
  USING (
    public.rp_is_admin(auth.uid())
    OR public.rp_is_team_member(team_id, auth.uid())
    OR public.rp_is_team_mentor(team_id, auth.uid())
  );

CREATE POLICY "rp_location_photos_insert"
  ON public.rp_location_photos FOR INSERT TO authenticated
  WITH CHECK (
    public.rp_is_admin(auth.uid())
    OR public.rp_is_team_member(team_id, auth.uid())
  );

CREATE POLICY "rp_location_photos_update"
  ON public.rp_location_photos FOR UPDATE TO authenticated
  USING (
    public.rp_is_admin(auth.uid())
    OR public.rp_is_team_member(team_id, auth.uid())
  );

CREATE POLICY "rp_location_photos_delete"
  ON public.rp_location_photos FOR DELETE TO authenticated
  USING (
    public.rp_is_admin(auth.uid())
    OR public.rp_is_team_member(team_id, auth.uid())
  );

-- 3. Storage policies on rp-submissions for locations/ prefix
-- Path: locations/{team_id}/{location_id}/{filename}
CREATE POLICY "rp_loc_photos_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'rp-submissions'
    AND (storage.foldername(name))[1] = 'locations'
    AND (
      public.rp_is_admin(auth.uid())
      OR public.rp_is_team_member(((storage.foldername(name))[2])::uuid, auth.uid())
      OR public.rp_is_team_mentor(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  );

CREATE POLICY "rp_loc_photos_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rp-submissions'
    AND (storage.foldername(name))[1] = 'locations'
    AND (
      public.rp_is_admin(auth.uid())
      OR public.rp_is_team_member(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  );

CREATE POLICY "rp_loc_photos_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'rp-submissions'
    AND (storage.foldername(name))[1] = 'locations'
    AND (
      public.rp_is_admin(auth.uid())
      OR public.rp_is_team_member(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  );
