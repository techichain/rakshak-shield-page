CREATE TABLE public.rp_email_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  role text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rp_email_otps_email_idx ON public.rp_email_otps (email, created_at DESC);
GRANT ALL ON public.rp_email_otps TO service_role;
ALTER TABLE public.rp_email_otps ENABLE ROW LEVEL SECURITY;
-- No public policies: only service_role (server functions) touches this table.