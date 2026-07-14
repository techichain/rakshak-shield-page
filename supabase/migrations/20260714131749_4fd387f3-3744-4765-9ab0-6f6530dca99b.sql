
UPDATE public.rp_teams
   SET team_leader_id = 'b2ab5b22-2643-4909-94a2-a8147dfa02a1',
       assigned_mentor_id = 'dc8c31c9-cf81-4bb3-bed3-ed5b2db7c9fc',
       updated_at = now()
 WHERE id = 'd8d63f61-3158-4fe6-92c3-2e113a247f24';

INSERT INTO public.rp_team_members (team_id, profile_id, email, full_name)
VALUES ('d8d63f61-3158-4fe6-92c3-2e113a247f24',
        '8b29ab5e-85a8-4f38-8bf5-14c0320374c4',
        'test.member@rakshaktest.local',
        'TEST Team Member')
ON CONFLICT DO NOTHING;
