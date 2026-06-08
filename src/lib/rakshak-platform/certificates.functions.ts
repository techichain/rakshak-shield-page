import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function slugRand() {
  return Math.random().toString(36).slice(2, 10);
}

const IssueInput = z.object({
  team_id: z.string().uuid(),
  member_profile_id: z.string().uuid().optional().nullable(),
  certificate_type: z.enum(["participation", "phase_completion", "programme_completion", "excellence"]),
  phase_number: z.number().int().min(0).max(4).optional().nullable(),
  title: z.string().min(1).max(200),
  recipient_name: z.string().min(1).max(200),
});

export const issueCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IssueInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const ok = (roles ?? []).some((r: any) => ["cfi_admin", "super_admin"].includes(r.role));
    if (!ok) throw new Error("Forbidden");

    const year = new Date().getFullYear();
    const serial = `RKS-${year}-${slugRand().toUpperCase()}`;
    const slug = `${slugRand()}${slugRand()}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("rp_certificates")
      .insert({
        team_id: data.team_id,
        member_profile_id: data.member_profile_id ?? null,
        certificate_type: data.certificate_type,
        phase_number: data.phase_number ?? null,
        title: data.title,
        recipient_name: data.recipient_name,
        serial_no: serial,
        public_slug: slug,
        issued_by: context.userId,
      })
      .select()
      .single();
    if (error) throw error;
    return { certificate: row };
  });

export const revokeCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const ok = (roles ?? []).some((r: any) => ["cfi_admin", "super_admin"].includes(r.role));
    if (!ok) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("rp_certificates")
      .update({ is_revoked: true, revoked_reason: data.reason ?? null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const verifyCertificate = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) =>
    z.object({ slug: z.string().min(4).max(40) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("rp_certificates")
      .select("*, rp_teams(team_name, city, state, college)")
      .eq("public_slug", data.slug)
      .maybeSingle();
    if (error) throw error;
    return { certificate: row };
  });

export const listTeamCertificates = createServerFn({ method: "GET" })
  .inputValidator((d: { teamId: string }) =>
    z.object({ teamId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("rp_certificates")
      .select("*")
      .eq("team_id", data.teamId)
      .order("issued_at", { ascending: false });
    if (error) throw error;
    return { certificates: rows ?? [] };
  });
