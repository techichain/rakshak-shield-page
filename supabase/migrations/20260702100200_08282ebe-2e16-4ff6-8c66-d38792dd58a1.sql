ALTER TABLE public.rp_meetings
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_organizer_user_id uuid;