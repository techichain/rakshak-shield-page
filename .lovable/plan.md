# /gigrider-checklist — Build Plan

This is a large app. I'll enable Lovable Cloud and ship in 3 phases so we can test each before moving on. Existing `/` (Rakshak) is untouched.

## Phase 0 — Foundation (this turn)
- Enable Lovable Cloud (Postgres + Auth + Storage)
- Create DB schema: `profiles`, `user_roles` (enum: observer/admin), `hotspots`, `surveyors`, `observations`, `observation_photos`, `audit_log`
- RLS policies (observers see own rows; admins see all via `has_role()` security-definer fn)
- Storage bucket `observation-photos` (private, RLS-scoped)
- Seed the 12 hotspots from the schema
- Auth: email/password (no signup UI — admin creates accounts). Login at `/gigrider-checklist/login`
- Routes scaffold under `src/routes/gigrider-checklist/` so it's fully isolated from `/`

## Phase 1 — Observer Form
- `/gigrider-checklist` dashboard: list own observations + drafts, "New Observation" CTA
- `/gigrider-checklist/observation/new` and `/observation/$id`
- 6-section mobile-first form with chips, segmented controls, GPS auto-capture
- Conditional fields (rushed notes, led notes, flag reason)
- localStorage draft autosave + Save Draft / Submit
- Photo upload to Storage
- Submit-time validation per spec §5

## Phase 2 — Admin Dashboard
- `/gigrider-checklist/admin` overview cards + charts (recharts)
- `/admin/observations` table with filters, row actions
- `/admin/flagged`, `/admin/hotspots`, `/admin/surveyors`, `/admin/users`
- `/admin/export` CSV via PapaParse
- Leaflet map with GPS pins colour-coded by hotspot
- Audit log writes on admin mutations

## Tech notes
- Server functions (`createServerFn`) for all DB access — never raw Supabase from loaders
- `requireSupabaseAuth` middleware on all protected fns
- `has_role(uid, 'admin')` security-definer fn for RLS admin checks
- Offline sync: localStorage queue, retried on reconnect

## What I'll do right now
Phase 0 only — Cloud + schema + auth + route scaffold + login page. Then I stop and you confirm before Phase 1.

OK to proceed?