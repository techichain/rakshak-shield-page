
CREATE TABLE public.rp_email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  subject_override text,
  audience jsonb NOT NULL,
  merge_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sending','sent','failed')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_email_campaigns TO authenticated;
GRANT ALL ON public.rp_email_campaigns TO service_role;

ALTER TABLE public.rp_email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view campaigns"
  ON public.rp_email_campaigns FOR SELECT TO authenticated
  USING (public.rp_is_admin(auth.uid()));

CREATE POLICY "Admins can insert campaigns"
  ON public.rp_email_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.rp_is_admin(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Admins can update campaigns"
  ON public.rp_email_campaigns FOR UPDATE TO authenticated
  USING (public.rp_is_admin(auth.uid()));

CREATE POLICY "Admins can delete campaigns"
  ON public.rp_email_campaigns FOR DELETE TO authenticated
  USING (public.rp_is_admin(auth.uid()));

CREATE TRIGGER rp_email_campaigns_updated_at
  BEFORE UPDATE ON public.rp_email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX rp_email_campaigns_created_by_idx ON public.rp_email_campaigns (created_by, created_at DESC);
CREATE INDEX rp_email_campaigns_status_idx ON public.rp_email_campaigns (status, created_at DESC);
