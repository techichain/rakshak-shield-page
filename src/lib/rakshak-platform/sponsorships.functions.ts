import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PledgeInput = z.object({
  sponsor_name: z.string().min(1).max(200),
  sponsor_email: z.string().email().max(200).optional().or(z.literal("")),
  sponsor_org: z.string().max(200).optional(),
  message: z.string().max(800).optional(),
  tier: z.enum(["friend", "bronze", "silver", "gold", "platinum"]),
  amount_inr: z.number().int().min(100).max(50_000_000),
  is_public: z.boolean().default(true),
});

// Public: anyone can pledge
export const createSponsorshipPledge = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PledgeInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("rp_sponsorships")
      .insert({
        sponsor_name: data.sponsor_name,
        sponsor_email: data.sponsor_email || null,
        sponsor_org: data.sponsor_org || null,
        message: data.message || null,
        tier: data.tier,
        amount_inr: data.amount_inr,
        is_public: data.is_public,
        status: "pending",
      })
      .select("id, tier, amount_inr, status")
      .single();
    if (error) throw error;
    return { pledge: row };
  });

// Public: sponsor wall (paid + public only)
export const listPublicSponsors = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("rp_sponsorships")
      .select("id, sponsor_name, sponsor_org, sponsor_logo_url, tier, amount_inr, message, paid_at")
      .eq("status", "paid")
      .eq("is_public", true)
      .order("amount_inr", { ascending: false })
      .limit(200);
    if (error) throw error;
    return { sponsors: data ?? [] };
  });

// Admin/finance: full inbox
export const listAllSponsorships = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const ok = (roles ?? []).some((r: any) =>
      ["cfi_admin", "super_admin", "finance"].includes(r.role));
    if (!ok) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("rp_sponsorships")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return { sponsorships: data ?? [] };
  });

export const updateSponsorshipStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["pending", "paid", "refunded", "failed", "cancelled"]),
      provider_reference: z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const ok = (roles ?? []).some((r: any) =>
      ["cfi_admin", "super_admin", "finance"].includes(r.role));
    if (!ok) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const update: any = { status: data.status };
    if (data.provider_reference) update.provider_reference = data.provider_reference;
    if (data.status === "paid") update.paid_at = new Date().toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("rp_sponsorships")
      .update(update)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;
    return { sponsorship: row };
  });
