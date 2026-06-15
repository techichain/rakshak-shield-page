import { createFileRoute } from "@tanstack/react-router";

/**
 * QA-only end-to-end self-test for the Rakshak meeting scheduling +
 * notification flow. Idempotent.
 *
 * Bearer auth: ADMIN_DIGEST_WEBHOOK_SECRET.
 *
 * Steps it runs server-side (using the admin client, bypassing RLS):
 *   1. Ensures two test auth users exist:
 *        - test.mentor@example.com         ("TEST - Rakshak Mentor")
 *        - test.teamleader@example.com     ("TEST - Rakshak Team Lead")
 *   2. Upserts rp_profiles + rp_user_roles (mentor / team_leader) for each.
 *   3. Upserts rp_mentors row for the mentor.
 *   4. Upserts an rp_teams row "TEST - Selftest Team" led by the team leader.
 *   5. Creates a fresh rp_mentor_slot for the mentor (1 hour, tomorrow).
 *   6. "Books" the slot as the team leader: inserts rp_meetings +
 *      rp_meeting_attendees, bumps slot.booked_count, fires
 *      sendMeetingScheduledEmails(meeting_id).
 *   7. Reads recent email_send_log rows for this meeting and returns them.
 *
 * Cleanup hint (run in SQL editor when done):
 *   delete from auth.users where email in
 *     ('test.mentor@example.com','test.teamleader@example.com');
 *   delete from public.rp_teams where team_name = 'TEST - Selftest Team';
 */
export const Route = createFileRoute("/api/public/hooks/rp-meeting-selftest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ADMIN_DIGEST_WEBHOOK_SECRET;
        if (!expected) {
          return new Response("Webhook secret not configured", { status: 503 });
        }
        const auth = request.headers.get("authorization") ?? "";
        const presented = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        const { timingSafeEqual } = await import("crypto");
        const a = Buffer.from(presented);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );

          async function ensureUser(email: string, fullName: string) {
            // Try create; if dupe, look up.
            const { data: created } = await supabaseAdmin.auth.admin.createUser({
              email,
              password: `Test-${Math.random().toString(36).slice(2, 10)}!A1`,
              email_confirm: true,
              user_metadata: { name: fullName },
            });
            let id = created?.user?.id ?? null;
            if (!id) {
              // Paginate listUsers to find existing
              const { data: list } =
                await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
              id =
                list?.users?.find(
                  (u) => u.email?.toLowerCase() === email.toLowerCase(),
                )?.id ?? null;
            }
            if (!id) throw new Error(`Could not create or find user ${email}`);

            await supabaseAdmin
              .from("rp_profiles")
              .upsert(
                { id, full_name: fullName, email } as any,
                { onConflict: "id" },
              );
            return id;
          }

          const mentorUserId = await ensureUser(
            "test.mentor@example.com",
            "TEST - Rakshak Mentor",
          );
          const leaderUserId = await ensureUser(
            "test.teamleader@example.com",
            "TEST - Rakshak Team Lead",
          );

          await supabaseAdmin
            .from("rp_user_roles")
            .upsert(
              { user_id: mentorUserId, role: "mentor" } as any,
              { onConflict: "user_id,role" },
            );
          await supabaseAdmin
            .from("rp_user_roles")
            .upsert(
              { user_id: leaderUserId, role: "team_leader" } as any,
              { onConflict: "user_id,role" },
            );

          // Ensure rp_mentors row for the mentor
          let { data: mentorRow } = await supabaseAdmin
            .from("rp_mentors")
            .select("id")
            .eq("profile_id", mentorUserId)
            .maybeSingle();
          if (!mentorRow) {
            const { data: newMentor, error: mErr } = await supabaseAdmin
              .from("rp_mentors")
              .insert({
                profile_id: mentorUserId,
                expertise: "TEST - QA mentor",
                organization: "TEST org",
                status: "active",
              } as any)
              .select("id")
              .single();
            if (mErr) throw mErr;
            mentorRow = newMentor;
          }

          // Ensure cohort (pick any existing, else create one)
          let { data: cohortRow } = await supabaseAdmin
            .from("rp_cohorts")
            .select("id")
            .limit(1)
            .maybeSingle();
          if (!cohortRow) {
            const { data: newCohort, error: cErr } = await supabaseAdmin
              .from("rp_cohorts")
              .insert({ name: "TEST - Selftest Cohort" } as any)
              .select("id")
              .single();
            if (cErr) throw cErr;
            cohortRow = newCohort;
          }

          // Ensure team
          let { data: teamRow } = await supabaseAdmin
            .from("rp_teams")
            .select("id")
            .eq("team_name", "TEST - Selftest Team")
            .maybeSingle();
          if (!teamRow) {
            const { data: newTeam, error: tErr } = await supabaseAdmin
              .from("rp_teams")
              .insert({
                team_name: "TEST - Selftest Team",
                city: "Testville",
                state: "Testland",
                college: "TEST College",
                status: "active",
                team_leader_id: leaderUserId,
                cohort_id: cohortRow!.id,
              } as any)
              .select("id")
              .single();
            if (tErr) throw tErr;
            teamRow = newTeam;
          } else {
            await supabaseAdmin
              .from("rp_teams")
              .update({ team_leader_id: leaderUserId } as any)
              .eq("id", teamRow.id);
          }

          // Create a fresh slot starting ~24h from now
          const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
          const { data: slot, error: slotErr } = await supabaseAdmin
            .from("rp_mentor_slots")
            .insert({
              mentor_id: mentorRow!.id,
              starts_at: startsAt.toISOString(),
              ends_at: endsAt.toISOString(),
              capacity: 1,
              notes: "TEST - selftest slot",
              created_by: mentorUserId,
              status: "open",
            } as any)
            .select("*")
            .single();
          if (slotErr) throw slotErr;

          // Book it as the team leader
          const videoRoom =
            "rk-" +
            Math.random().toString(36).slice(2, 10) +
            Date.now().toString(36).slice(-4);
          const { data: meeting, error: mtgErr } = await supabaseAdmin
            .from("rp_meetings")
            .insert({
              team_id: teamRow!.id,
              meeting_type: "team_mentor",
              title: "TEST - Selftest 1:1",
              agenda: "Self-test booking — automated QA",
              scheduled_start: slot!.starts_at,
              scheduled_end: slot!.ends_at,
              status: "confirmed",
              created_by: leaderUserId,
              slot_id: slot!.id,
              video_room_id: videoRoom,
              whiteboard_room_id: videoRoom + "-wb",
              meeting_link: `https://meet.jit.si/${videoRoom}`,
            } as any)
            .select("*")
            .single();
          if (mtgErr) throw mtgErr;

          await supabaseAdmin.from("rp_meeting_attendees").insert([
            {
              meeting_id: meeting!.id,
              profile_id: leaderUserId,
              rsvp: "going",
              responded_at: new Date().toISOString(),
            },
            {
              meeting_id: meeting!.id,
              profile_id: mentorUserId,
              rsvp: "going",
              responded_at: new Date().toISOString(),
            },
          ] as any);

          await supabaseAdmin
            .from("rp_mentor_slots")
            .update({ booked_count: 1, status: "full" } as any)
            .eq("id", slot!.id);

          // Fire email pipeline
          const { sendMeetingScheduledEmails } = await import(
            "@/lib/rakshak-platform/meeting-notify.server"
          );
          let emailError: string | null = null;
          try {
            await sendMeetingScheduledEmails(meeting!.id);
          } catch (e: any) {
            emailError = String(e?.message ?? e);
          }

          // Wait a beat then read email_send_log for this meeting
          await new Promise((r) => setTimeout(r, 250));
          const { data: logs } = await supabaseAdmin
            .from("email_send_log")
            .select(
              "message_id, template_name, recipient_email, status, error_message, created_at, metadata",
            )
            .eq("template_name", "rp-meeting-scheduled")
            .order("created_at", { ascending: false })
            .limit(10);
          const meetingLogs = (logs ?? []).filter(
            (l: any) => l?.metadata?.meeting_id === meeting!.id,
          );

          return new Response(
            JSON.stringify(
              {
                ok: true,
                mentor: {
                  user_id: mentorUserId,
                  email: "test.mentor@example.com",
                },
                team_leader: {
                  user_id: leaderUserId,
                  email: "test.teamleader@example.com",
                },
                team_id: teamRow!.id,
                slot_id: slot!.id,
                meeting_id: meeting!.id,
                meeting_link: meeting!.meeting_link,
                email_error: emailError,
                email_send_log: meetingLogs,
                cleanup_hint: {
                  delete_users_sql:
                    "DELETE FROM auth.users WHERE email IN ('test.mentor@example.com','test.teamleader@example.com');",
                  delete_team_sql:
                    "DELETE FROM public.rp_teams WHERE team_name = 'TEST - Selftest Team';",
                },
              },
              null,
              2,
            ),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (e: any) {
          console.error("[rp-meeting-selftest] failed", e);
          return new Response(
            JSON.stringify({ ok: false, error: String(e?.message ?? e) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
