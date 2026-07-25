ALTER TABLE public.rp_meetings
  ADD COLUMN host_type text NOT NULL DEFAULT 'mentor' CHECK (host_type IN ('mentor','admin')),
  ADD COLUMN host_user_id uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.rp_mentor_slots
  ADD COLUMN host_type text NOT NULL DEFAULT 'mentor' CHECK (host_type IN ('mentor','admin')),
  ADD COLUMN host_user_id uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL;

-- admin-hosted slots have no mentor
ALTER TABLE public.rp_mentor_slots ALTER COLUMN mentor_id DROP NOT NULL;

-- additive policy: admins may publish admin-hosted slots (existing mentor policies untouched)
CREATE POLICY "rp_slots_admin_write" ON public.rp_mentor_slots
  FOR INSERT TO authenticated
  WITH CHECK (rp_is_admin(auth.uid()) AND host_type = 'admin' AND mentor_id IS NULL);

CREATE TABLE public.rp_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('admin_meeting','expert_session')),
  cohort_id uuid REFERENCES public.rp_cohorts(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  host_name text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  meeting_link text,
  created_by uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_announcements TO authenticated;
GRANT ALL ON public.rp_announcements TO service_role;

ALTER TABLE public.rp_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_ann_admin_manage" ON public.rp_announcements
  FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_admin(auth.uid()));

CREATE POLICY "rp_ann_read_all" ON public.rp_announcements
  FOR SELECT TO authenticated
  USING (true);

CREATE INDEX rp_announcements_start_idx ON public.rp_announcements (scheduled_start DESC);