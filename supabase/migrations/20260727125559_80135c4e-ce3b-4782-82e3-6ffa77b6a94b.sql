CREATE OR REPLACE FUNCTION public.rp_existing_auth_emails(_emails text[])
RETURNS TABLE(email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.rp_is_admin(auth.uid()) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT lower(u.email::text)
  FROM auth.users u
  WHERE lower(u.email::text) = ANY (SELECT lower(e) FROM unnest(_emails) AS e);
END;
$$;

REVOKE ALL ON FUNCTION public.rp_existing_auth_emails(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rp_existing_auth_emails(text[]) TO authenticated, service_role;