DO $$
DECLARE
  v_team uuid := '302beb31-e8ea-48eb-b420-b1f821eb4e84';
  v_leader uuid := '6d77cb6d-09a0-4188-81e9-6a77f86cf850';
  v_mentor uuid := '361a474b-38a8-405e-9a22-cbf087b0822b';
  v_admin uuid := '8464f94a-3eba-45c1-bbdf-1a1791b32164';
  v_t1 uuid;
  v_t2 uuid;
  v_t3 uuid;
  v_member uuid;
BEGIN
  SELECT profile_id INTO v_member FROM rp_team_members WHERE team_id = v_team AND profile_id IS NOT NULL AND profile_id <> v_leader LIMIT 1;

  -- Thread 1: Leader <-> Mentor
  INSERT INTO rp_mail_threads (subject, created_by, related_team_id, scope, last_message_at, last_message_preview)
  VALUES ('Phase 2 survey checkpoint', v_leader, v_team, 'team_mentor', now() - interval '2 hours', 'Great progress! A few tweaks on methodology…')
  RETURNING id INTO v_t1;
  INSERT INTO rp_mail_participants (thread_id, profile_id, role_in_thread) VALUES
    (v_t1, v_leader, 'team_leader'), (v_t1, v_mentor, 'mentor');
  INSERT INTO rp_mail_messages (thread_id, sender_id, body, sent_at) VALUES
    (v_t1, v_leader, 'Hi mentor, we have drafted the survey questionnaire for the Phase 2 road safety audit. Could you review it before we go to the field this weekend?', now() - interval '2 days'),
    (v_t1, v_mentor, 'Nice work — overall structure is solid. Please add two questions on pedestrian visibility at night and reduce Q7 to a 5-point Likert scale.', now() - interval '1 day 20 hours'),
    (v_t1, v_leader, 'Updated. Sharing the revised copy with the team today.', now() - interval '1 day'),
    (v_t1, v_mentor, 'Great progress! A few tweaks on methodology and you are good to deploy. Aim for at least 50 responses across two junctions.', now() - interval '2 hours');

  -- Thread 2: Admin -> Leader (announcement)
  INSERT INTO rp_mail_threads (subject, created_by, related_team_id, scope, last_message_at, last_message_preview)
  VALUES ('Reminder: Phase 2 submission deadline', v_admin, v_team, 'admin_team', now() - interval '5 hours', 'Please submit the interim report by Friday EOD.')
  RETURNING id INTO v_t2;
  INSERT INTO rp_mail_participants (thread_id, profile_id, role_in_thread) VALUES
    (v_t2, v_admin, 'admin'), (v_t2, v_leader, 'team_leader');
  INSERT INTO rp_mail_messages (thread_id, sender_id, body, sent_at) VALUES
    (v_t2, v_admin, 'Hi team lead, a quick reminder that the Phase 2 interim submission is due this Friday. Please upload the survey plan, audit checklist and any preliminary photos.', now() - interval '1 day'),
    (v_t2, v_leader, 'Noted. We are on track — will submit by Thursday evening.', now() - interval '8 hours'),
    (v_t2, v_admin, 'Please submit the interim report by Friday EOD. Reach out if you need any template help.', now() - interval '5 hours');

  -- Thread 3: Member -> Mentor
  IF v_member IS NOT NULL THEN
    INSERT INTO rp_mail_threads (subject, created_by, related_team_id, scope, last_message_at, last_message_preview)
    VALUES ('Question on IRC audit template', v_member, v_team, 'team_mentor', now() - interval '30 minutes', 'Use section 4.2 of IRC:SP:88 as the reference.')
    RETURNING id INTO v_t3;
    INSERT INTO rp_mail_participants (thread_id, profile_id, role_in_thread) VALUES
      (v_t3, v_member, 'team_member'), (v_t3, v_mentor, 'mentor');
    INSERT INTO rp_mail_messages (thread_id, sender_id, body, sent_at) VALUES
      (v_t3, v_member, 'Hi mentor, which IRC clause should we cite for the shoulder width observation on state highways?', now() - interval '3 hours'),
      (v_t3, v_mentor, 'Use section 4.2 of IRC:SP:88 as the reference. Also mention the desirable vs minimum widths in your report.', now() - interval '30 minutes');
  END IF;
END $$;