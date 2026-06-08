## Scope (Priority 1 only)

Auth + roles + admin/team/mentor dashboards + cohorts + teams + phase workflow + submissions + mentor feedback + file uploads + notifications. Authority, finance, evaluator, certificates, payments, leaderboard, knowledge hub, maps — stubs in nav only, built later.

## Route layout

All new routes under `/rakshak-platform/*` so existing Rakshak map, Rakshak Mentor, and Gig Rider remain untouched.

```text
/rakshak-platform                      → public landing
/rakshak-platform/auth                 → login + register (tabs: team / mentor)
/rakshak-platform/dashboard            → role redirector (admin/team/mentor)
/rakshak-platform/_authenticated/...   → all gated pages below
  admin/                               → overview, cohorts, teams, mentors, submissions, audit logs
  admin/cohorts/$id                    → cohort detail + bulk team import
  admin/teams/$id                      → team detail (members, phase progress, submissions, audit)
  team/                                → team dashboard (phase timeline, next action, mentor feedback)
  team/phases/$phaseNumber             → submission form + evidence upload + feedback thread
  mentor/                              → assigned teams, pending reviews queue
  mentor/teams/$id                     → submission review + rubric scoring
  notifications                        → unified notification center
  profile                              → shared profile edit
```

## Design system

Strict adherence to the Crashfree rulebook. Add to `src/styles.css`:
- `--color-brand: #4A35FF`, `--color-brand-lite: #F8F7FF`, `--color-brand-foreground: #FFFFFF`, `--color-danger: #F10015`, `--color-success: #91E88A`
- `@theme inline` mapping → `bg-brand`, `bg-brand-lite`, `text-brand`, `border-border`, etc.
- Fonts: Montserrat (heading) + Geist (body) via `<link>` in `__root.tsx` head, mapped to `--font-heading` / `--font-sans`
- Section rotation `background → brand-lite → brand`, `max-w-7xl px-6 md:px-10 py-24 lg:py-32`, rounded-full buttons, rounded-2xl cards, two-line H2 with `text-brand` second line

Brand name stays "Crashfree India" / "Project Rakshak" (the rulebook's "Cars24" reference is generic — I'll spell our brand as written, no all-caps).

## Database schema (single migration)

New tables under `public.` with prefix `rp_` to avoid colliding with existing `applications`, `observations`, `hotspots`:

- `rp_app_role` enum (`super_admin`, `cfi_admin`, `team_member`, `team_leader`, `mentor`, `evaluator`, `authority`, `finance`, `leadership_viewer`)
- `rp_user_roles` (user_id, role) + `rp_has_role()` security-definer
- `rp_profiles` (id=auth.users.id, full_name, phone, city, state, organization, avatar_url, status)
- `rp_cohorts`
- `rp_teams` (cohort_id, team_name, college, city, state, team_leader_id, current_phase, assigned_mentor_id, status, risk_status, completion_percentage, last_activity_at)
- `rp_team_members` (team_id, profile_id, role_in_team)
- `rp_mentors` (profile_id, expertise, organization, max_teams, rating)
- `rp_phase_templates` (phase_number 0–4, title, description, checklist jsonb, required_deliverables jsonb)
- `rp_team_phase_progress` (team_id, phase_number, status, completion_percentage, deadline, mentor_status, admin_status, revision_count, is_at_risk, at_risk_reason, …)
- `rp_locations` (team_id, phase_number, name, address, city, state, lat, lng, issue_type, severity, is_final_selected)
- `rp_submissions` (team_id, phase_number, title, summary, status, submitted_by, submitted_at, mentor_review_status, admin_review_status, revision_number)
- `rp_submission_files` (submission_id, file_name, file_url, file_type, evidence_type, lat, lng, caption)
- `rp_feedback` (submission_id, reviewer_id, reviewer_role, feedback_text, status, score, rubric_scores jsonb)
- `rp_notifications` (recipient_id, title, message, type, related_entity_type, related_entity_id, action_link, is_read)
- `rp_audit_logs` (actor_id, actor_role, action, entity_type, entity_id, old_value jsonb, new_value jsonb)

Every table: standard `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` + trigger using existing `public.tg_set_updated_at()`, RLS enabled, GRANTs to `authenticated` + `service_role`.

### RLS summary (uses `rp_has_role` security definer to avoid recursion)

- Admins (`cfi_admin`, `super_admin`): full read/write everywhere
- Mentors: read own assigned teams + their submissions/feedback/progress; write feedback only on assigned teams
- Team members: read+write own team only (membership via `rp_team_members`)
- Notifications: recipient only
- Audit logs: admins read; system writes via service role

### Storage

New bucket `rp-submissions` (private). Files signed-URL'd at view time.

## Server functions

`src/lib/rakshak-platform/*.functions.ts` for: submit phase, upload submission file (signed-URL flow), mentor approve/request-changes, admin approve phase, mark team at-risk, create cohort, create team, assign mentor, bulk team import (CSV → JSON), seed demo data. Each uses `requireSupabaseAuth` + role check; admin-elevated writes load `supabaseAdmin` inside the handler.

## Seed data (run once via server fn callable from admin)

2 cohorts (Cohort 1 Jaipur–Delhi 2026, Cohort 2 Bengaluru–Pune 2026), 8 mentors, 20 teams across 8 Indian cities, 50 locations, submissions spread across phases (some draft, submitted, under review, changes requested, approved), some at-risk and completed teams. Realistic issue types from the brief.

## Notifications

In-app only (Priority 1). Realtime subscription on `rp_notifications` filtered by recipient. Bell icon in dashboard header with unread count + dropdown. Created server-side on submit/approve/request-changes/at-risk events.

## Out of scope for this build (stubbed/linked-but-not-built)

Authority dashboard, map heatmap, finance, certificates, payments, evaluator scoring queue, knowledge hub, meeting scheduler, leaderboard, exports, certificate verification, AI report checker, integrations placeholders. Each gets a card on the admin dashboard saying "Coming in Phase 2".

## What you'll see when done

1. New landing page at `/rakshak-platform` with the brand visual language
2. Login + register (team or mentor) at `/rakshak-platform/auth` — your existing admin user (`admin@gmail.com`) auto-mapped to `cfi_admin`
3. Admin dashboard with live counts, teams table, submissions queue, audit log, "Seed Demo Data" button
4. Team dashboard with phase timeline (0→4), next-action card, current-phase checklist, submission form, mentor feedback thread
5. Mentor dashboard with assigned-team queue, submission review + rubric scoring
6. Notifications bell with realtime updates

## Build order

1. Migration (schema + RLS + storage bucket + seed phase templates)
2. Design tokens in `styles.css` + fonts in `__root.tsx`
3. Shared layout/header/nav components + role guard
4. Auth pages + role redirector
5. Server functions
6. Admin → Team → Mentor dashboards (in that order)
7. Seed-data server fn + admin trigger button
8. Notifications + audit logs wiring

This is a 6–8 message build. I'll batch file writes aggressively. Approving this plan tells me to start with the migration.