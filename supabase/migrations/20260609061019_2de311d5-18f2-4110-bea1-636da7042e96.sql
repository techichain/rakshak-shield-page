-- Honeypot columns for public submission forms.
-- A hidden HTML input maps to this column. Real users leave it empty / unset.
-- Bots that auto-fill all visible fields populate it and are rejected by Postgres.

ALTER TABLE public.rp_sponsorships
  ADD COLUMN IF NOT EXISTS hp_field text;

ALTER TABLE public.rp_sponsorships
  DROP CONSTRAINT IF EXISTS rp_sponsorships_hp_empty_chk;
ALTER TABLE public.rp_sponsorships
  ADD CONSTRAINT rp_sponsorships_hp_empty_chk
  CHECK (hp_field IS NULL OR hp_field = '');

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS hp_field text;

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_hp_empty_chk;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_hp_empty_chk
  CHECK (hp_field IS NULL OR hp_field = '');

-- Tighten the existing anon INSERT policy on applications to also enforce
-- the honeypot at the RLS layer (defense in depth, in case the column is ever dropped).
DROP POLICY IF EXISTS applications_public_insert ON public.applications;
CREATE POLICY applications_public_insert
  ON public.applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'submitted'::application_status
    AND internal_score IS NULL
    AND decision_notes IS NULL
    AND assigned_reviewer_id IS NULL
    AND (hp_field IS NULL OR hp_field = '')
  );