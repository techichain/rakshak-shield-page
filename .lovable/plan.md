
# Admin dashboard v2 + mass email composer

Scope is large. I'll ship it in 4 phases so you can review after each, not in one giant push. Everything is admin-only, RLS-gated, and built for 500+ users.

## Phase 1 — Navigation & landing (UI/UX foundation)

**Sidebar restructure** — replace the tile grid + top tabs + quick-access with one persistent `shadcn Sidebar` (`collapsible="icon"`), grouped:
- **Operate**: Teams, Reviews, Meetings, Inbox
- **People**: Roles & assignments, Mentor applications, Team members
- **Programme**: Cohorts, Certificates, Leaderboard, Impact
- **Communications**: Compose email, Email log
- **Data**: Analytics, Exports, Bulk import, Integrations

Hidden by role (finance/super_admin see filtered items).

**Command palette (⌘K)** — `cmdk` component, indexes teams, mentors, submissions, admin routes. Fetched lazily from a paginated `createServerFn`.

**New admin landing (`/admin`)** replacing the current tab-based dashboard:
- 4 KPI cards: Teams at risk · Overdue phases · Pending approvals · Submissions awaiting review — each links to a pre-filtered list.
- Cohort progress strip — one bar per active cohort.
- Attention feed — 20 most recent items from `rp_audit_logs` + `rp_notifications` needing admin attention.

The existing Leaderboard / Tracker / Mentor Board / Analytics move to their own routes (`/admin/teams`, `/admin/mentor-board`, `/admin/analytics`) accessed from the sidebar.

## Phase 2 — Scaled teams table

- New server fn `listTeamsPaginated({ page, pageSize, search, filters, sort })` — pagination + filters (cohort, state, mentor, risk, phase, last-activity) done in SQL, not client.
- Virtualised table (`@tanstack/react-virtual`) with sticky header + frozen team-name column.
- Bulk row selection with actions: reassign mentor, change status, message team leaders, export subset.
- **Saved views** — filter combos stored per admin in a new `rp_admin_saved_views` table.
- Density toggle (comfortable / compact).

## Phase 3 — Unified Inbox

New route `/admin/inbox` merging today's scattered approval surfaces into one tabbed screen:
- Role approvals · Mentor applications · Mentor↔team requests · Flagged submissions · Failed emails

Each row supports approve/reject/assign inline with a details drawer. Unread badge on sidebar item. Backed by existing `rp_role_approvals`, `rp_mentor_applications`, `rp_mentor_team_requests`, `rp_submissions`.

## Phase 4 — Mass email composer

The big one you asked for. Reuses the existing Lovable email infrastructure (`RESEND_API_KEY`, `email_send_log`, unsubscribe tokens) already set up in your project.

### Audience targeting
Single `/admin/emails/compose` screen. Audience picker (radio) supports:
- **All team leaders** (in optional cohort)
- **All team members** (leaders + members)
- **Team + mentor** (a specific team, or all active teams)
- **All mentors** (with/without assigned team)
- **All evaluators**
- **Custom** — pick individual teams, states, cohorts, or paste an email allowlist

Preview shows resolved recipient count and first 10 recipients *before* send.

### Templates (deadline-oriented, what you described)
Three prebuilt React Email templates in `src/lib/email-templates/`:
- `admin-deadline-team.tsx` — "Phase N deliverable due {date}" (for teams + leaders)
- `admin-deadline-mentor.tsx` — "You have {n} submissions awaiting review — due {date}"
- `admin-deadline-evaluator.tsx` — "You have {n} evaluations pending — due {date}"

Each template accepts `{ recipientName, cohortName, deadlineDate, ctaUrl, customMessage }`. The composer lets admins set the merge fields, add a free-text `customMessage` block (plain text only, escaped), preview the rendered email, then send.

### Send pipeline (safe for 500+ recipients)
- Server fn `sendMassEmail({ templateName, audience, mergeFields, testRecipient? })` — admin-only (`rp_is_admin` check), Zod-validated.
- Enforces recipient cap (default 1000/send) and 1 send / 30 s per admin to prevent accidental spam.
- Loop enqueues per-recipient rows into the existing `transactional_emails` pgmq queue via `enqueue_email` RPC — the queue processor handles throttling (~120/min), retries, DLQ, and suppression checks automatically. No blocking loop, no rate-limit surprises.
- Every send gets a shared `campaign_id` written to `email_send_log.metadata` so the log view can group them.
- "Send test to me" button before the real send.

### Scheduled / recurring deadline reminders (bonus)
Table `rp_email_campaigns` (draft/scheduled/sent) + a pg_cron job hitting a new `/api/public/hooks/mass-email-tick` route every 15 min to enqueue any due scheduled campaign. Lets admins set "remind evaluators 3 days before phase deadline" once.

### Email log view
`/admin/emails/log` — filter by campaign, template, status; dedupes on `message_id` (per the email-log rules). Uses existing `email_send_log`.

## Data changes

New tables (one migration, RLS + GRANTs):
- `rp_admin_saved_views` — per-admin table filter presets
- `rp_email_campaigns` — audience snapshot, template, merge fields, schedule, status, created_by
- `rp_email_campaign_recipients` — resolved recipient list per campaign (for audit + resend-failed)

All admin-only via `rp_is_admin(auth.uid())` policies.

## Technical notes

- All new server fns use `createServerFn` + `requireSupabaseAuth` + explicit `rp_is_admin` check inside handler.
- Recipient resolution runs server-side using `supabaseAdmin` (loaded inside handler) — needed to reach `auth.users` emails for team members without profiles.
- Suppression list (`suppressed_emails`) is respected automatically by the queue processor — unsubscribed recipients are silently skipped and logged.
- No third-party SDK; uses Lovable's built-in email infra you already have configured.
- Command palette uses `cmdk` (already in shadcn ecosystem).
- Virtualisation uses `@tanstack/react-virtual`.

## Rollout order

1. Phase 1 (sidebar + landing + ⌘K) — biggest daily UX win, no schema changes
2. Phase 4 (mass email composer) — the feature you specifically asked for
3. Phase 2 (scaled teams table + saved views) — needed once you cross ~100 teams
4. Phase 3 (unified inbox) — polish once the above land

Approve and I'll start with Phase 1 + the schema migration for Phase 4 in parallel, then move through the phases.
