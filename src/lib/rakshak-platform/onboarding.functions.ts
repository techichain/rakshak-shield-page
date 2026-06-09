import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  role: z.enum(["team", "mentor", "evaluator", "admin"]),
  accessToken: z.string().min(1),
  fullName: z.string().max(160).optional().nullable(),
  email: z.string().email().optional().nullable(),
});

export const onboardRPWorkspace = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tokenUser, error: tokenError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (tokenError || !tokenUser.user) throw new Error("Your sign-in session expired. Please sign in again.");

    const user = tokenUser.user;
    const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const email = user?.email ?? data.email ?? "";
    const fullName =
      data.fullName ||
      (typeof metadata.full_name === "string" ? metadata.full_name : undefined) ||
      (typeof metadata.name === "string" ? metadata.name : undefined) ||
      email.split("@")[0] ||
      "Project Rakshak user";

    if (!email) throw new Error("Your account email is missing. Please sign out and sign in again.");

    const { error: profileError } = await supabaseAdmin
      .from("rp_profiles")
      .upsert({ id: user.id, full_name: fullName, email }, { onConflict: "id" });
    if (profileError) throw profileError;

    if (data.role === "evaluator" || data.role === "admin") {
      const requestedRole = data.role === "admin" ? "cfi_admin" : "evaluator";
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("rp_role_approvals")
        .select("id")
        .eq("user_id", user.id)
        .eq("requested_role", requestedRole)
        .eq("status", "pending")
        .maybeSingle();
      if (existingError) throw existingError;

      if (!existing) {
        const { error: approvalError } = await supabaseAdmin.from("rp_role_approvals").insert({
          user_id: user.id,
          requested_role: requestedRole,
          status: "pending",
          notes: `Self-requested ${requestedRole} access at sign-up.`,
        });
        if (approvalError) throw approvalError;
      }

      return { status: "pending_approval" as const, redirectTo: "/rakshak-platform/dashboard" as const };
    }

    const dbRole = data.role === "mentor" ? "mentor" : "team_leader";
    const { error: roleError } = await supabaseAdmin
      .from("rp_user_roles")
      .upsert({ user_id: user.id, role: dbRole }, { onConflict: "user_id,role" });
    if (roleError) throw roleError;

    if (data.role === "mentor") {
      const { error: mentorError } = await supabaseAdmin
        .from("rp_mentors")
        .upsert({ profile_id: user.id }, { onConflict: "profile_id" });
      if (mentorError) throw mentorError;
      return { status: "active" as const, redirectTo: "/rakshak-platform/mentor" as const };
    }

    return { status: "active" as const, redirectTo: "/rakshak-platform/team" as const };
  });