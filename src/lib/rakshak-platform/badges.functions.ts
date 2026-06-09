import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const codeSchema = z.string().min(1).max(64).regex(/^[a-z0-9_]+$/);

/** Public: list active badge catalog. */
export const listBadges = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("rp_badges")
    .select("code, name, description, icon, criteria, sort_order, active")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return { badges: data ?? [] };
});

/** Public: list awarded badges, optionally for one team. */
export const listTeamBadges = createServerFn({ method: "GET" })
  .inputValidator((input: { teamId?: string } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("rp_team_badges")
      .select("id, team_id, badge_code, note, awarded_at, rp_badges(name, description, icon)")
      .order("awarded_at", { ascending: false });
    if (data.teamId) q = q.eq("team_id", data.teamId);
    const { data: rows, error } = await q;
    if (error) throw error;
    return { awards: rows ?? [] };
  });

/** Admin: award a badge to a team. */
export const awardBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; badgeCode: string; note?: string }) =>
    z.object({
      teamId: z.string().uuid(),
      badgeCode: codeSchema,
      note: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: roles } = await supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) =>
      ["cfi_admin", "super_admin"].includes(r.role));
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase.from("rp_team_badges").upsert(
      { team_id: data.teamId, badge_code: data.badgeCode, note: data.note ?? null, awarded_by: context.userId },
      { onConflict: "team_id,badge_code" },
    );
    if (error) throw error;
    return { ok: true };
  });

/** Admin: revoke a badge from a team. */
export const revokeBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; badgeCode: string }) =>
    z.object({ teamId: z.string().uuid(), badgeCode: codeSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: roles } = await supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) =>
      ["cfi_admin", "super_admin"].includes(r.role));
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase
      .from("rp_team_badges")
      .delete()
      .eq("team_id", data.teamId)
      .eq("badge_code", data.badgeCode);
    if (error) throw error;
    return { ok: true };
  });

/** Admin: list teams + their badge counts, for the award screen. */
export const listTeamsForBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("rp_teams")
      .select("id, team_name, college, city, state, cohort_id, rp_cohorts(name)")
      .order("team_name", { ascending: true });
    if (error) throw error;
    return { teams: data ?? [] };
  });
