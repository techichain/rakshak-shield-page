import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BUCKET = "rp-mentor-resources";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("rp_user_roles")
    .select("role")
    .eq("user_id", userId);
  return (data ?? []).some((r: any) => r.role === "cfi_admin" || r.role === "super_admin");
}

async function isMentor(supabase: any, userId: string) {
  const { data } = await supabase
    .from("rp_user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "mentor")
    .maybeSingle();
  return !!data;
}

async function isMentorOrAdmin(supabase: any, userId: string) {
  const [m, a] = await Promise.all([isMentor(supabase, userId), isAdmin(supabase, userId)]);
  return m || a;
}


// Mentor: get a signed upload URL. Path: {userId}/{uuid}/{safeFilename}
export const getMentorResourceUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ file_name: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isMentorOrAdmin(context.supabase, context.userId))) {
      throw new Error("Forbidden: mentor or admin role required");
    }
    const safe = data.file_name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
    const resourceKey = crypto.randomUUID();
    const path = `${context.userId}/${resourceKey}/${safe}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw error;
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

// Mentor: create a resource row (file already uploaded, or a link).
export const createMentorResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        team_id: z.string().uuid().nullable().optional(),
        kind: z.enum(["file", "link"]),
        external_url: z.string().url().max(2000).optional(),
        file_name: z.string().max(200).optional(),
        file_type: z.string().max(200).optional(),
        file_size: z.number().int().nonnegative().max(100 * 1024 * 1024).optional(),
        storage_path: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isMentor(context.supabase, context.userId))) {
      throw new Error("Forbidden: mentor role required");
    }
    if (data.kind === "link" && !data.external_url) {
      throw new Error("Link URL required");
    }
    if (data.kind === "file" && (!data.storage_path || !data.file_name)) {
      throw new Error("File info required");
    }

    // If team_id given, mentor must own it.
    if (data.team_id) {
      const { data: mentor } = await context.supabase
        .from("rp_mentors")
        .select("id")
        .eq("profile_id", context.userId)
        .maybeSingle();
      if (!mentor) throw new Error("Mentor record not found");
      const { data: team } = await context.supabase
        .from("rp_teams")
        .select("id")
        .eq("id", data.team_id)
        .eq("assigned_mentor_id", mentor.id)
        .maybeSingle();
      if (!team) throw new Error("Team is not assigned to you");
    }

    const { data: row, error } = await context.supabase
      .from("rp_mentor_resources")
      .insert({
        mentor_id: context.userId,
        team_id: data.team_id ?? null,
        title: data.title,
        description: data.description ?? null,
        kind: data.kind,
        external_url: data.external_url ?? null,
        file_name: data.file_name ?? null,
        file_type: data.file_type ?? null,
        file_size: data.file_size ?? null,
        storage_path: data.storage_path ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { resource: row };
  });

export const deleteMentorResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("rp_mentor_resources")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    const admin = await isAdmin(context.supabase, context.userId);
    if (row.mentor_id !== context.userId && !admin) {
      throw new Error("Forbidden");
    }
    if (row.storage_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from(BUCKET).remove([row.storage_path]);
    }
    const { error } = await context.supabase
      .from("rp_mentor_resources")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listMyMentorResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("rp_mentor_resources")
      .select("*, rp_teams:team_id(id, team_name)")
      .eq("mentor_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { resources: data ?? [] };
  });

// For team leaders/members: list all resources visible for their team(s).
// If team_id passed, list for that team. Else, list across all their teams.
export const listTeamResourcesForViewer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ team_id: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let teamIds: string[] = [];
    if (data.team_id) {
      teamIds = [data.team_id];
    } else {
      const [led, memb] = await Promise.all([
        context.supabase.from("rp_teams").select("id").eq("team_leader_id", context.userId),
        context.supabase.from("rp_team_members").select("team_id").eq("profile_id", context.userId),
      ]);
      teamIds = [
        ...(led.data ?? []).map((t: any) => t.id),
        ...(memb.data ?? []).map((t: any) => t.team_id),
      ];
    }
    if (teamIds.length === 0) return { resources: [] };

    // Mentor(s) assigned to those teams
    const { data: teams } = await context.supabase
      .from("rp_teams")
      .select("id, team_name, assigned_mentor_id, rp_mentors:assigned_mentor_id(profile_id)")
      .in("id", teamIds);
    const mentorProfileIds = Array.from(
      new Set(
        (teams ?? [])
          .map((t: any) => t.rp_mentors?.profile_id)
          .filter(Boolean),
      ),
    );

    // Query resources visible to this viewer:
    //   • team_id in their teams (any source — includes team-scoped admin resources)
    //   • global (team_id null) AND authored by one of their teams' mentors
    //   • global (team_id null) AND source='admin' — visible to every team
    const orClauses: string[] = [];
    if (teamIds.length) orClauses.push(`team_id.in.(${teamIds.join(",")})`);
    if (mentorProfileIds.length) {
      orClauses.push(`and(team_id.is.null,mentor_id.in.(${mentorProfileIds.join(",")}))`);
    }
    orClauses.push(`and(team_id.is.null,source.eq.admin)`);
    if (orClauses.length === 0) return { resources: [] };


    const { data: rows, error } = await context.supabase
      .from("rp_mentor_resources")
      .select("*, rp_profiles:mentor_id(full_name), rp_teams:team_id(id, team_name)")
      .or(orClauses.join(","))
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { resources: rows ?? [] };
  });

// Admin: list resources for a specific team (leader/member view uses listTeamResourcesForViewer)
export const listTeamResourcesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ team_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) {
      throw new Error("Forbidden");
    }
    const { data: team } = await context.supabase
      .from("rp_teams")
      .select("id, assigned_mentor_id, rp_mentors:assigned_mentor_id(profile_id)")
      .eq("id", data.team_id)
      .maybeSingle();
    const mentorProfileId = (team as any)?.rp_mentors?.profile_id;
    const orClauses: string[] = [`team_id.eq.${data.team_id}`];
    if (mentorProfileId) {
      orClauses.push(`and(team_id.is.null,mentor_id.eq.${mentorProfileId})`);
    }
    const { data: rows, error } = await context.supabase
      .from("rp_mentor_resources")
      .select("*, rp_profiles:mentor_id(full_name)")
      .or(orClauses.join(","))
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { resources: rows ?? [] };
  });

// Signed download URL — RLS on storage.objects also enforces visibility.
export const getResourceDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("rp_mentor_resources")
      .select("id, storage_path, file_name")
      .eq("id", data.id)
      .maybeSingle();
    if (!row?.storage_path) throw new Error("Not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, 60 * 10, {
        download: row.file_name ?? undefined,
      });
    if (error) throw error;
    return { url: signed.signedUrl };
  });

// Team leader/member: recent mentor feedback across all my teams (top N)
export const listMyRecentFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(20).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const [led, memb] = await Promise.all([
      context.supabase.from("rp_teams").select("id, team_name").eq("team_leader_id", context.userId),
      context.supabase
        .from("rp_team_members")
        .select("rp_teams!inner(id, team_name)")
        .eq("profile_id", context.userId),
    ]);
    const teams = new Map<string, string>();
    for (const t of led.data ?? []) teams.set(t.id, t.team_name);
    for (const r of memb.data ?? []) {
      const t = (r as any).rp_teams;
      if (t) teams.set(t.id, t.team_name);
    }
    if (teams.size === 0) return { feedback: [] };
    const { data: fb, error } = await context.supabase
      .from("rp_feedback")
      .select("id, phase_number, team_id, feedback_text, reviewer_role, created_at, status, rp_profiles:reviewer_id(full_name)")
      .in("team_id", Array.from(teams.keys()))
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 5);
    if (error) throw error;
    const out = (fb ?? []).map((r: any) => ({
      ...r,
      team_name: teams.get(r.team_id) ?? null,
    }));
    return { feedback: out };
  });

/* ─────────────────────────────────────────────────────────────────── */
/* Admin-authored resources                                            */
/* ─────────────────────────────────────────────────────────────────── */

// Admin: create a resource. team_id=null → visible to every team & mentor.
// team_id=<uuid> → scoped to that one team (and its mentor + admins).
export const createAdminResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        team_id: z.string().uuid().nullable().optional(),
        kind: z.enum(["file", "link"]),
        external_url: z.string().url().max(2000).optional(),
        file_name: z.string().max(200).optional(),
        file_type: z.string().max(200).optional(),
        file_size: z.number().int().nonnegative().max(100 * 1024 * 1024).optional(),
        storage_path: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) {
      throw new Error("Forbidden: admin role required");
    }
    if (data.kind === "link" && !data.external_url) {
      throw new Error("Link URL required");
    }
    if (data.kind === "file" && (!data.storage_path || !data.file_name)) {
      throw new Error("File info required");
    }
    // The INSERT RLS policy on rp_mentor_resources requires the caller to
    // hold the 'mentor' role; admins don't, so go through supabaseAdmin.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("rp_mentor_resources")
      .insert({
        mentor_id: context.userId,   // attribution: which admin created it
        team_id: data.team_id ?? null,
        title: data.title,
        description: data.description ?? null,
        kind: data.kind,
        external_url: data.external_url ?? null,
        file_name: data.file_name ?? null,
        file_type: data.file_type ?? null,
        file_size: data.file_size ?? null,
        storage_path: data.storage_path ?? null,
        source: "admin",
      })
      .select("*")
      .single();
    if (error) throw error;
    return { resource: row };
  });

// Admin: list every admin-authored resource for management.
export const listAllAdminResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) {
      throw new Error("Forbidden: admin role required");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("rp_mentor_resources")
      .select("*, rp_profiles:mentor_id(full_name), rp_teams:team_id(id, team_name)")
      .eq("source", "admin")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { resources: data ?? [] };
  });

// Mentor: list admin-authored resources visible to me — either global
// (team_id null) or scoped to one of the teams I'm assigned to.
export const listAdminResourcesForMentor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isMentor(context.supabase, context.userId))) {
      throw new Error("Forbidden: mentor role required");
    }
    const { data: mentorRow } = await context.supabase
      .from("rp_mentors")
      .select("id")
      .eq("profile_id", context.userId)
      .maybeSingle();
    let teamIds: string[] = [];
    if (mentorRow?.id) {
      const { data: myTeams } = await context.supabase
        .from("rp_teams")
        .select("id")
        .eq("assigned_mentor_id", mentorRow.id);
      teamIds = (myTeams ?? []).map((t: any) => t.id);
    }
    const orClauses: string[] = [`and(source.eq.admin,team_id.is.null)`];
    if (teamIds.length) {
      orClauses.push(`and(source.eq.admin,team_id.in.(${teamIds.join(",")}))`);
    }
    const { data: rows, error } = await context.supabase
      .from("rp_mentor_resources")
      .select("*, rp_profiles:mentor_id(full_name), rp_teams:team_id(id, team_name)")
      .or(orClauses.join(","))
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { resources: rows ?? [] };
  });
