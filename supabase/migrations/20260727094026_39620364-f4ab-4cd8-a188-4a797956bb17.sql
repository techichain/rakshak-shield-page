DO $$
DECLARE
  t_alpha uuid := '7b1cc163-9c4a-4da4-a7b9-8caaa5768dbe';
  t_beta  uuid := '04b3f018-f923-406e-8fa8-71a1b9c693b8';
  t_gamma uuid := 'fd1a4324-1d13-4bb9-a869-f7b3ed0e867f';
  t_delta uuid := 'ff931e05-0592-4f95-a649-085ade8f9d4c';
  t_eps   uuid := 'aadfb2ab-0547-4425-9470-c48f2b0925c5';
  t_zeta  uuid := '3da3f531-8a51-4d16-ac7a-4405176ebd74';
  s_alpha uuid := '48ff9470-7d7b-4655-94e5-e78b68eac3bf';
  s_gamma uuid := '0a61e5ab-df2d-472a-a723-a922a10c53ee';
  s_delta uuid := '3bf68ed3-bb13-4755-a2b2-b5a811c6e428';
  s_eps   uuid := '57ce63f2-6e52-44d0-bbd5-8f5bbdf25696';
  s_zeta  uuid := 'a8c7b95d-8e5b-4a79-b8b0-e6398f46da03';
  m1 uuid := '80616b08-5aad-4a7d-ab03-a333f9d133a5';
  m2 uuid := 'dc8c31c9-cf81-4bb3-bed3-ed5b2db7c9fc';
  m3 uuid := '6f9023e9-44c8-411b-a5a8-44f26590edea';
  m1p uuid := '361a474b-38a8-405e-9a22-cbf087b0822b';
  m2p uuid := 'c478c9d5-fdea-4aad-933d-2308172c3fd0';
  m3p uuid := 'b65a0f54-19da-46b5-be04-e80d8f58a0f7';
  ev uuid := 'ac43c536-5c49-4a3b-9886-00293e6d4406';
  adm uuid := 'af71151b-a0f7-4a2a-87d6-6b2c1932eafe';
  r_delta uuid; r_eps uuid; r_zeta uuid;
BEGIN
  UPDATE rp_teams SET assigned_mentor_id = m1, completion_percentage = 34, risk_status = 'on_track', last_activity_at = now() - interval '1 day' WHERE id = t_alpha;
  UPDATE rp_teams SET assigned_mentor_id = m1, completion_percentage = 22, risk_status = 'attention', last_activity_at = now() - interval '6 days' WHERE id = t_beta;
  UPDATE rp_teams SET assigned_mentor_id = m2, completion_percentage = 48, risk_status = 'on_track', last_activity_at = now() - interval '2 days' WHERE id = t_gamma;
  UPDATE rp_teams SET assigned_mentor_id = m2, completion_percentage = 61, risk_status = 'attention', last_activity_at = now() - interval '9 days' WHERE id = t_delta;
  UPDATE rp_teams SET assigned_mentor_id = m3, completion_percentage = 88, risk_status = 'on_track', last_activity_at = now() - interval '4 hours' WHERE id = t_eps;
  UPDATE rp_teams SET assigned_mentor_id = m3, completion_percentage = 79, risk_status = 'at_risk',  last_activity_at = now() - interval '16 days' WHERE id = t_zeta;

  UPDATE rp_mentors SET current_team_count = 2 WHERE id IN (m1, m2, m3);

  INSERT INTO rp_team_members (team_id, full_name, email, phone, college, department, year, role_in_team) VALUES
    (t_alpha,'DEMO — Aarav Sharma','demo.aarav@example.com','+91 98100 00001','IIT Delhi','Civil Engineering',3,'leader'),
    (t_alpha,'DEMO — Ishita Rao','demo.ishita@example.com','+91 98100 00002','IIT Delhi','Civil Engineering',2,'member'),
    (t_alpha,'DEMO — Kabir Nair','demo.kabir@example.com','+91 98100 00003','IIT Delhi','Design',3,'member'),
    (t_beta,'DEMO — Meera Joshi','demo.meera@example.com','+91 98200 00001','IIT Bombay','Urban Planning',4,'leader'),
    (t_beta,'DEMO — Rohan Patil','demo.rohan@example.com','+91 98200 00002','IIT Bombay','Mechanical',2,'member'),
    (t_gamma,'DEMO — Ananya Menon','demo.ananya@example.com','+91 94400 00001','NIT Calicut','Civil Engineering',3,'leader'),
    (t_gamma,'DEMO — Devika Pillai','demo.devika@example.com','+91 94400 00002','NIT Calicut','Computer Science',3,'member'),
    (t_delta,'DEMO — Yash Chauhan','demo.yash@example.com','+91 98110 00001','Delhi Technological University','Transportation',4,'leader'),
    (t_delta,'DEMO — Sara Khan','demo.sara@example.com','+91 98110 00002','Delhi Technological University','Civil Engineering',3,'member'),
    (t_eps,'DEMO — Harsh Mehta','demo.harsh@example.com','+91 99790 00001','SVNIT Surat','Civil Engineering',4,'leader'),
    (t_eps,'DEMO — Priya Desai','demo.priya@example.com','+91 99790 00002','SVNIT Surat','Environmental',3,'member'),
    (t_zeta,'DEMO — Vikram Iyer','demo.vikram@example.com','+91 90000 00001','IIT Madras','Civil Engineering',4,'leader'),
    (t_zeta,'DEMO — Nithya Balan','demo.nithya@example.com','+91 90000 00002','IIT Madras','Data Science',2,'member');

  INSERT INTO rp_locations (team_id, phase_number, location_name, address, city, state, latitude, longitude, issue_type, severity, description, is_final_selected, authority_jurisdiction) VALUES
    (t_alpha,1,'DEMO — Munirka Bus Stop Crossing','Outer Ring Road, Munirka','Delhi','Delhi',28.5539,77.1706,'Unsafe pedestrian crossing','high','No signalised crossing; commuters cross six lanes on foot at peak hours.',true,'PWD Delhi'),
    (t_alpha,1,'DEMO — IIT Gate No. 2 Service Lane','Hauz Khas','Delhi','Delhi',28.5450,77.1926,'Poor street lighting','medium','Service lane unlit after 8pm, heavy two-wheeler traffic.',false,'MCD'),
    (t_beta,1,'DEMO — Powai Lake Road Bend','Powai','Mumbai','Maharashtra',19.1276,72.9060,'Blind curve without signage','high','Sharp bend with no chevron markings or speed calming.',true,'BMC'),
    (t_gamma,2,'DEMO — NIT Calicut Main Gate','NIT Campus Road','Kozhikode','Kerala',11.3210,75.9340,'Missing footpath','high','Students walk on carriageway; no footpath for 400m.',true,'Kozhikode Corporation'),
    (t_gamma,2,'DEMO — Chathamangalam Junction','NH-766','Kozhikode','Kerala',11.3078,75.9370,'Unregulated junction','critical','Four-arm junction with no signal, frequent near-misses.',true,'NHAI'),
    (t_delta,3,'DEMO — Rohini Sector 17 Crossing','Sector 17, Rohini','Delhi','Delhi',28.7365,77.1189,'Faded zebra crossing','medium','Markings worn out; school children cross here daily.',true,'MCD'),
    (t_eps,4,'DEMO — Athwalines Circle','Athwalines','Surat','Gujarat',21.1780,72.8090,'Encroached footpath','high','Vendors occupy the entire footpath forcing pedestrians onto the road.',true,'Surat Municipal Corporation'),
    (t_zeta,4,'DEMO — Guindy Flyover Underpass','Guindy','Chennai','Tamil Nadu',13.0067,80.2206,'Unsafe pedestrian underpass','high','Underpass unlit and flooded; pedestrians climb the median instead.',true,'Greater Chennai Corporation');

  INSERT INTO rp_meetings (team_id, mentor_id, created_by, title, agenda, scheduled_start, scheduled_end, meeting_link, status, meeting_type, notes, host_type, host_user_id) VALUES
    (t_alpha,m1,m1p,'DEMO — Phase 1 kick-off review','Walk through shortlisted audit locations and data collection plan.', now() + interval '4 hours', now() + interval '5 hours','https://meet.google.com/demo-alpha-001','confirmed','team_mentor',NULL,'mentor',m1p),
    (t_beta,m1,m1p,'DEMO — Baseline survey check-in','Review survey instrument and sampling approach.', now() + interval '2 days 3 hours', now() + interval '2 days 4 hours','https://meet.google.com/demo-beta-002','confirmed','team_mentor',NULL,'mentor',m1p),
    (t_gamma,m2,m2p,'DEMO — Phase 2 evidence walkthrough','Photo evidence quality and geotagging review.', now() + interval '1 day 2 hours', now() + interval '1 day 3 hours','https://meet.google.com/demo-gamma-003','confirmed','team_mentor',NULL,'mentor',m2p),
    (t_delta,m2,m2p,'DEMO — Draft report feedback','Structure of the authority submission draft.', now() - interval '6 days', now() - interval '6 days' + interval '1 hour','https://meet.google.com/demo-delta-004','completed','team_mentor','DEMO — Team presented a solid draft. Actions: tighten the executive summary to one page, add before/after photographs for the Rohini crossing, and cite the IRC 103 pedestrian guideline in section 4. Next review in two weeks.','mentor',m2p),
    (t_eps,m3,m3p,'DEMO — Authority follow-up prep','Prepare talking points for the municipal meeting.', now() + interval '5 days', now() + interval '5 days' + interval '45 minutes','https://meet.google.com/demo-eps-005','confirmed','team_mentor',NULL,'mentor',m3p),
    (t_zeta,m3,m3p,'DEMO — Phase 4 retrospective','What worked, what stalled, and the plan to recover timeline.', now() - interval '12 days', now() - interval '12 days' + interval '1 hour','https://meet.google.com/demo-zeta-006','completed','team_mentor','DEMO — Team is behind on the authority submission. Agreed to split the report into two workstreams and re-check on the 15th.','mentor',m3p);

  INSERT INTO rp_evidence_records (team_id, phase_number, record_type, title, reference_no, filed_on, authority, status, description, created_by) VALUES
    (t_delta,3,'rti','DEMO — RTI on Rohini crossing maintenance','RTI/2026/DL/0142', current_date - 34,'Municipal Corporation of Delhi','responded','Sought last maintenance date and budget allocation for pedestrian markings in Sector 17.',adm),
    (t_delta,3,'police_complaint','DEMO — Complaint: faded zebra crossing','CMP/2026/DL/0891', current_date - 20,'MCD Road Cell','acknowledged','Complaint filed with photographs and location coordinates.',adm),
    (t_eps,4,'other','DEMO — Representation to Surat Municipal Commissioner','REP/2026/GJ/0033', current_date - 12,'Surat Municipal Corporation','filed','Requested footpath de-encroachment drive at Athwalines Circle.',adm),
    (t_zeta,4,'rti','DEMO — RTI on Guindy underpass drainage','RTI/2026/TN/0207', current_date - 45,'Greater Chennai Corporation','filed','Asked for drainage maintenance schedule and complaint history.',adm),
    (t_gamma,2,'media_report','DEMO — Local daily covers Chathamangalam junction','MED/2026/KL/0455', current_date - 8,'NHAI Regional Office','acknowledged','Regional newspaper carried the team''s junction safety findings.',adm);

  INSERT INTO rp_authority_reports (team_id, authority_name, authority_category, contact_person, contact_email, subject, message, status, sent_at, response_status, implementation_status, created_by)
  VALUES (t_delta,'Municipal Corporation of Delhi','municipal','DEMO — Exec. Engineer (Roads)','demo.mcd@example.com','DEMO — Restoration of Sector 17 pedestrian crossing','Submitting audit findings and requesting re-marking of the zebra crossing at Rohini Sector 17.','sent', now() - interval '25 days','responded','in_progress',adm)
  RETURNING id INTO r_delta;

  INSERT INTO rp_authority_reports (team_id, authority_name, authority_category, contact_person, contact_email, subject, message, status, sent_at, response_status, implementation_status, created_by)
  VALUES (t_eps,'Surat Municipal Corporation','municipal','DEMO — Deputy Commissioner','demo.smc@example.com','DEMO — Footpath de-encroachment at Athwalines Circle','Sharing photographic evidence of footpath encroachment and requesting a joint site visit.','sent', now() - interval '12 days','acknowledged','not_started',adm)
  RETURNING id INTO r_eps;

  INSERT INTO rp_authority_reports (team_id, authority_name, authority_category, contact_person, contact_email, subject, message, status, sent_at, response_status, implementation_status, created_by)
  VALUES (t_zeta,'Greater Chennai Corporation','municipal','DEMO — Zonal Officer','demo.gcc@example.com','DEMO — Guindy underpass lighting and drainage','Requesting urgent lighting and drainage repair at the Guindy flyover underpass.','sent', now() - interval '45 days','pending','not_started',adm)
  RETURNING id INTO r_zeta;

  INSERT INTO rp_authority_updates (report_id, team_id, update_text, status, created_by) VALUES
    (r_delta,t_delta,'DEMO — MCD Road Cell responded confirming that re-marking of the Sector 17 zebra crossing is scheduled in the current quarter''s maintenance cycle.','responded',adm),
    (r_eps,t_eps,'DEMO — Surat Municipal Corporation acknowledged the representation and has asked the team to join a joint site visit next month.','acknowledged',adm),
    (r_zeta,t_zeta,'DEMO — No response received within the statutory window; first appeal being prepared.','pending',adm);

  INSERT INTO rp_team_updates (team_id, update_type, title, details, start_date, end_date, created_by) VALUES
    (t_alpha,'exam_schedule','DEMO — Mid-semester examinations','Team availability will be limited; no site visits during this window.', current_date + 9, current_date + 16, adm),
    (t_gamma,'availability','DEMO — Field week planned','Team is on site all week for photo and video documentation.', current_date + 3, current_date + 8, adm),
    (t_zeta,'note','DEMO — Awaiting campus travel approval','Institute approval for the Guindy site visit is still pending.', current_date - 5, current_date + 5, adm);

  INSERT INTO rp_feedback (submission_id, team_id, phase_number, reviewer_id, reviewer_role, feedback_text, status, score) VALUES
    (s_alpha,t_alpha,1,m1p,'mentor','DEMO — Good location shortlist. Please add pedestrian volume counts for the Munirka crossing before submitting the final version.','open',7.5),
    (s_gamma,t_gamma,2,m2p,'mentor','DEMO — Evidence quality is strong. Geotag two more photographs at the junction and you are ready for review.','resolved',8.4),
    (s_delta,t_delta,3,ev,'evaluator','DEMO — Report is well structured but the recommendations section needs costing estimates.','open',7.0),
    (s_eps,t_eps,4,ev,'evaluator','DEMO — Excellent authority engagement trail. One of the strongest submissions this phase.','resolved',9.1),
    (s_zeta,t_zeta,4,m3p,'mentor','DEMO — Timeline slipping. Please submit the draft authority letter this week.','open',6.2);

  INSERT INTO rp_certificates (team_id, certificate_type, phase_number, serial_no, public_slug, title, recipient_name, issued_at, issued_by) VALUES
    (t_eps,'phase_completion',4,'DEMO-CERT-2026-0001','demo-cert-2026-0001','DEMO — Phase 4 Completion Certificate','DEMO — Team Epsilon', now() - interval '3 days', adm),
    (t_zeta,'participation',3,'DEMO-CERT-2026-0002','demo-cert-2026-0002','DEMO — Participation Certificate','DEMO — Team Zeta', now() - interval '20 days', adm);
END $$;