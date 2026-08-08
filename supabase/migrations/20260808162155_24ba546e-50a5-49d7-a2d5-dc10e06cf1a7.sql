DO $$
DECLARE v_team uuid; v_member uuid;
BEGIN
  SELECT id INTO v_team FROM public.rp_teams WHERE team_name = 'TEST Team (QA)' LIMIT 1;
  SELECT id INTO v_member FROM public.rp_profiles WHERE login_id = 'test.member@cfi';
  IF v_team IS NOT NULL AND v_member IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.rp_team_members WHERE team_id=v_team AND profile_id=v_member) THEN
    INSERT INTO public.rp_team_members (team_id, profile_id, email, full_name)
    VALUES (v_team, v_member, 'test.member@rakshaktest.local', 'TEST Team Member');
  END IF;
END $$;