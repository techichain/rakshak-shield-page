import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ReportInput = z.object({
  id: z.string().uuid().optional(),
  team_id: z.string().uuid(),
  location_id: z.string().uuid().optional().nullable(),
  authority_name: z.string().min(1).max(200),
  authority_category: z.enum(["nhai", "state_pwd", "municipal", "dev_auth", "police", "other"]),
  contact_person: z.string().max(120).optional().nullable(),
  contact_email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  contact_phone: z.string().max(40).optional().nullable(),
  subject: z.string().min(1).max(240),
  message: z.string().max(8000).default(""),
  attachment_url: z.string().url().max(500).optional().nullable(),
  status: z.enum(["draft", "sent", "acknowledged", "actioned", "closed"]).default("draft"),
  implementation_status: z
    .enum(["not_started", "in_progress", "completed", "rejected"])
    .nullable()
    .optional(),
  implementation_notes: z.string().max(8000).nullable().optional(),
  approval_letter_url: z.string().max(1000).nullable().optional(),
});

export const IMPLEMENTATION_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "rejected",
] as const;

/** Write access for authority engagement: team members (leader included) or admin. */
async function ensureTeamWrite(supabase: any, userId: string, teamId: string) {
  const { data: t } = await supabase
    .from("rp_teams")
    .select("id, team_leader_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!t) throw new Error("Team not found");
  if (t.team_leader_id === userId) return;
  const { data: m } = await supabase
    .from("rp_team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("profile_id", userId)
    .maybeSingle();
  if (m) return;
  const { data: isAdmin } = await supabase.rpc("rp_is_admin", { _user_id: userId });
  if (isAdmin) return;
  throw new Error("Forbidden: not a team member");
}

/** Read access: the above, plus the team's mentor and evaluators. */
async function ensureTeamRead(supabase: any, userId: string, teamId: string) {
  const [{ data: isMember }, { data: isMentor }, { data: isAdmin }, { data: isEvaluator }] =
    await Promise.all([
      supabase.rpc("rp_is_team_member", { _team: teamId, _user: userId }),
      supabase.rpc("rp_is_team_mentor", { _team: teamId, _user: userId }),
      supabase.rpc("rp_is_admin", { _user_id: userId }),
      supabase.rpc("rp_has_role", { _user_id: userId, _role: "evaluator" }),
    ]);
  if (isMember || isMentor || isAdmin || isEvaluator) return;
  throw new Error("Forbidden: no access to this team");
}

/**
 * Read-only engagement view for one team: each authority report with its
 * implementation status and its dated update timeline. Used by the team page
 * and, in readOnly mode, by mentor and admin team detail pages.
 */
export const getTeamAuthorityEngagement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ team_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureTeamRead(context.supabase, context.userId, data.team_id);

    const { data: reports, error } = await context.supabase
      .from("rp_authority_reports")
      .select(
        "id, team_id, subject, authority_name, authority_category, status, sent_at, response_status, response_at, implementation_status, implementation_notes, approval_letter_url",
      )
      .eq("team_id", data.team_id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const { data: updates, error: uErr } = await context.supabase
      .from("rp_authority_updates")
      .select("*")
      .eq("team_id", data.team_id)
      .order("created_at", { ascending: false });
    if (uErr) throw uErr;

    const byReport = new Map<string, any[]>();
    for (const u of updates ?? []) {
      const arr = byReport.get(u.report_id) ?? [];
      arr.push(u);
      byReport.set(u.report_id, arr);
    }

    return {
      reports: (reports ?? []).map((r: any) => ({ ...r, updates: byReport.get(r.id) ?? [] })),
    };
  });

/** Team sets implementation status / notes / approval letter on one report. */
export const setImplementationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        report_id: z.string().uuid(),
        implementation_status: z
          .enum(["not_started", "in_progress", "completed", "rejected"])
          .nullable()
          .optional(),
        implementation_notes: z.string().max(8000).nullable().optional(),
        approval_letter_url: z.string().max(1000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rep } = await context.supabase
      .from("rp_authority_reports")
      .select("id, team_id")
      .eq("id", data.report_id)
      .maybeSingle();
    if (!rep) throw new Error("Report not found");
    await ensureTeamWrite(context.supabase, context.userId, rep.team_id);

    const patch: {
      implementation_status?: string | null;
      implementation_notes?: string | null;
      approval_letter_url?: string | null;
    } = {};
    if (data.implementation_status !== undefined) {
      patch.implementation_status = data.implementation_status ?? null;
    }
    if (data.implementation_notes !== undefined) {
      patch.implementation_notes = data.implementation_notes || null;
    }
    if (data.approval_letter_url !== undefined) {
      if (data.approval_letter_url && !data.approval_letter_url.startsWith(`${rep.team_id}/`)) {
        throw new Error("Invalid storage path for this team");
      }
      patch.approval_letter_url = data.approval_letter_url || null;
    }

    const { data: row, error } = await context.supabase
      .from("rp_authority_reports")
      .update(patch)
      .eq("id", data.report_id)
      .select("*")
      .single();
    if (error) throw error;
    return { report: row };
  });

/** Post a dated progress update against one authority report. */
export const addAuthorityUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        report_id: z.string().uuid(),
        update_text: z.string().trim().min(1).max(8000),
        status: z.string().trim().max(80).nullable().optional(),
        file_path: z.string().trim().max(1000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rep } = await context.supabase
      .from("rp_authority_reports")
      .select("id, team_id")
      .eq("id", data.report_id)
      .maybeSingle();
    if (!rep) throw new Error("Report not found");
    await ensureTeamWrite(context.supabase, context.userId, rep.team_id);
    if (data.file_path && !data.file_path.startsWith(`${rep.team_id}/`)) {
      throw new Error("Invalid storage path for this team");
    }

    const { data: row, error } = await context.supabase
      .from("rp_authority_updates")
      .insert({
        report_id: data.report_id,
        team_id: rep.team_id,
        update_text: data.update_text,
        status: data.status || null,
        file_path: data.file_path || null,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { update: row };
  });

/** Remove one update from a report's timeline. */
export const deleteAuthorityUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: u } = await context.supabase
      .from("rp_authority_updates")
      .select("id, team_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!u) throw new Error("Update not found");
    await ensureTeamWrite(context.supabase, context.userId, u.team_id);
    const { error } = await context.supabase
      .from("rp_authority_updates")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });


export const upsertAuthorityReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReportInput.parse(d))
  .handler(async ({ data, context }) => {
    // Verify caller is a member/leader of the target team (or an admin).
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) =>
      ["cfi_admin", "super_admin"].includes(r.role));

    if (!isAdmin) {
      const { data: team } = await context.supabase
        .from("rp_teams").select("id, team_leader_id").eq("id", data.team_id).maybeSingle();
      if (!team) throw new Error("Team not found");
      let allowed = team.team_leader_id === context.userId;
      if (!allowed) {
        const { data: m } = await context.supabase
          .from("rp_team_members").select("id")
          .eq("team_id", data.team_id).eq("profile_id", context.userId).maybeSingle();
        allowed = !!m;
      }
      if (!allowed) throw new Error("Forbidden: not a member of this team");
    }

    // On update, ensure the existing report belongs to the supplied team.
    if (data.id) {
      const { data: existing } = await context.supabase
        .from("rp_authority_reports").select("id, team_id").eq("id", data.id).maybeSingle();
      if (!existing) throw new Error("Report not found");
      if (existing.team_id !== data.team_id) throw new Error("Forbidden: team mismatch");
    }

    const payload: any = { ...data, created_by: context.userId };
    if (data.status === "sent" && !data.id) payload.sent_at = new Date().toISOString();
    const { data: row, error } = await context.supabase
      .from("rp_authority_reports")
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return { report: row };
  });

export const recordAuthorityResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      response_status: z.enum(["acknowledged", "actioned", "rejected", "closed"]),
      response_text: z.string().max(8000).optional(),
      response_attachment_url: z.string().url().max(500).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const ok = (roles ?? []).some((r: any) =>
      ["authority", "cfi_admin", "super_admin"].includes(r.role));
    if (!ok) throw new Error("Forbidden");
    const { data: row, error } = await context.supabase
      .from("rp_authority_reports")
      .update({
        response_status: data.response_status,
        response_text: data.response_text ?? null,
        response_attachment_url: data.response_attachment_url ?? null,
        response_at: new Date().toISOString(),
        status: data.response_status === "closed" ? "closed" : "acknowledged",
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;
    return { report: row };
  });

export const listTeamReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { teamId: string }) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Restrict to admins OR members/leader/mentor of the team.
    const { data: isAdminData } = await context.supabase.rpc("rp_is_admin", { _user_id: context.userId });
    let allowed = !!isAdminData;
    if (!allowed) {
      const { data: onTeam } = await context.supabase.rpc("rp_is_team_member", {
        _team: data.teamId,
        _user: context.userId,
      });
      allowed = !!onTeam;
    }
    if (!allowed) {
      const { data: onMentor } = await context.supabase.rpc("rp_is_team_mentor", {
        _team: data.teamId,
        _user: context.userId,
      });
      allowed = !!onMentor;
    }
    if (!allowed) throw new Error("Forbidden");

    const { data: rows, error } = await context.supabase
      .from("rp_authority_reports")
      .select("*")
      .eq("team_id", data.teamId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { reports: rows ?? [] };
  });

export const getAuthorityInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isAdmin = roleSet.has("cfi_admin") || roleSet.has("super_admin");
    const isAuthority = roleSet.has("authority");
    if (!isAdmin && !isAuthority) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Authority callers are scoped to their jurisdiction_states.
    // Admins see everything. No SELECT * — explicit safe columns only.
    let jurisdictionStates: string[] | null = null;
    if (!isAdmin && isAuthority) {
      const { data: profile } = await supabaseAdmin
        .from("rp_profiles")
        .select("jurisdiction_states")
        .eq("id", context.userId)
        .maybeSingle();
      jurisdictionStates = (profile?.jurisdiction_states as string[] | null) ?? [];
    }

    const q = (supabaseAdmin as any)
      .from("rp_authority_reports")
      .select(
        "id, team_id, location_id, authority_name, authority_category, subject, message, status, sent_at, response_status, response_at, response_text, rp_teams(team_name, city, state), rp_locations(location_name, latitude, longitude, severity)",
      )
      .in("status", ["sent", "acknowledged", "actioned"])
      .order("sent_at", { ascending: false, nullsFirst: false })
      .limit(200);

    const { data: rawReports, error } = await q;
    if (error) throw error;

    // Post-filter by jurisdiction (cross-table filter via FK can't use .in() reliably).
    const reports =
      jurisdictionStates && jurisdictionStates.length > 0
        ? (rawReports ?? []).filter((r: any) => {
            const st = r.rp_teams?.state;
            return st && jurisdictionStates!.includes(st);
          })
        : isAdmin
          ? rawReports ?? []
          : []; // authority with empty jurisdiction sees nothing

    let hotspotsQuery = supabaseAdmin
      .from("rp_locations")
      .select("id, location_name, city, state, latitude, longitude, severity, issue_type, is_final_selected")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (!isAdmin && jurisdictionStates && jurisdictionStates.length > 0) {
      hotspotsQuery = hotspotsQuery.in("state", jurisdictionStates);
    } else if (!isAdmin) {
      // authority with empty jurisdiction → no hotspots
      return { reports, hotspots: [] };
    }
    const { data: hotspots } = await hotspotsQuery;
    return { reports, hotspots: hotspots ?? [] };
  });
