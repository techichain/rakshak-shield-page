ALTER TABLE public.rp_profiles ADD COLUMN IF NOT EXISTS login_id text UNIQUE;
CREATE INDEX IF NOT EXISTS rp_profiles_login_id_idx ON public.rp_profiles (login_id) WHERE login_id IS NOT NULL;