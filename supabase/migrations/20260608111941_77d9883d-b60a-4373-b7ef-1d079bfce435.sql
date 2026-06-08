-- Tighten public-read policies that exposed PII via PostgREST.
-- Public-facing reads continue to work through server functions that use
-- supabaseAdmin with explicit safe-column projection.

-- 1. Certificates: drop broad public SELECT. Public verification by slug
--    is handled by the verifyCertificate server fn (supabaseAdmin).
DROP POLICY IF EXISTS rp_cert_public_read ON public.rp_certificates;

-- Team members, the team mentor, and admins can read their team's certificates.
CREATE POLICY rp_cert_team_read ON public.rp_certificates
  FOR SELECT
  TO authenticated
  USING (
    rp_is_admin(auth.uid())
    OR rp_is_team_member(team_id, auth.uid())
    OR rp_is_team_mentor(team_id, auth.uid())
    OR member_profile_id = auth.uid()
  );

-- 2. Sponsorships: drop anonymous public SELECT. The public sponsor wall
--    uses listPublicSponsors (supabaseAdmin) with a safe column projection.
DROP POLICY IF EXISTS rp_sponsor_public_read ON public.rp_sponsorships;

-- Revoke direct anon SELECT on the table; PostgREST will deny anon reads.
REVOKE SELECT ON public.rp_sponsorships FROM anon;