import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Phase D2 — admin-hosted meetings.
 *
 * Mode A: admins publish bookable slots (rp_mentor_slots with host_type='admin',
 *         mentor_id NULL). Teams book them; booking creates an rp_meetings row
 *         with host_type='admin'. This is a PARALLEL path to the mentor
 *         slot-booking flow — the mentor path and its Google Calendar sync are
 *         untouched. Admin meetings deliberately skip Google Calendar sync
 *         (the sync is keyed on mentor tokens / rp_mentors rows).
 *
 * Mode B: admins broadcast an announcement (rp_announcements) to all teams or a
 *         cohort; every team leader in scope gets an in-app notification.
 */

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("rp_is_admin", { _user_id: userId });
  if (!data) throw new Error("Admin only");
}

function randomRoomId() {
  return "rk-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/* ------------------------------------------------------------------ */
/* MODE A — admin availability slots                                    */
/* ------------------------------------------------------------------ */

export const createAdminSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        starts_at: z.string(),
        ends_at: z.string(),
        capacity: z.number().int().min(1).max(20).default(1),
        notes: z.string().max(400).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (new Date(data.ends_at).getTime() <= new Date(data.starts_at).getTime())
      throw new Error("End time must be after start time.");
    const { data: row, error } = await context.supabase
      .from("rp_mentor_slots")
      .insert({
        mentor_id: null,
        host_type: "admin",
        host_user_id: context.userId,
        starts_at: data.starts_at,
        ends_at: data.ends_at,
        capacity: data.capacity,
        notes: data.notes ?? null,
        created_by: context.userId,
        status: "open",
      } as any)
      .select("*")
      .single();
    if (error) throw error;
    return { slot: row };
  });

export const listMyAdminSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: slots } = await supabaseAdmin
      .from("rp_mentor_slots")
      .select("*")
      .eq("host_type", "admin")
      .eq("host_user_id", context.userId)
      .order("starts_at", { ascending: false })
      .limit(100);
    const ids = (slots ?? []).map((s: any) => s.id);
    const { data: bookings } = ids.length
      ? await supabaseAdmin
          .from("rp_meetings")
          .select(
            "id, title, agenda, scheduled_start, scheduled_end, status, video_room_id, slot_id, rp_teams:team_id(team_name)",
          )
          .in("slot_id", ids)
          .order("scheduled_start", { ascending: true })
      : { data: [] as any[] };
    return { slots: slots ?? [], bookings: bookings ?? [] };
  });

export const cancelAdminSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slot_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("rp_mentor_slots")
      .update({ status: "cancelled" })
      .eq("id", data.slot_id)
      .eq("host_type", "admin")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!updated) throw new Error("Admin slot not found.");
    return { ok: true };
  });

/** Team side: every open, future admin slot. */
export const listOpenAdminSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: slots, error } = await supabaseAdmin
      .from("rp_mentor_slots")
      .select("id, starts_at, ends_at, capacity, booked_count, status, notes, host_user_id")
      .eq("host_type", "admin")
      .eq("status", "open")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(50);
    if (error) throw error;
    const hostIds = Array.from(
      new Set((slots ?? []).map((s: any) => s.host_user_id).filter(Boolean)),
    );
    const { data: hosts } = hostIds.length
      ? await supabaseAdmin.from("rp_profiles").select("id, full_name").in("id", hostIds)
      : { data: [] as any[] };
    const nameById = new Map((hosts ?? []).map((h: any) => [h.id, h.full_name]));

    // The caller's team (leader or member), so the UI can pre-fill it.
    const { data: ledTeam } = await context.supabase
      .from("rp_teams")
      .select("id, team_name")
      .eq("team_leader_id", context.userId)
      .maybeSingle();
    let team = ledTeam ?? null;
    if (!team) {
      const { data: m } = await context.supabase
        .from("rp_team_members")
        .select("team_id, rp_teams:team_id(id, team_name)")
        .eq("profile_id", context.userId)
        .maybeSingle();
      team = (m as any)?.rp_teams ?? null;
    }

    return {
      slots: (slots ?? []).map((s: any) => ({
        ...s,
        host_name: nameById.get(s.host_user_id) ?? "Programme team",
      })),
      team,
    };
  });

export const bookAdminSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slot_id: z.string().uuid(),
        team_id: z.string().uuid(),
        topic: z.string().min(1).max(200),
        notes: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Only the team leader may book on behalf of the team.
    const { data: team } = await context.supabase
      .from("rp_teams")
      .select("id, team_name, team_leader_id")
      .eq("id", data.team_id)
      .maybeSingle();
    if (!team) throw new Error("Team not found");
    if (team.team_leader_id !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("rp_is_admin", {
        _user_id: context.userId,
      });
      if (!isAdmin) throw new Error("Only the team leader can book a programme-team meeting.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: slot } = await supabaseAdmin
      .from("rp_mentor_slots")
      .select("*")
      .eq("id", data.slot_id)
      .eq("host_type", "admin")
      .maybeSingle();
    if (!slot) throw new Error("Slot not found");
    if (slot.status !== "open") throw new Error("This slot is no longer open.");
    if ((slot.booked_count ?? 0) >= slot.capacity)
      throw new Error("This slot is already fully booked.");

    const videoRoom = randomRoomId();
    const whiteboardRoom = randomRoomId();
    const hostId = (slot as any).host_user_id as string | null;

    const { data: meeting, error: mErr } = await supabaseAdmin
      .from("rp_meetings")
      .insert({
        team_id: data.team_id,
        mentor_id: null,
        meeting_type: "other",
        host_type: "admin",
        host_user_id: hostId,
        title: data.topic,
        agenda: data.notes ?? "",
        scheduled_start: slot.starts_at,
        scheduled_end: slot.ends_at,
        status: "confirmed",
        created_by: context.userId,
        slot_id: slot.id,
        video_room_id: videoRoom,
        whiteboard_room_id: whiteboardRoom,
        meeting_link: `https://meet.jit.si/${videoRoom}`,
      } as any)
      .select("*")
      .single();
    if (mErr) throw mErr;

    const attendees = new Set<string>([context.userId]);
    if (hostId) attendees.add(hostId);
    await supabaseAdmin.from("rp_meeting_attendees").insert(
      Array.from(attendees).map((pid) => ({
        meeting_id: meeting.id,
        profile_id: pid,
        rsvp: "going",
        responded_at: new Date().toISOString(),
      })),
    );

    const newCount = (slot.booked_count ?? 0) + 1;
    await supabaseAdmin
      .from("rp_mentor_slots")
      .update({
        booked_count: newCount,
        status: newCount >= slot.capacity ? "full" : "open",
      })
      .eq("id", slot.id);

    if (hostId) {
      await supabaseAdmin.from("rp_notifications").insert({
        recipient_id: hostId,
        type: "session_booked",
        title: `${team.team_name} booked a programme-team meeting`,
        message: `${data.topic} · starts ${new Date(slot.starts_at).toLocaleString("en-IN")}`,
        action_link: `/rakshak-platform/session/${meeting.id}`,
        related_entity_type: "meeting",
        related_entity_id: meeting.id,
      });
    }

    // NOTE: no Google Calendar sync for admin-hosted meetings (mentor-specific flow).
    return { meeting_id: meeting.id, video_room_id: videoRoom };
  });

/* ------------------------------------------------------------------ */
/* MODE B — announcements to all teams                                  */
/* ------------------------------------------------------------------ */

export const createAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["admin_meeting", "expert_session"]),
        cohort_id: z.string().uuid().nullable().optional(),
        title: z.string().min(1).max(200),
        description: z.string().max(4000).optional(),
        host_name: z.string().max(200).optional(),
        scheduled_start: z.string().nullable().optional(),
        scheduled_end: z.string().nullable().optional(),
        meeting_link: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("rp_announcements")
      .insert({
        kind: data.kind,
        cohort_id: data.cohort_id ?? null,
        title: data.title,
        description: data.description ?? null,
        host_name: data.host_name ?? null,
        scheduled_start: data.scheduled_start || null,
        scheduled_end: data.scheduled_end || null,
        meeting_link: data.meeting_link || null,
        created_by: context.userId,
      } as any)
      .select("*")
      .single();
    if (error) throw error;

    // In-app notification to every team leader in scope (email is Phase E).
    let q = supabaseAdmin.from("rp_teams").select("id, team_leader_id, cohort_id");
    if (data.cohort_id) q = q.eq("cohort_id", data.cohort_id);
    const { data: teams } = await q;
    const leaderIds = Array.from(
      new Set((teams ?? []).map((t: any) => t.team_leader_id).filter(Boolean)),
    );
    if (leaderIds.length) {
      await supabaseAdmin.from("rp_notifications").insert(
        leaderIds.map((pid) => ({
          recipient_id: pid,
          type: "announcement",
          title:
            data.kind === "expert_session"
              ? `Expert session: ${data.title}`
              : `Programme meeting: ${data.title}`,
          message: data.scheduled_start
            ? `Starts ${new Date(data.scheduled_start).toLocaleString("en-IN")}`
            : (data.description ?? ""),
          action_link: "/rakshak-platform/team",
          related_entity_type: "announcement",
          related_entity_id: row.id,
        })),
      );
    }

    return { announcement: row, notified: leaderIds.length };
  });

export const listAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ upcoming_only: z.boolean().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("rp_announcements")
      .select("*")
      .order("scheduled_start", { ascending: true, nullsFirst: false })
      .limit(100);
    if (data.upcoming_only) {
      q = q.or(
        `scheduled_start.is.null,scheduled_start.gte.${new Date(Date.now() - 2 * 3600_000).toISOString()}`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return { announcements: rows ?? [] };
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("rp_announcements")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
