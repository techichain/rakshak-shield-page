
CREATE OR REPLACE FUNCTION public.rp_public_team_locations(_team_id uuid)
RETURNS TABLE (id uuid, location_name text, city text, state text, issue_type text, severity text, latitude numeric, longitude numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, location_name, city, state, issue_type, severity, latitude, longitude
  FROM public.rp_locations
  WHERE team_id = _team_id
  ORDER BY created_at DESC
  LIMIT 20
$$;
GRANT EXECUTE ON FUNCTION public.rp_public_team_locations(uuid) TO anon, authenticated;
