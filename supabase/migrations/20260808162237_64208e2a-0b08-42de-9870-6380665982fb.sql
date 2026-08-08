DO $$
DECLARE v_uid uuid := 'b2ab5b22-2643-4909-94a2-a8147dfa02a1';
        v_cohort uuid; v_team uuid; v_mentor uuid; v_member uuid;
BEGIN
  INSERT INTO public.rp_profiles (id, full_name, email, login_id)
  VALUES (v_uid, 'TEST Team Leader', 'test.leader@rakshaktest.local', 'test.leader@cfi')
  ON CONFLICT (id) DO UPDATE SET login_id='test.leader@cfi', full_name='TEST Team Leader';

  INSERT INTO public.rp_user_roles (user_id, role) VALUES (v_uid, 'team_leader') ON CONFLICT DO NOTHING;

  SELECT id INTO v_cohort FROM public.rp_cohorts ORDER BY created_at LIMIT 1;
  IF v_cohort IS NULL THEN
    INSERT INTO public.rp_cohorts (name) VALUES ('Test Cohort') RETURNING id INTO v_cohort;
  END IF;

  SELECT m.id INTO v_mentor FROM public.rp_mentors m
    JOIN public.rp_profiles p ON p.id=m.profile_id WHERE p.login_id='test.mentor@cfi' LIMIT 1;

  SELECT id INTO v_team FROM public.rp_teams WHERE team_name='TEST Team (QA)' LIMIT 1;
  IF v_team IS NULL THEN
    INSERT INTO public.rp_teams (cohort_id, team_name, college, city, state, team_leader_id, assigned_mentor_id, status)
    VALUES (v_cohort,'TEST Team (QA)','Test College','Delhi','Delhi',v_uid,v_mentor,'active')
    RETURNING id INTO v_team;
  ELSE
    UPDATE public.rp_teams SET team_leader_id=v_uid, assigned_mentor_id=COALESCE(assigned_mentor_id,v_mentor), status='active' WHERE id=v_team;
  END IF;

  SELECT id INTO v_member FROM public.rp_profiles WHERE login_id='test.member@cfi';
  IF v_member IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.rp_team_members WHERE team_id=v_team AND profile_id=v_member) THEN
    INSERT INTO public.rp_team_members (team_id, profile_id, email, full_name)
    VALUES (v_team, v_member, 'test.member@rakshaktest.local', 'TEST Team Member');
  END IF;
END $$;