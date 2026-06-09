import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  role: z.enum(["team", "mentor", "evaluator"]),
  fullName: z.string().max(160).optional().nullable(),
  email: z.string().email().optional().nullable(),
});

export const onboardRPWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const user = userRes.user;
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
      .upsert({ id: context.userId, full_name: fullName, email }, { onConflict: "id" });
    if (profileError) throw profileError;

    if (data.role === "evaluator") {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("rp_role_approvals")
        .select("id")
        .eq("user_id", context.userId)
        .eq("requested_role", "evaluator")
        .eq("status", "pending")
        .maybeSingle();
      if (existingError) throw existingError;

      if (!existing) {
        const { error: approvalError } = await supabaseAdmin.from("rp_role_approvals").insert({
          user_id: context.userId,
          requested_role: "evaluator",
          status: "pending",
          notes: "Self-requested evaluator access after Google sign-in.",
        });
        if (approvalError) throw approvalError;
      }

      return { status: "pending_approval" as const, redirectTo: "/rakshak-platform/dashboard" as const };
    }

    const dbRole = data.role === "mentor" ? "mentor" : "team_leader";
    const { error: roleError } = await supabaseAdmin
      .from("rp_user_roles")
      .upsert({ user_id: context.userId, role: dbRole }, { onConflict: "user_id,role" });
    if (roleError) throw roleError;

    if (data.role === "mentor") {
      const { error: mentorError } = await supabaseAdmin
        .from("rp_mentors")
        .upsert({ profile_id: context.userId }, { onConflict: "profile_id" });
      if (mentorError) throw mentorError;
      return { status: "active" as const, redirectTo: "/rakshak-platform/mentor" as const };
    }

    return { status: "active" as const, redirectTo: "/rakshak-platform/team" as const };
  });