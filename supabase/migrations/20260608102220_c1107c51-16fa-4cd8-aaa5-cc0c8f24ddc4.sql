CREATE TABLE public.rp_cron_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hook_name text NOT NULL UNIQUE,
  max_consecutive_failures integer NOT NULL DEFAULT 3,
  max_stale_hours integer NOT NULL DEFAULT 48,
  is_active boolean NOT NULL DEFAULT true,
  last_alert_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_cron_alert_rules TO authenticated;
GRANT ALL ON public.rp_cron_alert_rules TO service_role;

ALTER TABLE public.rp_cron_alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cron alert rules"
  ON public.rp_cron_alert_rules FOR ALL
  USING (public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_admin(auth.uid()));

CREATE TRIGGER trg_rp_cron_alert_rules_updated_at
  BEFORE UPDATE ON public.rp_cron_alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed defaults for existing hooks
INSERT INTO public.rp_cron_alert_rules (hook_name, max_consecutive_failures, max_stale_hours)
VALUES
  ('admin-digest', 2, 192),
  ('meeting-reminders', 3, 1)
ON CONFLICT (hook_name) DO NOTHING;