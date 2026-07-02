## Scope

Based on your answers:
- **Team lead** can only meet with their team's assigned mentor (no picker, no email textarea).
- **Google Meet link** is auto-created by the Google Calendar API on the team lead's calendar (requires them to have connected Google — otherwise we tell them to connect first).
- **Mentor availability** is read live from the mentor's connected Google Calendar (free/busy). If the mentor hasn't connected Google, we show a clear "mentor hasn't shared availability" message instead of falling back.
- **Buttons** for "Meetings" and "Availability" live only in each role's primary dashboard card. All other nav entries are removed.

## 1. Team lead — new "Book mentor session" page

New route: `src/routes/rakshak-platform.team.book-mentor.tsx`.

Flow:
1. Loads the team leader's team → resolves `assigned_mentor_id` + mentor's `profile_id` + `full_name`.
2. Requires the team lead to have connected Google Calendar. If not, shows one-click "Connect Google Calendar" (existing OAuth). Same gate: if the mentor hasn't connected Google, show "Mentor hasn't shared availability yet — please contact them" (no fallback to manual slots).
3. New server fn `getMentorFreeBusy` (in `src/lib/rakshak-platform/mentor-sessions.functions.ts`):
   - Verifies caller is the leader of a team whose `assigned_mentor_id` maps to the target mentor.
   - Uses `supabaseAdmin` to fetch the mentor's stored access token (refreshed via existing `getValidAccessToken`, exported from `google-calendar.server.ts`).
   - Calls `POST https://www.googleapis.com/calendar/v3/freeBusy` for the next 14 days on the mentor's primary calendar.
   - Returns busy intervals + mentor working hours (default 9am–7pm IST, 30-min slots) so the client can render free slots.
4. Team lead picks a slot + title + agenda → calls new server fn `bookMentorMeeting`:
   - Inserts into `rp_meetings` (type `team_mentor`, `created_by = team lead`, `team_id`).
   - Adds attendees: team lead + mentor.
   - Calls **new** `createMeetingOnCreatorCalendar(meetingId)` which uses the team lead's Google token to `POST /calendars/primary/events?conferenceDataVersion=1&sendUpdates=all` with:
     - `attendees: [mentorEmail, teamLeadEmail]`
     - `conferenceData.createRequest` → Google Meet auto-generated
     - `extendedProperties.private.rp_meeting_id`
   - Writes the returned Meet link + Google event id into `rp_meetings` (`meeting_link`, new column `google_event_id`).
   - Google sends the calendar invite email automatically (`sendUpdates=all`) — no separate Resend/queue send for this path.
5. Success screen shows the confirmed slot + Meet link.

## 2. Existing "Schedule a meeting" form (`/rakshak-platform/meetings`)

- For **team leaders**, the free-form scheduling form is replaced with a prominent card that links to the new "Book with mentor" page (per your "only assigned mentor" answer). Their upcoming/past meeting list stays.
- For **mentors, evaluators, admins**, the existing form remains (they still need free-form scheduling), but the type dropdown removes `team_mentor` for team leaders and the extra-emails textarea stays for the other roles.

## 3. Mentor `/mentor/availability` page

Kept as-is for now (mentors still see their bookings there), but the "publish manual slots" form is hidden behind a collapsed "Advanced" section, and a new prominent panel says "Your Google Calendar is your availability" with connect/disconnect status. No new manual-slot workflow is added.

## 4. Consolidate nav

In `src/components/rakshak-platform/Shell.tsx`:
- Remove standalone `Meetings` and `Availability` links from desktop nav and mobile menu for all roles.
- Add a single "Meetings" CTA card at the top of each role's home dashboard (`team.tsx`, `mentor.index.tsx`, `evaluator.index.tsx`, `admin.index.tsx`) linking to `/rakshak-platform/meetings` (or `/team/book-mentor` for team leads).
- Admin "All meetings" stays inside the Admin → People dropdown (single entry, no duplicate).

## 5. DB migration

Add columns to `rp_meetings`:
- `google_event_id text` — for later RSVP sync + reschedule via API.
- `google_organizer_user_id uuid` — which user's calendar hosts the event.

No RLS changes.

## Technical notes

- Reuse existing OAuth flow in `google-calendar.functions.ts` / `google-calendar.server.ts`. No new secrets needed (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` already present).
- Export `getValidAccessToken` from `google-calendar.server.ts` so the new mentor-sessions functions can reuse it (currently module-private).
- `conferenceDataVersion=1` + `conferenceData.createRequest.conferenceSolutionKey.type = "hangoutsMeet"` gives us Meet links; works with `calendar.events` scope already granted.
- `sendUpdates=all` makes Google email the invite — this replaces the current Resend path for the team-lead flow (Resend path stays for the other roles' free-form form).
- If either party disconnects Google mid-flow, the booking button surfaces the specific missing side.

## Out of scope

- Rewriting the Resend/ICS pipeline for non-team-lead scheduling.
- Reschedule/cancel via GCal API (current portal-side cancel still works; adding `google_event_id` sets us up for a later pass).
- Mentor manual-slot page migration (kept but de-emphasized).
