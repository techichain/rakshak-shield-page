import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("rp_is_admin", { _user_id: userId });
  if (!data) throw new Error("Admin only");
}

const PHASES = [0, 1, 2, 3, 4];

export const getCohortPhaseSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cohort_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("rp_cohort_phase_schedule")
      .select("phase_number, starts_on, deadline")
      .eq("cohort_id", data.cohort_id);
    if (error) throw error;

    const byPhase = new Map<number, any>((rows ?? []).map((r: any) => [Number(r.phase_number), r]));
    return {
      rows: PHASES.map((phase_number) => ({
        phase_number,
        starts_on: byPhase.get(phase_number)?.starts_on ?? null,
        deadline: byPhase.get(phase_number)?.deadline ?? null,
      })),
    };
  });

export const saveCohortPhaseSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cohort_id: z.string().uuid(),
        rows: z
          .array(
            z.object({
              phase_number: z.number().int().min(0).max(4),
              starts_on: z.string().nullable().optional(),
              deadline: z.string().nullable().optional(),
            }),
          )
          .max(5),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = data.rows.map((r) => ({
      cohort_id: data.cohort_id,
      phase_number: r.phase_number,
      starts_on: r.starts_on || null,
      deadline: r.deadline ? new Date(r.deadline).toISOString() : null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from("rp_cohort_phase_schedule")
      .upsert(payload, { onConflict: "cohort_id,phase_number" });
    if (error) throw error;

    // Propagate the new deadlines to every team in this cohort (cohort-wide overwrite).
    const { data: teams } = await supabaseAdmin
      .from("rp_teams")
      .select("id")
      .eq("cohort_id", data.cohort_id);
    const teamIds = (teams ?? []).map((t: any) => t.id);

    if (teamIds.length) {
      for (const row of payload) {
        await supabaseAdmin
          .from("rp_team_phase_progress")
          .update({ deadline: row.deadline })
          .eq("phase_number", row.phase_number)
          .in("team_id", teamIds);
      }
    }

    return { ok: true, phases_saved: payload.length, teams_updated: teamIds.length };
  });
