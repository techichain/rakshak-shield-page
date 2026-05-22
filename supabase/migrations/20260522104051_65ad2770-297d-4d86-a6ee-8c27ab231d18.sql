ALTER TABLE public.observations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.observations;