import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertFinanceAccess(supabase: any, userId: string) {
  const { data: roles } = await supabase
    .from("rp_user_roles").select("role").eq("user_id", userId);
  const ok = (roles ?? []).some((r: any) =>
    ["cfi_admin", "super_admin", "finance"].includes(r.role));
  if (!ok) throw new Error("Forbidden");
}

const EntryInput = z.object({
  id: z.string().uuid().optional(),
  cohort_id: z.string().uuid().optional().nullable(),
  team_id: z.string().uuid().optional().nullable(),
  entry_type: z.enum(["expense", "grant", "sponsorship", "donation", "reimbursement", "other"]),
  category: z.string().min(1).max(120),
  amount_inr: z.number().nonnegative().max(1_000_000_000),
  currency: z.string().min(3).max(6).default("INR"),
  description: z.string().max(2000).default(""),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receipt_url: z.string().url().max(500).optional().nullable(),
});

export const upsertFinanceEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EntryInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = { ...data, created_by: context.userId };
    const { data: row, error } = await supabaseAdmin
      .from("rp_finance_entries")
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return { entry: row };
  });

export const deleteFinanceEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("rp_finance_entries").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getFinanceDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertFinanceAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: entries }, { data: sponsors }] = await Promise.all([
      supabaseAdmin
        .from("rp_finance_entries")
        .select("*, rp_cohorts(name), rp_teams(team_name)")
        .order("occurred_on", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("rp_sponsorships")
        .select("id, sponsor_name, tier, amount_inr, status, created_at, paid_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    const sum = (rows: any[], pred: (r: any) => boolean) =>
      rows.filter(pred).reduce((s, r) => s + Number(r.amount_inr || 0), 0);
    const all = entries ?? [];
    const totals = {
      expenses: sum(all, (r) => r.entry_type === "expense" || r.entry_type === "reimbursement"),
      inflows: sum(all, (r) => ["grant", "sponsorship", "donation"].includes(r.entry_type)),
      pendingSponsors: (sponsors ?? []).filter((s) => s.status === "pending").reduce((s, r) => s + Number(r.amount_inr || 0), 0),
      paidSponsors: (sponsors ?? []).filter((s) => s.status === "paid").reduce((s, r) => s + Number(r.amount_inr || 0), 0),
    };
    return { entries: all, sponsorships: sponsors ?? [], totals };
  });
