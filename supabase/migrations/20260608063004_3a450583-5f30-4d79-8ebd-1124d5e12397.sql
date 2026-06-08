
-- =========================
-- CERTIFICATES
-- =========================
CREATE TABLE public.rp_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.rp_teams(id) ON DELETE CASCADE,
  member_profile_id uuid REFERENCES public.rp_profiles(id) ON DELETE SET NULL,
  certificate_type text NOT NULL CHECK (certificate_type IN ('participation','phase_completion','programme_completion','excellence')),
  phase_number integer,
  serial_no text NOT NULL UNIQUE,
  public_slug text NOT NULL UNIQUE,
  title text NOT NULL,
  recipient_name text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pdf_url text,
  is_revoked boolean NOT NULL DEFAULT false,
  revoked_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rp_certificates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_certificates TO authenticated;
GRANT ALL ON public.rp_certificates TO service_role;
ALTER TABLE public.rp_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_cert_public_read" ON public.rp_certificates
  FOR SELECT TO anon, authenticated USING (is_revoked = false);
CREATE POLICY "rp_cert_admin_all" ON public.rp_certificates
  FOR ALL TO authenticated
  USING (public.rp_is_admin(auth.uid()))
  WITH CHECK (public.rp_is_admin(auth.uid()));

CREATE TRIGGER rp_certificates_set_updated_at
  BEFORE UPDATE ON public.rp_certificates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX rp_cert_team_idx ON public.rp_certificates(team_id);
CREATE INDEX rp_cert_slug_idx ON public.rp_certificates(public_slug);

-- =========================
-- FINANCE ENTRIES
-- =========================
CREATE TABLE public.rp_finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid REFERENCES public.rp_cohorts(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.rp_teams(id) ON DELETE SET NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('expense','grant','sponsorship','donation','reimbursement','other')),
  category text NOT NULL,
  amount_inr numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  description text NOT NULL DEFAULT '',
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  receipt_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_finance_entries TO authenticated;
GRANT ALL ON public.rp_finance_entries TO service_role;
ALTER TABLE public.rp_finance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_fin_admin_finance_all" ON public.rp_finance_entries
  FOR ALL TO authenticated
  USING (
    public.rp_is_admin(auth.uid())
    OR public.rp_has_role(auth.uid(), 'finance'::rp_app_role)
  )
  WITH CHECK (
    public.rp_is_admin(auth.uid())
    OR public.rp_has_role(auth.uid(), 'finance'::rp_app_role)
  );

CREATE TRIGGER rp_finance_set_updated_at
  BEFORE UPDATE ON public.rp_finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX rp_fin_cohort_idx ON public.rp_finance_entries(cohort_id);
CREATE INDEX rp_fin_team_idx   ON public.rp_finance_entries(team_id);
CREATE INDEX rp_fin_occurred_idx ON public.rp_finance_entries(occurred_on DESC);

-- =========================
-- SPONSORSHIPS
-- =========================
CREATE TABLE public.rp_sponsorships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_name text NOT NULL,
  sponsor_email text,
  sponsor_org  text,
  sponsor_logo_url text,
  message text,
  tier text NOT NULL CHECK (tier IN ('friend','bronze','silver','gold','platinum')),
  amount_inr numeric(14,2) NOT NULL CHECK (amount_inr >= 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','failed','cancelled')),
  payment_provider text,
  provider_reference text,
  paid_at timestamptz,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rp_sponsorships TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_sponsorships TO authenticated;
GRANT INSERT ON public.rp_sponsorships TO anon;
GRANT ALL ON public.rp_sponsorships TO service_role;
ALTER TABLE public.rp_sponsorships ENABLE ROW LEVEL SECURITY;

-- Public can read paid + public sponsorships (sponsor wall)
CREATE POLICY "rp_sponsor_public_read" ON public.rp_sponsorships
  FOR SELECT TO anon, authenticated
  USING (is_public = true AND status = 'paid');

-- Anyone can create a pledge (status will be pending; payment confirmation flips to paid via admin/server)
CREATE POLICY "rp_sponsor_public_insert" ON public.rp_sponsorships
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending');

-- Admins / finance manage
CREATE POLICY "rp_sponsor_admin_finance_all" ON public.rp_sponsorships
  FOR ALL TO authenticated
  USING (
    public.rp_is_admin(auth.uid())
    OR public.rp_has_role(auth.uid(), 'finance'::rp_app_role)
  )
  WITH CHECK (
    public.rp_is_admin(auth.uid())
    OR public.rp_has_role(auth.uid(), 'finance'::rp_app_role)
  );

CREATE TRIGGER rp_sponsorships_set_updated_at
  BEFORE UPDATE ON public.rp_sponsorships
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX rp_sponsor_status_idx ON public.rp_sponsorships(status);
CREATE INDEX rp_sponsor_tier_idx   ON public.rp_sponsorships(tier);
