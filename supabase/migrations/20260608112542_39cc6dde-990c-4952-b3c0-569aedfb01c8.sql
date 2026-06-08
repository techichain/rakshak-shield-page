-- Drop the broad ALL policy and replace with explicit per-operation policies on rp_cron_alert_rules
DROP POLICY IF EXISTS "Admins can manage cron alert rules" ON public.rp_cron_alert_rules;

CREATE POLICY "Admins can select cron alert rules"
  ON public.rp_cron_alert_rules
  FOR SELECT
  TO authenticated
  USING (rp_is_admin(auth.uid()));

CREATE POLICY "Admins can insert cron alert rules"
  ON public.rp_cron_alert_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (rp_is_admin(auth.uid()));

CREATE POLICY "Admins can update cron alert rules"
  ON public.rp_cron_alert_rules
  FOR UPDATE
  TO authenticated
  USING (rp_is_admin(auth.uid()))
  WITH CHECK (rp_is_admin(auth.uid()));

CREATE POLICY "Admins can delete cron alert rules"
  ON public.rp_cron_alert_rules
  FOR DELETE
  TO authenticated
  USING (rp_is_admin(auth.uid()));