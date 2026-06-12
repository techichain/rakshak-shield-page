CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  IF NEW.email LIKE '%@gigrider.local' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'observer')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END
$function$;

DELETE FROM public.user_roles ur
USING auth.users u
WHERE ur.user_id = u.id
  AND ur.role = 'observer'
  AND u.email NOT LIKE '%@gigrider.local';