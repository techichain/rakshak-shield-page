-- ============ Cron monitoring ============
CREATE TABLE IF NOT EXISTS public.rp_cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hook_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok','error','unauthorized')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  http_status integer,
  notes jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rp_cron_runs_hook_idx ON public.rp_cron_runs(hook_name, started_at DESC);

GRANT SELECT ON public.rp_cron_runs TO authenticated;
GRANT ALL ON public.rp_cron_runs TO service_role;

ALTER TABLE public.rp_cron_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_cron_runs_admin_read"
  ON public.rp_cron_runs FOR SELECT TO authenticated
  USING (public.rp_is_admin(auth.uid()));

-- ============ Mentor bookable slots ============
CREATE TABLE IF NOT EXISTS public.rp_mentor_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES public.rp_mentors(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 20),
  booked_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','full','cancelled','past')),
  notes text,
  created_by uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rp_mentor_slots_mentor_idx ON public.rp_mentor_slots(mentor_id, starts_at);
CREATE INDEX IF NOT EXISTS rp_mentor_slots_open_idx ON public.rp_mentor_slots(status, starts_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_mentor_slots TO authenticated;
GRANT ALL ON public.rp_mentor_slots TO service_role;

ALTER TABLE public.rp_mentor_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_slots_read_all_signed_in"
  ON public.rp_mentor_slots FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "rp_slots_mentor_write"
  ON public.rp_mentor_slots FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rp_mentors m
      WHERE m.id = mentor_id AND m.profile_id = auth.uid()
    )
  );

CREATE POLICY "rp_slots_mentor_update"
  ON public.rp_mentor_slots FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rp_mentors m
      WHERE m.id = mentor_id AND m.profile_id = auth.uid()
    ) OR public.rp_is_admin(auth.uid())
  );

CREATE POLICY "rp_slots_mentor_delete"
  ON public.rp_mentor_slots FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rp_mentors m
      WHERE m.id = mentor_id AND m.profile_id = auth.uid()
    ) OR public.rp_is_admin(auth.uid())
  );

CREATE TRIGGER rp_slots_set_updated_at
  BEFORE UPDATE ON public.rp_mentor_slots
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ Extend rp_meetings for sessions ============
ALTER TABLE public.rp_meetings
  ADD COLUMN IF NOT EXISTS video_room_id text,
  ADD COLUMN IF NOT EXISTS whiteboard_room_id text,
  ADD COLUMN IF NOT EXISTS slot_id uuid REFERENCES public.rp_mentor_slots(id) ON DELETE SET NULL;