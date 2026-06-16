import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function jitsiRoom() {
  return "rakshak-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
function jitsiUrl(room: string) {
  return `https://meet.jit.si/${room}`;
}

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
      const { sendMeetingScheduledEmails, sendMeetingEmailToAddresses } = await import("./meeting-notify.server");
      await sendMeetingScheduledEmails(row.id);
      if (rawEmailsToSend.length) {
        await sendMeetingEmailToAddresses(row.id, rawEmailsToSend);
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
    const { error } = await context.supabase
      .from("rp_meeting_attendees")
      .upsert({
        meeting_id: data.meeting_id,
        profile_id: context.userId,
        rsvp: data.rsvp,
        responded_at: new Date().toISOString(),
      }, { onConflict: "meeting_id,profile_id" });
    if (error) throw error;
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
