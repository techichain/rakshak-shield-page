import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ReportInput = z.object({
  id: z.string().uuid().optional(),
  team_id: z.string().uuid(),
  location_id: z.string().uuid().optional().nullable(),
  authority_name: z.string().min(1).max(200),
  authority_category: z.enum(["nhai", "state_pwd", "municipal", "dev_auth", "police", "other"]),
  contact_person: z.string().max(120).optional().nullable(),
  contact_email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  contact_phone: z.string().max(40).optional().nullable(),
  subject: z.string().min(1).max(240),
  message: z.string().max(8000).default(""),
  attachment_url: z.string().url().max(500).optional().nullable(),
  status: z.enum(["draft", "sent", "acknowledged", "actioned", "closed"]).default("draft"),
});

export const upsertAuthorityReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReportInput.parse(d))
  .handler(async ({ data, context }) => {
    // Verify caller is a member/leader of the target team (or an admin).
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) =>
      ["cfi_admin", "super_admin"].includes(r.role));

    if (!isAdmin) {
      const { data: team } = await context.supabase
        .from("rp_teams").select("id, team_leader_id").eq("id", data.team_id).maybeSingle();
      if (!team) throw new Error("Team not found");
      let allowed = team.team_leader_id === context.userId;
      if (!allowed) {
        const { data: m } = await context.supabase
          .from("rp_team_members").select("id")
          .eq("team_id", data.team_id).eq("profile_id", context.userId).maybeSingle();
        allowed = !!m;
      }
      if (!allowed) throw new Error("Forbidden: not a member of this team");
    }

    // On update, ensure the existing report belongs to the supplied team.
    if (data.id) {
      const { data: existing } = await context.supabase
        .from("rp_authority_reports").select("id, team_id").eq("id", data.id).maybeSingle();
      if (!existing) throw new Error("Report not found");
      if (existing.team_id !== data.team_id) throw new Error("Forbidden: team mismatch");
    }

    const payload: any = { ...data, created_by: context.userId };
    if (data.status === "sent" && !data.id) payload.sent_at = new Date().toISOString();
    const { data: row, error } = await context.supabase
      .from("rp_authority_reports")
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return { report: row };
  });

export const recordAuthorityResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      response_status: z.enum(["acknowledged", "actioned", "rejected", "closed"]),
      response_text: z.string().max(8000).optional(),
      response_attachment_url: z.string().url().max(500).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const ok = (roles ?? []).some((r: any) =>
      ["authority", "cfi_admin", "super_admin"].includes(r.role));
    if (!ok) throw new Error("Forbidden");
    const { data: row, error } = await context.supabase
      .from("rp_authority_reports")
      .update({
        response_status: data.response_status,
        response_text: data.response_text ?? null,
        response_attachment_url: data.response_attachment_url ?? null,
        response_at: new Date().toISOString(),
        status: data.response_status === "closed" ? "closed" : "acknowledged",
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;
    return { report: row };
  });

export const listTeamReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { teamId: string }) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("rp_authority_reports")
      .select("*")
      .eq("team_id", data.teamId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { reports: rows ?? [] };
  });

export const getAuthorityInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const ok = (roles ?? []).some((r: any) =>
      ["authority", "cfi_admin", "super_admin"].includes(r.role));
    if (!ok) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reports, error } = await supabaseAdmin
      .from("rp_authority_reports")
      .select("*, rp_teams(team_name, city, state), rp_locations(location_name, latitude, longitude, severity)")
      .in("status", ["sent", "acknowledged", "actioned"])
      .order("sent_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw error;
    const { data: hotspots } = await supabaseAdmin
      .from("rp_locations")
      .select("id, location_name, city, state, latitude, longitude, severity, issue_type, is_final_selected")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);
    return { reports: reports ?? [], hotspots: hotspots ?? [] };
  });
