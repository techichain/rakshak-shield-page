import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const TEAM_UPDATE_TYPES = [
  "exam_schedule",
  "availability",
  "note",
  "other",
] as const;

/** Write access: team members (leader included), or an admin. */
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

/** Read access: the above, plus the team's assigned mentor and evaluators. */
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

/** Everything a team has shared, newest first. */
export const listTeamUpdates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ team_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureTeamRead(context.supabase, context.userId, data.team_id);
    const { data: rows, error } = await context.supabase
      .from("rp_team_updates")
      .select("*")
      .eq("team_id", data.team_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { updates: rows ?? [] };
  });

const updateInput = z.object({
  id: z.string().uuid().optional(),
  team_id: z.string().uuid(),
  update_type: z.enum(TEAM_UPDATE_TYPES),
  title: z.string().trim().min(1).max(400),
  details: z.string().trim().max(8000).nullable().optional(),
  start_date: z.string().trim().max(20).nullable().optional(),
  end_date: z.string().trim().max(20).nullable().optional(),
  file_path: z.string().trim().max(1000).nullable().optional(),
});

/** Create or edit one shared update for a team. */
export const upsertTeamUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensureTeamWrite(context.supabase, context.userId, data.team_id);

    // Storage RLS keys on the leading team-id path segment; keep files inside it.
    if (data.file_path && !data.file_path.startsWith(`${data.team_id}/`)) {
      throw new Error("Invalid storage path for this team");
    }

    const payload = {
      team_id: data.team_id,
      update_type: data.update_type,
      title: data.title,
      details: data.details || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      file_path: data.file_path || null,
    };

    if (data.id) {
      const { data: existing } = await context.supabase
        .from("rp_team_updates")
        .select("id, team_id")
        .eq("id", data.id)
        .maybeSingle();
      if (!existing) throw new Error("Update not found");
      if (existing.team_id !== data.team_id) throw new Error("Forbidden: wrong team");
      const { data: row, error } = await context.supabase
        .from("rp_team_updates")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw error;
      return { update: row };
    }

    const { data: row, error } = await context.supabase
      .from("rp_team_updates")
      .insert({ ...payload, created_by: context.userId })
      .select("*")
      .single();
    if (error) throw error;
    return { update: row };
  });

/** Remove one shared update. */
export const deleteTeamUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("rp_team_updates")
      .select("id, team_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Update not found");
    await ensureTeamWrite(context.supabase, context.userId, row.team_id);
    const { error } = await context.supabase
      .from("rp_team_updates")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
