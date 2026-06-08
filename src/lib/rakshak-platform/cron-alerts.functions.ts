import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(ctx: any) {
  const { data: roles } = await ctx.supabase
    .from("rp_user_roles").select("role").eq("user_id", ctx.userId);
  const ok = (roles ?? []).some((r: any) => ["cfi_admin", "super_admin"].includes(r.role));
  if (!ok) throw new Error("Forbidden");
}

export const listAlertRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: rules }, { data: runs }] = await Promise.all([
      (supabaseAdmin as any).from("rp_cron_alert_rules").select("*").order("hook_name"),
      supabaseAdmin.from("rp_cron_runs").select("*").order("started_at", { ascending: false }).limit(500),
    ]);

    // Evaluate alerts per hook
    const byHook = new Map<string, any[]>();
    for (const r of runs ?? []) {
      const arr = byHook.get(r.hook_name) ?? [];
      arr.push(r);
      byHook.set(r.hook_name, arr);
    }

    const evaluated = (rules ?? []).map((rule: any) => {
      const list = byHook.get(rule.hook_name) ?? [];
      let consecutive = 0;
      for (const r of list) {
        if (r.status === "ok") break;
        consecutive++;
      }
      const last = list[0];
      const sinceLastMs = last ? Date.now() - new Date(last.started_at).getTime() : Number.MAX_SAFE_INTEGER;
      const stale = sinceLastMs > rule.max_stale_hours * 3600 * 1000;
      const failing = consecutive >= rule.max_consecutive_failures;
      return {
        ...rule,
        consecutive_failures: consecutive,
        last_run_at: last?.started_at ?? null,
        hours_since_last: last ? Math.round(sinceLastMs / 36000) / 100 : null,
        is_alerting: rule.is_active && (failing || stale),
        alert_reason: failing
          ? `${consecutive} consecutive failures (threshold ${rule.max_consecutive_failures})`
          : stale
          ? `No run in ${Math.round(sinceLastMs / 36000) / 100}h (threshold ${rule.max_stale_hours}h)`
          : null,
      };
    });

    return { rules: evaluated };
  });

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  hook_name: z.string().min(1).max(80),
  max_consecutive_failures: z.number().int().min(1).max(50),
  max_stale_hours: z.number().int().min(1).max(720),
  is_active: z.boolean(),
  notes: z.string().max(500).optional().nullable(),
});

export const upsertAlertRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = { ...data };
    if (!payload.id) delete payload.id;
    const { error } = await (supabaseAdmin as any).from("rp_cron_alert_rules").upsert(payload, { onConflict: "hook_name" });
    if (error) throw error;
    return { ok: true };
  });

export const deleteAlertRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("rp_cron_alert_rules").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// Triggered by the cron-health page on load — fires admin notifications for newly alerting hooks.
export const escalateAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: rules }, { data: runs }, { data: admins }] = await Promise.all([
      (supabaseAdmin as any).from("rp_cron_alert_rules").select("*").eq("is_active", true),
      supabaseAdmin.from("rp_cron_runs").select("*").order("started_at", { ascending: false }).limit(500),
      supabaseAdmin.from("rp_user_roles").select("user_id").in("role", ["cfi_admin", "super_admin"]),
    ]);

    const byHook = new Map<string, any[]>();
    for (const r of runs ?? []) {
      const arr = byHook.get(r.hook_name) ?? [];
      arr.push(r);
      byHook.set(r.hook_name, arr);
    }

    let escalated = 0;
    for (const rule of (rules ?? []) as any[]) {
      const list = byHook.get(rule.hook_name) ?? [];
      let consecutive = 0;
      for (const r of list) {
        if (r.status === "ok") break;
        consecutive++;
      }
      const last = list[0];
      const sinceLastMs = last ? Date.now() - new Date(last.started_at).getTime() : Number.MAX_SAFE_INTEGER;
      const stale = sinceLastMs > rule.max_stale_hours * 3600 * 1000;
      const failing = consecutive >= rule.max_consecutive_failures;
      if (!(failing || stale)) continue;

      // Throttle: skip if alerted within the last 6 hours
      if (rule.last_alert_at && Date.now() - new Date(rule.last_alert_at).getTime() < 6 * 3600 * 1000) continue;

      const reason = failing
        ? `${consecutive} consecutive failures`
        : `Stale (no run in ${Math.round(sinceLastMs / 36000) / 100}h)`;

      for (const a of (admins ?? []) as any[]) {
        await supabaseAdmin.from("rp_notifications").insert({
          recipient_id: a.user_id,
          type: "cron_alert",
          title: `Cron alert: ${rule.hook_name}`,
          message: reason,
          action_link: "/rakshak-platform/admin/cron-health",
          related_entity_type: "cron_alert_rule",
          related_entity_id: rule.id,
        });
      }
      await (supabaseAdmin as any).from("rp_cron_alert_rules")
        .update({ last_alert_at: new Date().toISOString() })
        .eq("id", rule.id);
      escalated++;
    }
    return { escalated };
  });
