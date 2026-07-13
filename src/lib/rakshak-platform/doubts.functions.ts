import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------- helpers ----------
async function resolveTeamMembership(supabase: any, userId: string, teamId: string) {
  const { data: team } = await supabase
    .from("rp_teams")
    .select("id, team_name, team_leader_id, assigned_mentor_id, rp_mentors:assigned_mentor_id(profile_id)")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) throw new Error("Team not found");
  const isLeader = team.team_leader_id === userId;
  let isMember = isLeader;
  if (!isMember) {
    const { data: m } = await supabase
      .from("rp_team_members")
      .select("id")
      .eq("team_id", teamId)
      .eq("profile_id", userId)
      .maybeSingle();
    isMember = !!m;
  }
  const mentorProfileId = (team as any).rp_mentors?.profile_id ?? null;
  const isMentor = mentorProfileId != null && mentorProfileId === userId;
  return { team, isLeader, isMember, isMentor, mentorProfileId };
}

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("rp_user_roles")
    .select("role")
    .eq("user_id", userId);
  return (data ?? []).some((r: any) => r.role === "cfi_admin" || r.role === "super_admin");
}

// ---------- createDoubt ----------
export const createDoubt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      team_id: z.string().uuid(),
      question: z.string().min(3).max(2000),
      phase_number: z.number().int().min(0).max(4).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { team, isLeader, isMember, mentorProfileId } = await resolveTeamMembership(
      context.supabase,
      context.userId,
      data.team_id,
    );
    if (!isMember) throw new Error("Forbidden: not a member of this team");

    const posted_by_role = isLeader ? "team_leader" : "team_member";
    const { data: inserted, error } = await context.supabase
      .from("rp_doubts")
      .insert({
        team_id: data.team_id,
        phase_number: data.phase_number ?? null,
        posted_by: context.userId,
        posted_by_role,
        question: data.question.trim(),
      })
      .select("*")
      .single();
    if (error) throw error;

    // notify mentor + admins (best-effort)
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: adminRows } = await supabaseAdmin
        .from("rp_user_roles")
        .select("user_id")
        .in("role", ["cfi_admin", "super_admin"]);
      const recipients = new Set<string>();
      (adminRows ?? []).forEach((a: any) => recipients.add(a.user_id));
      if (mentorProfileId) recipients.add(mentorProfileId);
      const notifRows = Array.from(recipients)
        .filter((id) => id !== context.userId)
        .map((rid) => ({
          recipient_id: rid,
          type: "doubt_created",
          title: `New doubt from ${(team as any).team_name}`,
          message: data.question.slice(0, 200),
          action_link: mentorProfileId === rid
            ? "/rakshak-platform/mentor"
            : "/rakshak-platform/admin/doubts",
          related_entity_type: "rp_doubts",
          related_entity_id: inserted.id,
        }));
      if (notifRows.length) await supabaseAdmin.from("rp_notifications").insert(notifRows);
    } catch (e) {
      console.error("[doubts] notify failed", e);
    }

    return { doubt: inserted };
  });

// ---------- listTeamDoubts ----------
export const listTeamDoubts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ team_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { isMember, isMentor } = await resolveTeamMembership(
      context.supabase,
      context.userId,
      data.team_id,
    );
    const admin = isMember || isMentor ? false : await isAdmin(context.supabase, context.userId);
    if (!isMember && !isMentor && !admin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doubts, error } = await supabaseAdmin
      .from("rp_doubts")
      .select("*, rp_teams:team_id(team_name)")
      .eq("team_id", data.team_id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const posterIds = Array.from(new Set((doubts ?? []).map((d: any) => d.posted_by).filter(Boolean)));
    const resolverIds = Array.from(new Set((doubts ?? []).map((d: any) => d.resolved_by).filter(Boolean)));
    const ids = Array.from(new Set([...posterIds, ...resolverIds]));
    let nameMap: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("rp_profiles")
        .select("id, full_name")
        .in("id", ids);
      nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name ?? "Member"]));
      // fill any missing via rp_team_members email/name
      const missing = ids.filter((i) => !nameMap[i]);
      if (missing.length) {
        const { data: mem } = await supabaseAdmin
          .from("rp_team_members")
          .select("profile_id, full_name")
          .in("profile_id", missing);
        for (const m of mem ?? []) {
          if (m.profile_id && m.full_name) nameMap[m.profile_id] = m.full_name;
        }
      }
    }

    return {
      doubts: (doubts ?? []).map((d: any) => ({
        ...d,
        team_name: d.rp_teams?.team_name ?? "Team",
        posted_by_name: nameMap[d.posted_by] ?? "Member",
        resolved_by_name: d.resolved_by ? (nameMap[d.resolved_by] ?? "Reviewer") : null,
      })),
    };
  });

// ---------- resolveDoubt ----------
export const resolveDoubt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      doubt_id: z.string().uuid(),
      resolution_text: z.string().min(1).max(4000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("rp_doubts")
      .select("id, team_id, posted_by, question")
      .eq("id", data.doubt_id)
      .maybeSingle();
    if (!existing) throw new Error("Doubt not found");

    const { isMentor } = await resolveTeamMembership(
      context.supabase,
      context.userId,
      existing.team_id,
    );
    const admin = isMentor ? false : await isAdmin(context.supabase, context.userId);
    if (!isMentor && !admin) throw new Error("Forbidden: mentor or admin only");

    const { data: updated, error } = await supabaseAdmin
      .from("rp_doubts")
      .update({
        status: "resolved",
        resolved_by: context.userId,
        resolution_text: data.resolution_text.trim(),
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.doubt_id)
      .select("*")
      .single();
    if (error) throw error;

    // notify original poster + other teammates/leader
    try {
      const { data: team } = await supabaseAdmin
        .from("rp_teams")
        .select("id, team_name, team_leader_id")
        .eq("id", existing.team_id)
        .maybeSingle();
      const { data: mates } = await supabaseAdmin
        .from("rp_team_members")
        .select("profile_id")
        .eq("team_id", existing.team_id);
      const recipients = new Set<string>();
      recipients.add(existing.posted_by);
      if (team?.team_leader_id) recipients.add(team.team_leader_id);
      for (const m of mates ?? []) if (m.profile_id) recipients.add(m.profile_id);
      recipients.delete(context.userId);
      const rows = Array.from(recipients).map((rid) => ({
        recipient_id: rid,
        type: "doubt_resolved",
        title: `Doubt resolved — ${team?.team_name ?? "your team"}`,
        message: data.resolution_text.slice(0, 200),
        action_link: "/rakshak-platform/team",
        related_entity_type: "rp_doubts",
        related_entity_id: data.doubt_id,
      }));
      if (rows.length) await supabaseAdmin.from("rp_notifications").insert(rows);
    } catch (e) {
      console.error("[doubts] resolve notify failed", e);
    }

    return { doubt: updated };
  });

// ---------- listPendingDoubtsForResolver ----------
// Mentors: pending doubts across their assigned teams. Admins: all pending.
export const listPendingDoubtsForResolver = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await isAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let teamIds: string[] | null = null;
    if (!admin) {
      // mentor path — find assigned teams
      const { data: mentor } = await supabaseAdmin
        .from("rp_mentors")
        .select("id")
        .eq("profile_id", context.userId)
        .maybeSingle();
      if (!mentor) return { doubts: [], scope: "mentor" as const };
      const { data: teams } = await supabaseAdmin
        .from("rp_teams")
        .select("id")
        .eq("assigned_mentor_id", mentor.id);
      teamIds = (teams ?? []).map((t: any) => t.id);
      if (!teamIds.length) return { doubts: [], scope: "mentor" as const };
    }

    let q = supabaseAdmin
      .from("rp_doubts")
      .select("*, rp_teams:team_id(team_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (teamIds) q = q.in("team_id", teamIds);
    const { data: doubts, error } = await q;
    if (error) throw error;

    const posterIds = Array.from(new Set((doubts ?? []).map((d: any) => d.posted_by).filter(Boolean)));
    let nameMap: Record<string, string> = {};
    if (posterIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("rp_profiles")
        .select("id, full_name")
        .in("id", posterIds);
      nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name ?? "Member"]));
    }

    return {
      scope: admin ? ("admin" as const) : ("mentor" as const),
      doubts: (doubts ?? []).map((d: any) => ({
        ...d,
        team_name: d.rp_teams?.team_name ?? "Team",
        posted_by_name: nameMap[d.posted_by] ?? "Member",
      })),
    };
  });

// ---------- listAllDoubts (admin) — pending + resolved ----------
export const listAllDoubts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await isAdmin(context.supabase, context.userId);
    if (!admin) throw new Error("Forbidden: admin only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doubts, error } = await supabaseAdmin
      .from("rp_doubts")
      .select("*, rp_teams:team_id(team_name)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const ids = Array.from(
      new Set(
        (doubts ?? []).flatMap((d: any) => [d.posted_by, d.resolved_by]).filter(Boolean),
      ),
    );
    let nameMap: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("rp_profiles")
        .select("id, full_name")
        .in("id", ids);
      nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name ?? "Member"]));
    }

    return {
      doubts: (doubts ?? []).map((d: any) => ({
        ...d,
        team_name: d.rp_teams?.team_name ?? "Team",
        posted_by_name: nameMap[d.posted_by] ?? "Member",
        resolved_by_name: d.resolved_by ? (nameMap[d.resolved_by] ?? "Reviewer") : null,
      })),
    };
  });
