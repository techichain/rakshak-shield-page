import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("rp_user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.some((r: string) => r === "cfi_admin" || r === "super_admin")) {
    throw new Error("Admin access required");
  }
}

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

export type AnalyticsSettings = {
  hazard_states: string[] | null;
  hazard_severities: string[] | null;
};

export const getAnalyticsSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AnalyticsSettings> => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await (context.supabase as any)
      .from("rp_analytics_settings")
      .select("hazard_states, hazard_severities")
      .eq("id", 1)
      .maybeSingle();
    return {
      hazard_states: data?.hazard_states ?? null,
      hazard_severities: data?.hazard_severities ?? null,
    };
  });

export const updateAnalyticsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      hazard_states: z.array(z.string().min(1).max(80)).max(200).nullable(),
      hazard_severities: z.array(z.enum(SEVERITIES)).max(10).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("rp_analytics_settings")
      .upsert(
        {
          id: 1,
          hazard_states: data.hazard_states,
          hazard_severities: data.hazard_severities,
          updated_at: new Date().toISOString(),
          updated_by: context.userId,
        },
        { onConflict: "id" },
      );
    if (error) throw error;
    return { ok: true };
  });
