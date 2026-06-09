
-- Create admin user directly in auth.users with bcrypt password
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@gmail.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id, 'authenticated', 'authenticated', 'admin@gmail.com',
      crypt(encode(gen_random_bytes(24), 'hex'), gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Admin","username":"admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    INSERT INTO public.profiles (id, name, username)
    VALUES (new_user_id, 'Admin', 'admin')
    ON CONFLICT (id) DO NOTHING;

    -- Replace default observer role with admin
    DELETE FROM public.user_roles WHERE user_id = new_user_id;
    INSERT INTO public.user_roles (user_id, role) VALUES (new_user_id, 'admin');
  ELSE
    -- Ensure existing user has admin role
    UPDATE public.user_roles SET role = 'admin'
    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@gmail.com');
  END IF;
END $$;
