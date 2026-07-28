import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import Papa from "papaparse";

/**
 * Personal profile feature.
 *
 * Bank fields (bank_account_*, bank_ifsc, bank_branch, cancelled_cheque_path)
 * live on rp_profiles, which is readable only by the owner and admins.
 * Everyone else must read `rp_profiles_public`, a bank-free view.
 */

const BUCKET = "rp-submissions";

export const BLOOD_GROUPS = [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-",
] as const;

/** Fields every role must fill in. */
const BASE_REQUIRED = [
  "full_name",
  "email",
  "phone",
  "blood_group",
  "address",
  "bank_account_number",
  "bank_ifsc",
] as const;

type Role = string;

function requiredFieldsForRoles(roles: Role[]): string[] {
  const req = new Set<string>(BASE_REQUIRED);
  if (roles.some((r) => r === "team_leader" || r === "team_member")) req.add("college");
  if (roles.some((r) => r === "mentor" || r === "evaluator")) req.add("organization");
  return [...req];
}

function isFilled(v: unknown) {
  return v !== null && v !== undefined && String(v).trim() !== "";
}

function computeCompletion(profile: Record<string, any> | null, roles: Role[]) {
  const required = requiredFieldsForRoles(roles);
  const missing = required.filter((f) => !isFilled(profile?.[f]));
  const filled = required.length - missing.length;
  return {
    required,
    missing_fields: missing,
    percentage: required.length === 0 ? 100 : Math.round((filled / required.length) * 100),
  };
}

async function rolesFor(supabase: any, userId: string): Promise<Role[]> {
  const { data } = await supabase.from("rp_user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: any) => r.role as string);
}

async function ensureAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("rp_is_admin", { _user_id: userId });
  if (!isAdmin) throw new Error("Forbidden: admin role required");
}

/** The team name for a user: leader of a team, or a member of one. */
async function teamNameFor(supabase: any, userId: string): Promise<string | null> {
  const { data: led } = await supabase
    .from("rp_teams")
    .select("team_name")
    .eq("team_leader_id", userId)
    .limit(1)
    .maybeSingle();
  if (led?.team_name) return led.team_name as string;

  const { data: member } = await supabase
    .from("rp_team_members")
    .select("team_id, rp_teams(team_name)")
    .eq("profile_id", userId)
    .limit(1)
    .maybeSingle();
  return ((member as any)?.rp_teams?.team_name ?? null) as string | null;
}

/** The caller's own full profile row, bank fields included. */
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("rp_profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw error;
    const roles = await rolesFor(context.supabase, context.userId);
    const completion = computeCompletion(data as any, roles);
    const isTeamRole = roles.some((r) => r === "team_leader" || r === "team_member");
    const team_name = isTeamRole ? await teamNameFor(context.supabase, context.userId) : null;
    return {
      profile: data as any,
      roles,
      team_name,
      percentage: completion.percentage,
      missing_fields: completion.missing_fields,
    };
  });


const updateInput = z.object({
  full_name: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  blood_group: z.enum(BLOOD_GROUPS).nullable().optional(),
  address: z.string().trim().max(1000).nullable().optional(),
  college: z.string().trim().max(300).nullable().optional(),
  organization: z.string().trim().max(300).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  state: z.string().trim().max(120).nullable().optional(),
  bank_account_name: z.string().trim().max(200).nullable().optional(),
  bank_account_number: z.string().trim().max(60).nullable().optional(),
  bank_ifsc: z.string().trim().max(20).nullable().optional(),
  bank_branch: z.string().trim().max(200).nullable().optional(),
  cancelled_cheque_path: z.string().trim().max(1000).nullable().optional(),
});

/** Update the caller's own profile and recompute role-aware completion. */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateInput.parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      patch[k] = v === "" ? null : v;
    }

    const { data: current, error: curErr } = await context.supabase
      .from("rp_profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (curErr) throw curErr;
    if (!current) throw new Error("Profile not found");

    if (data.cancelled_cheque_path) {
      if (!data.cancelled_cheque_path.startsWith(`${context.userId}/profile/`)) {
        throw new Error("Invalid cheque storage path");
      }
    }

    const merged = { ...(current as any), ...patch };
    const roles = await rolesFor(context.supabase, context.userId);
    const completion = computeCompletion(merged, roles);
    const complete = completion.missing_fields.length === 0;

    if (complete && !(current as any).profile_completed_at) {
      patch.profile_completed_at = new Date().toISOString();
    } else if (!complete && (current as any).profile_completed_at) {
      patch.profile_completed_at = null;
    }

    const { data: row, error } = await context.supabase
      .from("rp_profiles")
      .update(patch as never)
      .eq("id", context.userId)
      .select("*")
      .single();
    if (error) throw error;

    return {
      profile: row as any,
      roles,
      percentage: completion.percentage,
      missing_fields: completion.missing_fields,
    };
  });

/** Completion status for a user. Self always; admins for anyone. */
export const getProfileCompletion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.user_id !== context.userId) {
      await ensureAdmin(context.supabase, context.userId);
    }
    const { data: row, error } = await context.supabase
      .from("rp_profiles")
      .select("*")
      .eq("id", data.user_id)
      .maybeSingle();
    if (error) throw error;
    const roles = await rolesFor(context.supabase, data.user_id);
    const completion = computeCompletion(row as any, roles);
    return {
      percentage: completion.percentage,
      missing_fields: completion.missing_fields,
      completed_at: ((row as any)?.profile_completed_at ?? null) as string | null,
    };
  });

/** Shared admin fetch: every profile with role + team name + completion. */
async function loadAdminProfiles(
  supabase: any,
  opts: { search?: string; role_filter?: string; completion_filter?: "complete" | "incomplete" },
) {
  let q = supabase.from("rp_profiles").select("*").order("full_name", { ascending: true });
  if (opts.search && opts.search.trim()) {
    const s = opts.search.trim().replace(/[%,]/g, "");
    q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,login_id.ilike.%${s}%`);
  }
  const { data: profiles, error } = await q;
  if (error) throw error;

  const [{ data: roleRows }, { data: teams }, { data: members }] = await Promise.all([
    supabase.from("rp_user_roles").select("user_id, role"),
    supabase.from("rp_teams").select("id, team_name, team_leader_id"),
    supabase.from("rp_team_members").select("team_id, profile_id"),
  ]);

  const rolesByUser = new Map<string, string[]>();
  for (const r of roleRows ?? []) {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.role);
    rolesByUser.set(r.user_id, arr);
  }
  const teamNameById = new Map<string, string>();
  const teamByUser = new Map<string, string>();
  for (const t of teams ?? []) {
    teamNameById.set(t.id, t.team_name);
    if (t.team_leader_id) teamByUser.set(t.team_leader_id, t.team_name);
  }
  for (const m of members ?? []) {
    if (m.profile_id && !teamByUser.has(m.profile_id)) {
      teamByUser.set(m.profile_id, teamNameById.get(m.team_id) ?? "");
    }
  }

  let rows = (profiles ?? []).map((p: any) => {
    const roles = rolesByUser.get(p.id) ?? [];
    const completion = computeCompletion(p, roles);
    return {
      ...p,
      roles,
      role: roles[0] ?? null,
      team_name: teamByUser.get(p.id) ?? null,
      profile_completion_pct: completion.percentage,
      missing_fields: completion.missing_fields,
      is_complete: completion.missing_fields.length === 0,
    };
  });

  if (opts.role_filter) rows = rows.filter((r: any) => r.roles.includes(opts.role_filter));
  if (opts.completion_filter === "complete") rows = rows.filter((r: any) => r.is_complete);
  if (opts.completion_filter === "incomplete") rows = rows.filter((r: any) => !r.is_complete);

  return rows;
}

/** Admin: all profiles, including bank fields, with optional filters. */
export const adminListProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().trim().max(200).optional(),
        role_filter: z.string().trim().max(60).optional(),
        completion_filter: z.enum(["complete", "incomplete"]).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const profiles = await loadAdminProfiles(context.supabase, data);
    return { profiles };
  });

/** Admin: plain-text CSV export of all profiles. */
export const adminExportProfilesCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const profiles = await loadAdminProfiles(context.supabase, {});
    const rows = profiles.map((p: any) => ({
      full_name: p.full_name ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      blood_group: p.blood_group ?? "",
      address: p.address ?? "",
      college: p.college ?? "",
      organization: p.organization ?? "",
      bank_account_name: p.bank_account_name ?? "",
      bank_account_number: p.bank_account_number ?? "",
      bank_ifsc: p.bank_ifsc ?? "",
      bank_branch: p.bank_branch ?? "",
      cancelled_cheque_path: p.cancelled_cheque_path ?? "",
      role: p.role ?? "",
      team_name: p.team_name ?? "",
      profile_completion_pct: p.profile_completion_pct,
    }));
    const csv = Papa.unparse(rows, { header: true });
    return { csv, count: rows.length };
  });

/**
 * Signed upload URL for the caller's own profile folder.
 * Path: `${auth.uid()}/profile/${timestamp}-${safeName}` — matches the
 * storage policy that keys on the leading user-id segment.
 */
export const getProfileUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        file_name: z.string().trim().min(1).max(200),
        mime_type: z.string().trim().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const safe = data.file_name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
    const path = `${context.userId}/profile/${Date.now()}-${safe}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw error;
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

/** Signed download URL for a profile file (cancelled cheque). Self or admin. */
export const getProfileFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ path: z.string().trim().min(1).max(1000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(`${context.userId}/profile/`)) {
      await ensureAdmin(context.supabase, context.userId);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.path, 300);
    if (error) throw error;
    return { url: signed.signedUrl };
  });
