import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Site media gallery — photos and videos for one team.
 * Rows live in rp_location_photos; location_id is optional so media can be
 * attached to the team as a whole. Files live in the existing rp-submissions
 * bucket under `${team_id}/media/...`.
 */

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

/** Every photo and video for a team, newest first, plus the team's locations. */
export const listTeamMedia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ team_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureTeamRead(context.supabase, context.userId, data.team_id);

    const [{ data: items, error }, { data: locations }] = await Promise.all([
      context.supabase
        .from("rp_location_photos")
        .select("*")
        .eq("team_id", data.team_id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("rp_locations")
        .select("id, location_name")
        .eq("team_id", data.team_id)
        .order("created_at", { ascending: false }),
    ]);
    if (error) throw error;
    return { items: items ?? [], locations: locations ?? [] };
  });

/** Register one uploaded photo or video against the team. */
export const addTeamMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        team_id: z.string().uuid(),
        location_id: z.string().uuid().nullable().optional(),
        phase_number: z.number().int().min(0).max(4).nullable().optional(),
        media_type: z.enum(["photo", "video"]),
        file_name: z.string().trim().min(1).max(400),
        storage_path: z.string().trim().min(1).max(1000),
        mime_type: z.string().trim().max(200).nullable().optional(),
        file_size: z.number().int().nonnegative().nullable().optional(),
        caption: z.string().trim().max(2000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureTeamWrite(context.supabase, context.userId, data.team_id);
    // Storage RLS keys on the leading team-id path segment; keep files inside it.
    if (!data.storage_path.startsWith(`${data.team_id}/`)) {
      throw new Error("Invalid storage path for this team");
    }
    if (data.location_id) {
      const { data: loc } = await context.supabase
        .from("rp_locations")
        .select("id, team_id")
        .eq("id", data.location_id)
        .maybeSingle();
      if (!loc || loc.team_id !== data.team_id) throw new Error("Forbidden: wrong team location");
    }

    const { data: row, error } = await context.supabase
      .from("rp_location_photos")
      .insert({
        team_id: data.team_id,
        location_id: data.location_id ?? null,
        phase_number: data.phase_number ?? null,
        media_type: data.media_type,
        file_name: data.file_name,
        storage_path: data.storage_path,
        mime_type: data.mime_type || null,
        file_size: data.file_size ?? null,
        caption: data.caption || null,
        uploaded_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { item: row };
  });

/** Edit the caption, linked location or phase of one media item. */
export const updateTeamMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        caption: z.string().trim().max(2000).nullable().optional(),
        location_id: z.string().uuid().nullable().optional(),
        phase_number: z.number().int().min(0).max(4).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("rp_location_photos")
      .select("id, team_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing) throw new Error("Media not found");
    await ensureTeamWrite(context.supabase, context.userId, existing.team_id);

    const patch: {
      caption?: string | null;
      location_id?: string | null;
      phase_number?: number | null;
    } = {};
    if (data.caption !== undefined) patch.caption = data.caption || null;
    if (data.location_id !== undefined) patch.location_id = data.location_id || null;
    if (data.phase_number !== undefined) patch.phase_number = data.phase_number ?? null;


    const { data: row, error } = await context.supabase
      .from("rp_location_photos")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return { item: row };
  });

/** Remove one media item from the gallery. */
export const deleteTeamMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("rp_location_photos")
      .select("id, team_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing) throw new Error("Media not found");
    await ensureTeamWrite(context.supabase, context.userId, existing.team_id);
    const { error } = await context.supabase
      .from("rp_location_photos")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
