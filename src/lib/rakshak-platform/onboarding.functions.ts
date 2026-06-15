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

    // Mentor, evaluator, admin, AND team-leader self-sign-ups are routed
    // through the approval queue so an admin must explicitly grant access.
    if (
      data.role === "evaluator" ||
      data.role === "admin" ||
      data.role === "mentor" ||
      data.role === "team"
    ) {
      const requestedRole =
        data.role === "admin"
          ? "cfi_admin"
          : data.role === "mentor"
            ? "mentor"
            : data.role === "team"
              ? "team_leader"
              : "evaluator";
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("rp_role_approvals")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("requested_role", requestedRole)
        .in("status", ["pending", "approved"])
        .maybeSingle();
      if (existingError) throw existingError;

      // If already approved, grant the role now (covers refresh / re-onboard).
      if (existing?.status === "approved") {
        const { error: roleError } = await supabaseAdmin
          .from("rp_user_roles")
          .upsert({ user_id: user.id, role: requestedRole }, { onConflict: "user_id,role" });
        if (roleError) throw roleError;
        if (requestedRole === "mentor") {
          await supabaseAdmin
            .from("rp_mentors")
            .upsert({ profile_id: user.id }, { onConflict: "profile_id" });
        }
        const redirectTo =
          requestedRole === "mentor"
            ? ("/rakshak-platform/mentor" as const)
            : requestedRole === "team_leader"
              ? ("/rakshak-platform/team" as const)
              : ("/rakshak-platform/dashboard" as const);
        return { status: "active" as const, redirectTo };
      }

      if (!existing) {
        const { data: inserted, error: approvalError } = await supabaseAdmin
          .from("rp_role_approvals")
          .insert({
            user_id: user.id,
            requested_role: requestedRole,
            status: "pending",
            notes: `Self-requested ${requestedRole} access at sign-up.`,
          })
          .select("id")
          .single();
        if (approvalError) throw approvalError;

        // Fire-and-forget admin notification + email so onboarding never blocks
        // on transient email infra issues.
        try {
          const { notifyAdminsOfRoleRequest } = await import("./admin-notify.server");
          await notifyAdminsOfRoleRequest({
            requesterId: user.id,
            requesterName: fullName,
            requesterEmail: email,
            requestedRole,
            notes: `Self-requested ${requestedRole} access at sign-up.`,
            source: "self-signup",
            approvalId: inserted?.id,
          });
        } catch (err) {
          console.error("notifyAdminsOfRoleRequest failed", err);
        }
      } else if (existing.status === "pending") {
        // Idempotently repair missed admin alerts for pending requests.
        try {
          const { notifyAdminsOfRoleRequest } = await import("./admin-notify.server");
          await notifyAdminsOfRoleRequest({
            requesterId: user.id,
            requesterName: fullName,
            requesterEmail: email,
            requestedRole,
            notes: `Self-requested ${requestedRole} access at sign-up.`,
            source: "self-signup",
            approvalId: existing.id,
          });
        } catch (err) {
          console.error("notifyAdminsOfRoleRequest repair failed", err);
        }
      }

      return { status: "pending_approval" as const, redirectTo: "/rakshak-platform/dashboard" as const };
    }

    // No remaining auto-granted self-signup roles — every role goes through approval.
    return { status: "pending_approval" as const, redirectTo: "/rakshak-platform/dashboard" as const };
  });

