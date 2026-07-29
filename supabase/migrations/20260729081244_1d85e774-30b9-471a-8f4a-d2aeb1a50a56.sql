DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='rp_teams') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rp_teams;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='rp_evaluations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rp_evaluations;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='rp_team_phase_progress') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rp_team_phase_progress;
  END IF;
END $$;