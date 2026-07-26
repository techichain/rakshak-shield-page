import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(ctx: any) {
  const { data: roles } = await ctx.supabase
    .from("rp_user_roles").select("role").eq("user_id", ctx.userId);
  const ok = (roles ?? []).some((r: any) => ["cfi_admin", "super_admin"].includes(r.role));
  if (!ok) throw new Error("Forbidden");
}

export type SmokeResult = {
  key: string;
  name: string;
  status: "pass" | "fail" | "skip";
  latency_ms: number;
  detail: string;
};

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value?: T; error?: any }> {
  const t = Date.now();
  try {
    const value = await fn();
    return { ms: Date.now() - t, value };
  } catch (error) {
    return { ms: Date.now() - t, error };
  }
}

const Input = z.object({ keys: z.array(z.string()).optional() });

export const runIntegrationSmoke = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const filter = data.keys && data.keys.length ? new Set(data.keys) : null;
    const should = (k: string) => !filter || filter.has(k);

    const results: SmokeResult[] = [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Supabase reachability (select 1 via lightweight count)
    if (should("supabase")) {
      const r = await timed(async () => {
        const { error, count } = await supabaseAdmin
          .from("rp_user_roles")
          .select("user_id", { count: "exact", head: true });
        if (error) throw error;
        return count ?? 0;
      });
      results.push({
        key: "supabase",
        name: "Lovable Cloud (database)",
        status: r.error ? "fail" : "pass",
        latency_ms: r.ms,
        detail: r.error ? String(r.error.message ?? r.error) : `Reachable · ${r.value} roles indexed`,
      });
    }

    // 2. Storage bucket reachability
    if (should("storage")) {
      const r = await timed(async () => {
        const { data, error } = await supabaseAdmin.storage.listBuckets();
        if (error) throw error;
        return data?.map((b) => b.name) ?? [];
      });
      const buckets = (r.value as string[] | undefined) ?? [];
      const expected = ["rp-submissions", "public-docs", "observation-photos"];
      const missing = expected.filter((b) => !buckets.includes(b));
      results.push({
        key: "storage",
        name: "Storage buckets",
        status: r.error ? "fail" : missing.length ? "fail" : "pass",
        latency_ms: r.ms,
        detail: r.error
          ? String(r.error.message ?? r.error)
          : missing.length
          ? `Missing buckets: ${missing.join(", ")}`
          : `OK · ${buckets.length} buckets`,
      });
    }

    // 3. AI Gateway key presence (cheap, no remote call)
    if (should("ai")) {
      const present = Boolean(process.env.LOVABLE_API_KEY);
      results.push({
        key: "ai",
        name: "Lovable AI Gateway",
        status: present ? "pass" : "fail",
        latency_ms: 0,
        detail: present ? "LOVABLE_API_KEY available to server" : "LOVABLE_API_KEY missing",
      });
    }

    // 4. Admin digest webhook secret + endpoint reachable
    if (should("admin-digest")) {
      const hasSecret = Boolean(process.env.ADMIN_DIGEST_WEBHOOK_SECRET);
      results.push({
        key: "admin-digest",
        name: "Admin digest webhook secret",
        status: hasSecret ? "pass" : "fail",
        latency_ms: 0,
        detail: hasSecret ? "Secret configured" : "ADMIN_DIGEST_WEBHOOK_SECRET not set",
      });
    }

    // 5. Cron runs recently logged
    if (should("cron")) {
      const r = await timed(async () => {
        const { data, error } = await supabaseAdmin
          .from("rp_cron_runs")
          .select("started_at")
          .order("started_at", { ascending: false })
          .limit(1);
        if (error) throw error;
        return data?.[0]?.started_at ?? null;
      });
      const last = r.value as string | null | undefined;
      const ageH = last ? (Date.now() - new Date(last).getTime()) / 3600_000 : Infinity;
      results.push({
        key: "cron",
        name: "Cron run telemetry",
        status: r.error ? "fail" : !last ? "skip" : ageH > 48 ? "fail" : "pass",
        latency_ms: r.ms,
        detail: r.error
          ? String(r.error.message ?? r.error)
          : !last
          ? "No cron runs recorded yet"
          : `Last run ${ageH.toFixed(1)}h ago`,
      });
    }

    // Roadmap placeholders — known-skip
    const placeholders: { key: string; name: string; reason: string }[] = [
      { key: "slack", name: "Slack notifications", reason: "Webhook URL not configured" },
      { key: "whatsapp", name: "WhatsApp Business", reason: "Provider credentials not configured" },
      { key: "sheets", name: "Google Sheets sync", reason: "OAuth connector not linked" },
      { key: "outbound", name: "Custom outbound webhooks", reason: "No subscribers registered" },
    ];
    for (const p of placeholders) {
      if (!should(p.key)) continue;
      results.push({ key: p.key, name: p.name, status: "skip", latency_ms: 0, detail: p.reason });
    }

    return { ran_at: new Date().toISOString(), results };
  });

export type ScheduledJobStatus = {
  key: string;
  name: string;
  description: string;
  last_run_at: string | null;
  last_status: string | null;
  next_run_hint: string;
};

const SCHEDULED_JOBS: { key: string; name: string; description: string; every: string }[] = [
  {
    key: "rp-notify-dispatcher",
    name: "Notifications dispatcher",
    description: "Emails out the alerts people see in the portal (doubts, bookings, ranks).",
    every: "every 5 minutes",
  },
  {
    key: "rp-deadline-sweep",
    name: "Deadline reminders",
    description: "Warns teams 3 days before a phase deadline and flags missed ones.",
    every: "every hour",
  },
];

/** Last-run status for the Phase E scheduled jobs, read from our own run log. */
export const listScheduledJobStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: ScheduledJobStatus[] = [];
    for (const job of SCHEDULED_JOBS) {
      const { data } = await supabaseAdmin
        .from("rp_cron_runs")
        .select("started_at, status")
        .eq("hook_name", job.key)
        .order("started_at", { ascending: false })
        .limit(1);
      const row = data?.[0] as any;
      out.push({
        key: job.key,
        name: job.name,
        description: job.description,
        last_run_at: row?.started_at ?? null,
        last_status: row?.status ?? null,
        next_run_hint: `Runs ${job.every}`,
      });
    }
    return { jobs: out };
  });
