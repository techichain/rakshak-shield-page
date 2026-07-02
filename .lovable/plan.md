
## What already works (no rebuild needed)

The submission → mentor review → admin review cascade is already live end-to-end:
- Team leader/members submit via `/rakshak-platform/team/phases/$phase`; report stored in `rp_submissions` with files in `rp_submission_files`.
- Mentor reviews on their dashboard → status becomes `mentor_approved` (routed to admin) or `changes_requested`.
- Admin sees mentor-approved items in `/rakshak-platform/admin/reviews` and can final-approve.
- Feedback (`rp_feedback`) is already visible to the team leader, team members, mentor, and admin on the phase page.

Gap = **mentor resource sharing**, **admin per-team hub**, and **making feedback more visible** on team/member dashboards.

## What I'll build

### 1. Mentor resources (files + links)

**Database (migration):**
- Create `public.rp_mentor_resources`:
  - `mentor_id uuid` (profile of the mentor)
  - `team_id uuid` (nullable — null = shared with ALL teams this mentor is assigned to)
  - `title`, `description`, `kind` (`'file' | 'link'`)
  - `external_url` (for links)
  - `file_name`, `file_type`, `file_size`, `storage_path`, `file_url` (for files)
  - GRANTs to `authenticated` + `service_role`; RLS:
    - INSERT/UPDATE/DELETE: only if `mentor_id = auth.uid()` AND caller has mentor role.
    - SELECT: mentor themselves, admins, or (team member/leader of `team_id`, or of any team assigned to `mentor_id` when `team_id IS NULL`).
- Create private storage bucket `rp-mentor-resources` with matching policies (mentor writes to `{mentor_id}/…`; team members & admin can read within their scope).

**Server functions** (`src/lib/rakshak-platform/mentor-resources.functions.ts`):
- `createMentorResource` — validates ownership, inserts row (file already uploaded via signed URL).
- `getMentorResourceUploadUrl` — returns Supabase signed upload URL scoped to `{mentor_id}/{uuid}/{filename}`.
- `getResourceDownloadUrl` — signed download URL after auth check.
- `listMyMentorResources` — mentor's own.
- `listTeamResourcesForViewer` — resources visible to a given team (team members, leader, admin call this).
- `deleteMentorResource`.

**UI:**
- New route `/rakshak-platform/mentor/resources` — mentor uploads file or adds link, chooses target team ("All my teams" or a specific team), sees list, can delete.
- CTA card added to mentor dashboard.
- Team dashboard (`rakshak-platform.team.tsx`) + Member dashboard (`rakshak-platform.member.tsx`) get a **"Resources from your mentor"** section listing files (download) and links (open in new tab).

### 2. Admin per-team hub

- New index route `/rakshak-platform/admin/teams` — searchable table of all teams (name, leader, mentor, phase, status, score) → link to detail page.
- New detail route `/rakshak-platform/admin/teams/$teamId` with 5 tabs:
  1. **Overview** — team meta, phase, score, leader, mentor, member count.
  2. **Submissions & Feedback** — each phase's submission, files, current status, full feedback thread (mentor + admin) with inline approve/request-changes actions.
  3. **Resources** — everything the mentor shared with this team.
  4. **Meetings** — upcoming/past meetings for the team (`rp_meetings`).
  5. **Members** — leader + all team members with contact info.
- Add "Teams" entry to admin nav in `Shell.tsx`.

### 3. Feedback surfacing

- On team leader dashboard (`rakshak-platform.team.tsx`): compact "Recent mentor feedback" card showing latest 3 feedback rows across all phases with jump link to the phase.
- Same card on member dashboard (`rakshak-platform.member.tsx`) — read-only.

## Technical notes

- Reuse existing `rp_submissions` / `rp_feedback` / `rp_meetings` RLS (already scoped).
- New RLS helper `rp_can_view_mentor_resource(_resource, _user)` (SECURITY DEFINER) to avoid recursion.
- File upload: browser gets signed URL from server fn → uploads directly → server fn records metadata.
- Admin tab page reuses existing server fns (`getTeamReport`, `getSubmissionDetail`, `listMeetings`, `listTeamMembers`, `listTeamResourcesForViewer`, `adminReviewSubmission`).
- No changes to submission flow itself — the review/approval cascade already routes mentor-approved reports to admin.

## Out of scope
- No changes to how submissions are created or the mentor/admin approval statuses.
- No email notifications for new resources (can add later if wanted).

Approve and I'll implement in one pass.
