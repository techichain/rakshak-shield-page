import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Video conferencing: Google Meet only. Meet links are created on the
// mentor's Google Calendar after the mentor approves the request.

const MeetingType = z.enum([
  "team_mentor",
  "mentor_evaluator",
  "evaluator_team",
  "team_internal",
  "other",
]);

const CreateInput = z.object({
  team_id: z.string().uuid().optional().nullable(),
  meeting_type: MeetingType.default("team_mentor"),
  title: z.string().min(1).max(200),
  agenda: z.string().max(4000).default(""),
  scheduled_start: z.string(),
  scheduled_end: z.string(),
  meeting_link: z.string().url().max(500).optional().or(z.literal("")),
  location: z.string().max(200).optional(),
  status: z.enum(["proposed", "confirmed", "cancelled", "completed"]).default("proposed"),
  invitee_ids: z.array(z.string().uuid()).max(50).default([]),
  extra_emails: z.array(z.string().email()).max(50).default([]),
});

export const createMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    if ((data.meeting_type === "team_mentor" ||
         data.meeting_type === "evaluator_team" ||
         data.meeting_type === "team_internal") && !data.team_id) {
      throw new Error("A team is required for this meeting type.");
    }
    const room = jitsiRoom();
    const finalLink = data.meeting_link && data.meeting_link.length > 0
      ? data.meeting_link
      : jitsiUrl(room);
    const { data: row, error } = await context.supabase
      .from("rp_meetings")
      .insert({
        team_id: data.team_id ?? null,
        meeting_type: data.meeting_type,
        title: data.title,
        agenda: data.agenda,
        scheduled_start: data.scheduled_start,
        scheduled_end: data.scheduled_end,
        meeting_link: finalLink,
        video_room_id: room,
        location: data.location || null,
        status: data.status,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw error;

    const inviteeIds = new Set<string>(data.invitee_ids);

    // Resolve extra_emails: if a profile exists, add as attendee; otherwise
    // remember the raw email for direct send.
    const normalizedEmails = Array.from(
      new Set((data.extra_emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean)),
    );
    const rawEmailsToSend: string[] = [];
    if (normalizedEmails.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: matched } = await supabaseAdmin
        .from("rp_profiles")
        .select("id, email")
        .in("email", normalizedEmails);
      const matchedMap = new Map<string, string>(
        (matched ?? []).map((p: any) => [String(p.email).toLowerCase(), p.id]),
      );
      for (const email of normalizedEmails) {
        const pid = matchedMap.get(email);
        if (pid) inviteeIds.add(pid);
        else rawEmailsToSend.push(email);
      }
    }

    const attendees = new Set<string>([context.userId, ...inviteeIds]);
    await context.supabase
      .from("rp_meeting_attendees")
      .insert(
        Array.from(attendees).map((pid) => ({
          meeting_id: row.id,
          profile_id: pid,
          rsvp: pid === context.userId ? "going" : "pending",
          responded_at: pid === context.userId ? new Date().toISOString() : null,
        })),
      );

    // Fire-and-forget confirmation emails (best effort).
    try {
      const { sendMeetingEmailToAddresses } = await import("./meeting-notify.server");
      // Send invite to ALL extra_emails directly — this covers both
      // external (no profile) and internal (has profile) invitees.
      // We do NOT call sendMeetingScheduledEmails here because that
      // function includes the creator in the recipient list, and the
      // creator doesn't need an invite to their own meeting.
      if (normalizedEmails.length) {
        await sendMeetingEmailToAddresses(row.id, normalizedEmails);
      }
    } catch (err) {
      console.error("[createMeeting] notify failed", err);
    }

    return { meeting: row, extra_emails_sent: normalizedEmails.length };
  });

export const cancelMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Ownership / admin enforcement (defense-in-depth on top of RLS UPDATE policy)
    const { data: row, error: readErr } = await context.supabase
      .from("rp_meetings")
      .select("id, created_by")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!row) throw new Error("Meeting not found");

    let allowed = row.created_by === context.userId;
    if (!allowed) {
      const { data: roles } = await context.supabase
        .from("rp_user_roles")
        .select("role")
        .eq("user_id", context.userId);
      allowed = (roles ?? []).some((r: any) =>
        ["cfi_admin", "super_admin"].includes(r.role),
      );
    }
    if (!allowed) throw new Error("Forbidden: only the meeting creator or an admin can cancel");

    const { error } = await context.supabase
      .from("rp_meetings")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const rescheduleMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      scheduled_start: z.string(),
      scheduled_end: z.string(),
      reason: z.string().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (new Date(data.scheduled_end).getTime() <= new Date(data.scheduled_start).getTime())
      throw new Error("End time must be after start time.");

    const { data: row, error: readErr } = await context.supabase
      .from("rp_meetings")
      .select("id, created_by, title, scheduled_start")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!row) throw new Error("Meeting not found");

    let allowed = row.created_by === context.userId;
    if (!allowed) {
      const { data: roles } = await context.supabase
        .from("rp_user_roles").select("role").eq("user_id", context.userId);
      allowed = (roles ?? []).some((r: any) =>
        ["cfi_admin", "super_admin"].includes(r.role),
      );
    }
    if (!allowed) throw new Error("Forbidden: only the meeting creator or an admin can reschedule");

    const { error } = await context.supabase
      .from("rp_meetings")
      .update({
        scheduled_start: data.scheduled_start,
        scheduled_end: data.scheduled_end,
        status: "proposed",
        // Reset reminder fences so reminders fire for the new time.
        reminder_24h_sent_at: null,
        reminder_1h_sent_at: null,
        reminder_30m_sent_at: null,
      })
      .eq("id", data.id);
    if (error) throw error;

    // Reset attendee RSVPs (except creator) and notify them.
    const { data: attendees } = await context.supabase
      .from("rp_meeting_attendees")
      .select("profile_id")
      .eq("meeting_id", data.id);
    const otherIds = (attendees ?? [])
      .map((a: any) => a.profile_id)
      .filter((pid: string) => pid !== context.userId);
    if (otherIds.length) {
      await context.supabase
        .from("rp_meeting_attendees")
        .update({ rsvp: "pending", responded_at: null })
        .eq("meeting_id", data.id)
        .in("profile_id", otherIds);
      const when = new Date(data.scheduled_start).toLocaleString();
      await context.supabase.from("rp_notifications").insert(
        otherIds.map((pid: string) => ({
          recipient_id: pid,
          type: "meeting_rescheduled",
          title: `Rescheduled: ${row.title}`,
          message: `New time: ${when}${data.reason ? ` — ${data.reason}` : ""}`,
          action_link: `/rakshak-platform/meetings`,
          related_entity_type: "meeting",
          related_entity_id: data.id,
        })),
      );
    }
    return { ok: true };
  });

export const rsvpMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      meeting_id: z.string().uuid(),
      rsvp: z.enum(["going", "not_going", "maybe"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Security: only users who were actually invited (or admins, or the
    // meeting's team members/mentor) may RSVP. Without this, any
    // authenticated user could add themselves to any meeting and gain
    // access to the meeting link, agenda, and video room.
    const { data: existing } = await context.supabase
      .from("rp_meeting_attendees")
      .select("id")
      .eq("meeting_id", data.meeting_id)
      .eq("profile_id", context.userId)
      .maybeSingle();

    if (!existing) {
      const { data: canView } = await context.supabase
        .rpc("rp_can_view_meeting", { _meeting: data.meeting_id, _user: context.userId });
      if (!canView) throw new Error("Forbidden: not invited to this meeting");
    }

    const { error } = await context.supabase
      .from("rp_meeting_attendees")
      .upsert({
        meeting_id: data.meeting_id,
        profile_id: context.userId,
        rsvp: data.rsvp,
        responded_at: new Date().toISOString(),
      }, { onConflict: "meeting_id,profile_id" });
    if (error) throw error;

    try {
      const { syncRsvpToGoogleCalendar } = await import('./google-calendar.server');
      await syncRsvpToGoogleCalendar({
        meetingId: data.meeting_id,
        userId: context.userId,
        rsvp: data.rsvp,
      });
    } catch (err) {
      console.error('[rsvpMeeting] gcal sync failed', err);
    }

    return { ok: true };
  });


export const listMyMeetings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Meetings the user attends or created
    const { data: attRows } = await context.supabase
      .from("rp_meeting_attendees").select("meeting_id").eq("profile_id", context.userId);
    const attIds = (attRows ?? []).map((r: any) => r.meeting_id);

    // Plus meetings for teams the user belongs to / mentors
    const { data: memberRows } = await context.supabase
      .from("rp_team_members").select("team_id").eq("profile_id", context.userId);
    const { data: leaderRows } = await context.supabase
      .from("rp_teams").select("id").eq("team_leader_id", context.userId);
    const { data: mentorRows } = await context.supabase
      .from("rp_mentors").select("id").eq("profile_id", context.userId);
    const teamIds = new Set<string>([
      ...(memberRows ?? []).map((r: any) => r.team_id),
      ...(leaderRows ?? []).map((r: any) => r.id),
    ]);
    const mentorIds = (mentorRows ?? []).map((r: any) => r.id);
    if (mentorIds.length) {
      const { data: mt } = await context.supabase
        .from("rp_teams").select("id").in("assigned_mentor_id", mentorIds);
      (mt ?? []).forEach((r: any) => teamIds.add(r.id));
    }

    let query = context.supabase
      .from("rp_meetings")
      .select("*, rp_teams(team_name), rp_meeting_attendees(profile_id, rsvp)")
      .order("scheduled_start", { ascending: true })
      .limit(200);

    // RLS will filter; we just need a broad fetch
    if (attIds.length === 0 && teamIds.size === 0) {
      query = query.eq("created_by", context.userId);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message || "Failed to load meetings");
    return { meetings: data ?? [] };
  });

export const listAllMeetingsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("rp_is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Admin only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("rp_meetings")
      .select("*, rp_teams(team_name), rp_meeting_attendees(profile_id, rsvp, rp_profiles(full_name, email))")
      .order("scheduled_start", { ascending: false })
      .limit(500);
    if (error) throw error;
    return { meetings: data ?? [] };
  });

export const listInvitees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string } | undefined) =>
    z.object({ search: z.string().trim().min(1).max(80).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    // Do NOT expose email addresses to all authenticated users.
    // Require a search term to prevent bulk profile harvesting.
    if (!data.search) return { people: [] };
    const { data: rows, error } = await context.supabase
      .from("rp_profiles")
      .select("id, full_name")
      .or(`full_name.ilike.%${data.search}%,email.ilike.%${data.search}%`)
      .order("full_name", { ascending: true })
      .limit(25);
    if (error) throw error;
    return { people: rows ?? [] };
  });

export const notifyMeetingConfirmed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ meeting_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: meeting } = await context.supabase
      .from("rp_meetings")
      .select("id, title, created_by")
      .eq("id", data.meeting_id)
      .maybeSingle();
    if (!meeting) return { ok: true };

    const { data: attendees } = await context.supabase
      .from("rp_meeting_attendees")
      .select("profile_id")
      .eq("meeting_id", data.meeting_id)
      .neq("profile_id", context.userId);

    const otherIds = (attendees ?? []).map((a: any) => a.profile_id).filter(Boolean);
    if (!otherIds.length) return { ok: true };

    await context.supabase.from("rp_notifications").insert(
      otherIds.map((pid: string) => ({
        recipient_id: pid,
        type: "meeting_confirmed",
        title: `Meeting confirmed: ${meeting.title}`,
        message: `An attendee confirmed their attendance. Check the meeting details.`,
        action_link: `/rakshak-platform/meetings`,
        related_entity_type: "meeting",
        related_entity_id: data.meeting_id,
      })),
    );

    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Team-lead → assigned mentor booking (auto Google Meet)
// ---------------------------------------------------------------------------

async function resolveTeamLeaderMentor(
  supabase: any,
  supabaseAdmin: any,
  userId: string,
) {
  // Find the team where the current user is the leader.
  const { data: team } = await supabase
    .from("rp_teams")
    .select("id, team_name, assigned_mentor_id")
    .eq("team_leader_id", userId)
    .maybeSingle();
  if (!team) throw new Error("You are not registered as a team leader.");
  if (!team.assigned_mentor_id) {
    throw new Error("Your team has no assigned mentor yet. Ask an admin to assign one.");
  }
  const { data: mentor } = await supabaseAdmin
    .from("rp_mentors")
    .select("id, profile_id")
    .eq("id", team.assigned_mentor_id)
    .maybeSingle();
  if (!mentor?.profile_id) throw new Error("Assigned mentor profile not found.");
  const { data: profiles } = await supabaseAdmin
    .from("rp_profiles")
    .select("id, full_name, email")
    .in("id", [userId, mentor.profile_id]);
  const leaderProfile = (profiles ?? []).find((p: any) => p.id === userId);
  const mentorProfile = (profiles ?? []).find((p: any) => p.id === mentor.profile_id);
  if (!leaderProfile?.email) throw new Error("Your account has no email on file.");
  if (!mentorProfile?.email) throw new Error("Mentor account has no email on file.");
  return {
    team,
    mentorProfileId: mentor.profile_id as string,
    leaderProfile,
    mentorProfile,
  };
}

export const getMyMentorAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(1).max(28).default(14) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getValidAccessToken, getFreeBusy } = await import("./google-calendar.server");

    const { team, mentorProfileId, mentorProfile } = await resolveTeamLeaderMentor(
      context.supabase,
      supabaseAdmin,
      context.userId,
    );

    // Gate checks
    const leaderCred = await getValidAccessToken(context.userId);
    const mentorCred = await getValidAccessToken(mentorProfileId);

    const timeMin = new Date();
    const timeMax = new Date(Date.now() + data.days * 24 * 60 * 60 * 1000);

    let busy: Array<{ start: string; end: string }> = [];
    if (mentorCred) {
      const fb = await getFreeBusy(mentorProfileId, {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
      });
      busy = fb?.busy ?? [];
    }

    return {
      team: { id: team.id, team_name: team.team_name },
      mentor: { full_name: mentorProfile.full_name, email: mentorProfile.email },
      leader_connected: !!leaderCred,
      mentor_connected: !!mentorCred,
      window: { start: timeMin.toISOString(), end: timeMax.toISOString() },
      busy,
    };
  });

export const bookMentorMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      scheduled_start: z.string(),
      scheduled_end: z.string(),
      title: z.string().min(1).max(200),
      agenda: z.string().max(4000).default(""),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (new Date(data.scheduled_end).getTime() <= new Date(data.scheduled_start).getTime()) {
      throw new Error("End time must be after start time.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getValidAccessToken, createEventWithMeet } = await import("./google-calendar.server");

    const { team, mentorProfileId, leaderProfile, mentorProfile } =
      await resolveTeamLeaderMentor(context.supabase, supabaseAdmin, context.userId);

    const leaderCred = await getValidAccessToken(context.userId);
    if (!leaderCred) {
      throw new Error("Please connect your Google Calendar first (Profile → Google Calendar).");
    }

    // Insert placeholder row first so we have an id for the Meet request.
    const { data: row, error } = await context.supabase
      .from("rp_meetings")
      .insert({
        team_id: team.id,
        meeting_type: "team_mentor",
        title: data.title,
        agenda: data.agenda,
        scheduled_start: data.scheduled_start,
        scheduled_end: data.scheduled_end,
        location: null,
        status: "confirmed",
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw error;

    // Attendees: leader + mentor (RLS allows creator inserts).
    await context.supabase.from("rp_meeting_attendees").insert([
      { meeting_id: row.id, profile_id: context.userId, rsvp: "going", responded_at: new Date().toISOString() },
      { meeting_id: row.id, profile_id: mentorProfileId, rsvp: "pending" },
    ]);

    const description = [
      data.agenda,
      "",
      `Team: ${team.team_name}`,
      `Organizer: ${leaderProfile.full_name ?? leaderProfile.email}`,
    ].filter(Boolean).join("\n");

    const gcal = await createEventWithMeet({
      organizerUserId: context.userId,
      title: data.title,
      description,
      startISO: new Date(data.scheduled_start).toISOString(),
      endISO: new Date(data.scheduled_end).toISOString(),
      attendeeEmails: [leaderProfile.email, mentorProfile.email],
      meetingId: row.id,
    });

    if (!gcal) {
      // Roll back: the calendar step is the whole point of this flow.
      await supabaseAdmin.from("rp_meetings").delete().eq("id", row.id);
      throw new Error("Failed to create Google Calendar event. Reconnect Google Calendar and try again.");
    }

    await supabaseAdmin
      .from("rp_meetings")
      .update({
        meeting_link: gcal.meetLink,
        google_event_id: gcal.eventId,
        google_organizer_user_id: context.userId,
      })
      .eq("id", row.id);

    return {
      meeting_id: row.id,
      meet_link: gcal.meetLink,
      mentor_email: mentorProfile.email,
    };
  });
