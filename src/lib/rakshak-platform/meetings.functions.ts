import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateInput = z.object({
  team_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  agenda: z.string().max(4000).default(""),
  scheduled_start: z.string(),
  scheduled_end: z.string(),
  meeting_link: z.string().url().max(500).optional().or(z.literal("")),
  location: z.string().max(200).optional(),
  status: z.enum(["proposed", "confirmed", "cancelled", "completed"]).default("proposed"),
});

export const createMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("rp_meetings")
      .insert({
        team_id: data.team_id,
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
    // Auto-add creator as attendee
    await context.supabase
      .from("rp_meeting_attendees")
      .insert({ meeting_id: row.id, profile_id: context.userId, rsvp: "going", responded_at: new Date().toISOString() });
    return { meeting: row };
  });

export const cancelMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
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
    // Find teams the user belongs to (member, leader, or mentor)
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
    if (teamIds.size === 0) return { meetings: [] };
    const { data, error } = await context.supabase
      .from("rp_meetings")
      .select("*, rp_teams(team_name), rp_meeting_attendees(profile_id, rsvp)")
      .in("team_id", Array.from(teamIds))
      .order("scheduled_start", { ascending: false })
      .limit(100);
    if (error) throw error;
    return { meetings: data ?? [] };
  });
