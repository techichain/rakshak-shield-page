import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * CSV exporter for admin reporting. Returns CSV text the browser can save.
 * Datasets: teams, submissions, finance, sponsorships, locations.
 */
const Input = z.object({
  dataset: z.enum(["teams", "submissions", "finance", "sponsorships", "locations"]),
});

function toCsv(rows: any[]): string {
  if (rows.length === 0) return "";
  const cols = Array.from(
    rows.reduce((set: Set<string>, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>()),
  );
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    let s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[",\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export const exportDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const r = (roles ?? []).map((x: any) => x.role);
    const isAdmin = r.includes("cfi_admin") || r.includes("super_admin");
    const isFinance = r.includes("finance");
    if (!isAdmin && !(isFinance && ["finance", "sponsorships"].includes(data.dataset))) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let rows: any[] = [];
    if (data.dataset === "teams") {
      const { data: d } = await supabaseAdmin.from("rp_teams").select("id, team_name, college, city, state, current_phase, status, risk_status, final_score, evaluated_phases, completion_percentage, created_at");
      rows = d ?? [];
    } else if (data.dataset === "submissions") {
      const { data: d } = await supabaseAdmin.from("rp_submissions").select("id, team_id, phase_number, title, status, submitted_at, mentor_review_status, admin_review_status, revision_number, created_at");
      rows = d ?? [];
    } else if (data.dataset === "finance") {
      const { data: d } = await supabaseAdmin.from("rp_finance_entries").select("id, entry_type, category, amount_inr, currency, description, occurred_on, cohort_id, team_id, created_at");
      rows = d ?? [];
    } else if (data.dataset === "sponsorships") {
      const { data: d } = await supabaseAdmin.from("rp_sponsorships").select("id, sponsor_name, sponsor_org, sponsor_email, tier, amount_inr, status, paid_at, is_public, created_at");
      rows = d ?? [];
    } else if (data.dataset === "locations") {
      const { data: d } = await supabaseAdmin.from("rp_locations").select("id, team_id, phase_number, location_name, address, city, state, latitude, longitude, issue_type, severity, is_final_selected, created_at");
      rows = d ?? [];
    }
    return { csv: toCsv(rows), filename: `rakshak-${data.dataset}-${new Date().toISOString().slice(0, 10)}.csv`, count: rows.length };
  });
