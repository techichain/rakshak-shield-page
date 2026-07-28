import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Per-phase evaluator scoring rubric templates (rp_rubric_templates).
 *
 * Admins author a versioned criteria list per phase; evaluators score against
 * it. If no template exists for a phase, the evaluator UI falls back to the
 * legacy rp_rubrics criteria (or freeform scoring).
 */

const CriterionSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(200),
  max_score: z.number().min(0).max(1000),
  weight: z.number().min(0).max(100).default(1),
  description: z.string().max(1000).optional().nullable(),
});

export type RubricCriterion = z.infer<typeof CriterionSchema>;

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("rp_is_admin", { _user_id: userId });
  if (!data) throw new Error("Admin only");
}

export const getRubricForPhase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ phase_number: z.number().int().min(0).max(4) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("rp_rubric_templates")
      .select("*")
      .eq("phase_number", data.phase_number)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1);
    if (error) throw error;
    return { template: (rows ?? [])[0] ?? null };
  });

export const listRubricTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("rp_rubric_templates")
      .select("*")
      .order("phase_number", { ascending: true })
      .order("version", { ascending: false });
    if (error) throw error;
    const byPhase: Record<number, any[]> = {};
    for (const r of rows ?? []) {
      (byPhase[(r as any).phase_number] ??= []).push(r);
    }
    return { templates: rows ?? [], byPhase };
  });

export const saveRubricTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        phase_number: z.number().int().min(0).max(4),
        criteria: z.array(CriterionSchema).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const keys = new Set<string>();
    for (const c of data.criteria) {
      if (keys.has(c.key)) throw new Error(`Duplicate criterion key: ${c.key}`);
      keys.add(c.key);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("rp_rubric_templates")
      .select("id, version")
      .eq("phase_number", data.phase_number)
      .order("version", { ascending: false });

    const nextVersion = ((existing ?? [])[0]?.version ?? 0) + 1;

    if ((existing ?? []).length) {
      await supabaseAdmin
        .from("rp_rubric_templates")
        .update({ is_active: false })
        .eq("phase_number", data.phase_number);
    }

    const { data: row, error } = await supabaseAdmin
      .from("rp_rubric_templates")
      .insert({
        phase_number: data.phase_number,
        version: nextVersion,
        is_active: true,
        criteria: data.criteria as any,
        created_by: context.userId,
      } as any)
      .select("*")
      .single();
    if (error) throw error;
    return { template: row };
  });
