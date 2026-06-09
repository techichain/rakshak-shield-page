import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
    const { data: row, error } = await context.supabase
      .from("rp_meetings")
      .insert({
        team_id: data.team_id ?? null,
        meeting_type: data.meeting_type,
        title: data.title,
        agenda: data.agenda,
        scheduled_start: data.scheduled_start,
        scheduled_end: data.scheduled_end,
        meeting_link: data.meeting_link || null,
        location: data.location || null,
        status: data.status,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw error;

    const attendees = new Set<string>([context.userId, ...data.invitee_ids]);
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
    return { meeting: row };
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
    if (error) throw error;
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
      .ilike("full_name", `%${data.search}%`)
      .order("full_name", { ascending: true })
      .limit(25);
    if (error) throw error;
    return { people: rows ?? [] };
  });
