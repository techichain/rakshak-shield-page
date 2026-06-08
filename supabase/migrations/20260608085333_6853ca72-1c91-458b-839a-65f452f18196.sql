ALTER PUBLICATION supabase_realtime ADD TABLE public.rp_feedback;
ALTER TABLE public.rp_feedback REPLICA IDENTITY FULL;