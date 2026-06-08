import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function randomRoomId() {
  return "rk-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// ---------- mentor: create / list / cancel slots ----------
const CreateSlot = z.object({
  starts_at: z.string(),
  ends_at: z.string(),
  capacity: z.number().int().min(1).max(20).default(1),
  notes: z.string().max(400).optional(),
});
export const createMentorSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSlot.parse(d))
  .handler(async ({ data, context }) => {
    const { data: mentor } = await context.supabase
      .from("rp_mentors")
      .select("id")
      .eq("profile_id", context.userId)
      .maybeSingle();
    if (!mentor) throw new Error("You are not registered as a mentor.");
    if (new Date(data.ends_at).getTime() <= new Date(data.starts_at).getTime())
      throw new Error("End time must be after start time.");
    const { data: row, error } = await context.supabase
      .from("rp_mentor_slots")
      .insert({
        mentor_id: mentor.id,
        starts_at: data.starts_at,
        ends_at: data.ends_at,
        capacity: data.capacity,
        notes: data.notes ?? null,
        created_by: context.userId,
        status: "open",
      })
      .select("*")
      .single();
    if (error) throw error;
    return { slot: row };
  });

export const listMySlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: mentor } = await context.supabase
      .from("rp_mentors")
      .select("id")
      .eq("profile_id", context.userId)
      .maybeSingle();
    if (!mentor) return { slots: [], bookings: [] };
    const { data: slots } = await context.supabase
      .from("rp_mentor_slots")
      .select("*")
      .eq("mentor_id", mentor.id)
      .order("starts_at", { ascending: false })
      .limit(100);
    const { data: bookings } = await context.supabase
      .from("rp_meetings")
      .select(
        "id, title, scheduled_start, scheduled_end, status, video_room_id, slot_id, rp_teams:team_id(team_name)",
      )
      .not("slot_id", "is", null)
      .in("slot_id", (slots ?? []).map((s: any) => s.id))
      .order("scheduled_start", { ascending: true });
    return { slots: slots ?? [], bookings: bookings ?? [] };
  });

export const cancelMentorSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ slot_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: mentor } = await context.supabase
      .from("rp_mentors")
      .select("id")
      .eq("profile_id", context.userId)
      .maybeSingle();
    if (!mentor) throw new Error("You are not registered as a mentor.");
    const { data: updated, error } = await context.supabase
      .from("rp_mentor_slots")
      .update({ status: "cancelled" })
      .eq("id", data.slot_id)
      .eq("mentor_id", mentor.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!updated) throw new Error("Slot not found or you do not own it.");
    return { ok: true };
  });

// ---------- public profile: list slots for a mentor ----------
export const listMentorOpenSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ mentor_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: slots, error } = await context.supabase
      .from("rp_mentor_slots")
      .select("id, starts_at, ends_at, capacity, booked_count, status, notes")
      .eq("mentor_id", data.mentor_id)
      .eq("status", "open")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(50);
    if (error) throw error;
    const { data: mentor } = await context.supabase
      .from("rp_mentors")
      .select("id, expertise, organization, rp_profiles:profile_id(full_name)")
      .eq("id", data.mentor_id)
      .maybeSingle();
    return { mentor, slots: slots ?? [] };
  });

// ---------- team: book a slot ----------
const Book = z.object({
  slot_id: z.string().uuid(),
  team_id: z.string().uuid().optional().nullable(),
  topic: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
});
export const bookMentorSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Book.parse(d))
  .handler(async ({ data, context }) => {
    // Verify slot is open and has capacity
    const { data: slot } = await context.supabase
      .from("rp_mentor_slots")
      .select("*, rp_mentors:mentor_id(profile_id, rp_profiles:profile_id(full_name))")
      .eq("id", data.slot_id)
      .maybeSingle();
    if (!slot) throw new Error("Slot not found");
    if (slot.status !== "open") throw new Error("This slot is no longer open.");
    if ((slot.booked_count ?? 0) >= slot.capacity)
      throw new Error("This slot is already fully booked.");

    const videoRoom = randomRoomId();
    const whiteboardRoom = randomRoomId();
    const mentorProfile = (slot as any).rp_mentors?.profile_id;

    // Create meeting
    const { data: meeting, error: mErr } = await context.supabase
      .from("rp_meetings")
      .insert({
        team_id: data.team_id ?? null,
        meeting_type: "team_mentor",
        title: data.topic,
        agenda: data.notes ?? "",
        scheduled_start: slot.starts_at,
        scheduled_end: slot.ends_at,
        status: "confirmed",
        created_by: context.userId,
        slot_id: slot.id,
        video_room_id: videoRoom,
        whiteboard_room_id: whiteboardRoom,
      })
      .select("*")
      .single();
    if (mErr) throw mErr;

    // Attendees: the booker + the mentor
    const attendeeIds = new Set<string>([context.userId]);
    if (mentorProfile) attendeeIds.add(mentorProfile);
    await context.supabase.from("rp_meeting_attendees").insert(
      Array.from(attendeeIds).map((pid) => ({
        meeting_id: meeting.id,
        profile_id: pid,
        rsvp: "going",
        responded_at: new Date().toISOString(),
      })),
    );

    // Bump booked_count, flip to "full" when capped
    const newCount = (slot.booked_count ?? 0) + 1;
    await context.supabase
      .from("rp_mentor_slots")
      .update({
        booked_count: newCount,
        status: newCount >= slot.capacity ? "full" : "open",
      })
      .eq("id", slot.id);

    // Notify mentor
    if (mentorProfile) {
      await context.supabase.from("rp_notifications").insert({
        recipient_id: mentorProfile,
        type: "session_booked",
        title: `New 1:1 booked — ${data.topic}`,
        message: `Starts ${new Date(slot.starts_at).toLocaleString()}`,
        action_link: `/rakshak-platform/session/${meeting.id}`,
        related_entity_type: "meeting",
        related_entity_id: meeting.id,
      });
    }
    return { meeting_id: meeting.id, video_room_id: videoRoom };
  });

// ---------- session lookup ----------
export const getSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ meeting_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: meeting } = await context.supabase
      .from("rp_meetings")
      .select(
        "id, title, agenda, scheduled_start, scheduled_end, status, video_room_id, whiteboard_room_id, meeting_link, team_id, slot_id, rp_teams:team_id(team_name)",
      )
      .eq("id", data.meeting_id)
      .maybeSingle();
    if (!meeting) throw new Error("Session not found");
    // Authorization: must be an attendee
    const { data: att } = await context.supabase
      .from("rp_meeting_attendees")
      .select("profile_id")
      .eq("meeting_id", data.meeting_id);
    const allowed = (att ?? []).some((a: any) => a.profile_id === context.userId);
    if (!allowed) {
      // also allow admins
      const { data: roles } = await context.supabase
        .from("rp_user_roles")
        .select("role")
        .eq("user_id", context.userId);
      const isAdmin = (roles ?? []).some((r: any) =>
        ["cfi_admin", "super_admin"].includes(r.role),
      );
      if (!isAdmin) throw new Error("Forbidden — not an attendee");
    }
    const { data: profile } = await context.supabase
      .from("rp_profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    return { meeting, attendees: att ?? [], displayName: profile?.full_name ?? "Guest" };
  });
