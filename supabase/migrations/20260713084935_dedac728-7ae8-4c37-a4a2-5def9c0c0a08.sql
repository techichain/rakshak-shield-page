-- Single-row settings table for admin-configurable analytics filters
CREATE TABLE public.rp_analytics_settings (
  id integer PRIMARY KEY DEFAULT 1,
  hazard_states text[] NULL,
  hazard_severities text[] NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  CONSTRAINT rp_analytics_settings_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.rp_analytics_settings TO authenticated;
GRANT ALL ON public.rp_analytics_settings TO service_role;

ALTER TABLE public.rp_analytics_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read analytics settings"
  ON public.rp_analytics_settings
  FOR SELECT
  TO authenticated
  USING (public.rp_is_admin(auth.uid()));

CREATE POLICY "Admins can insert analytics settings"
  ON public.rp_analytics_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.rp_is_admin(auth.uid()));

CREATE POLICY "Admins can update analytics settings"
  ON public.rp_analytics_settings
  FOR UPDATE
  TO authenticated
  USING (public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_admin(auth.uid()));

-- Seed the singleton row (unset filters = show all)
INSERT INTO public.rp_analytics_settings (id, hazard_states, hazard_severities)
VALUES (1, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
