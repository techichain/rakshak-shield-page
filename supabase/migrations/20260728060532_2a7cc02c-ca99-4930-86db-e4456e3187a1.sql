ALTER TABLE public.rp_profiles
  ADD COLUMN blood_group text CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  ADD COLUMN address text,
  ADD COLUMN college text,
  ADD COLUMN bank_account_name text,
  ADD COLUMN bank_account_number text,
  ADD COLUMN bank_ifsc text,
  ADD COLUMN bank_branch text,
  ADD COLUMN cancelled_cheque_path text,
  ADD COLUMN profile_completed_at timestamptz;

-- Tighten raw-table read: self + admin only (was: also anyone sharing a team).
DROP POLICY IF EXISTS "rp_profiles_scoped_read" ON public.rp_profiles;
CREATE POLICY "rp_profiles_self_admin_read"
  ON public.rp_profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.rp_is_admin(auth.uid()));

-- Bank-free projection for teammates/mentors/evaluators.
CREATE OR REPLACE VIEW public.rp_profiles_public
WITH (security_invoker = off) AS
  SELECT id, full_name, email, phone, city, state, organization, college, blood_group, address,
         avatar_url, status, created_at, updated_at, jurisdiction_states, timezone, login_id,
         profile_completed_at
  FROM public.rp_profiles
  WHERE id = auth.uid()
     OR public.rp_is_admin(auth.uid())
     OR public.rp_shares_team(auth.uid(), id);

GRANT SELECT ON public.rp_profiles_public TO authenticated;

-- Cancelled cheque / profile files: owner + admin only, path `<user_id>/profile/...`
CREATE POLICY "rp_profile_files_owner_rw"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'rp-submissions'
    AND (storage.foldername(name))[2] = 'profile'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.rp_is_admin(auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'rp-submissions'
    AND (storage.foldername(name))[2] = 'profile'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.rp_is_admin(auth.uid()))
  );