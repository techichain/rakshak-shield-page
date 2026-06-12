import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Records a denied-access event into rp_audit_logs (server-side log).
 * Fire-and-forget from rpRequireRole. Service-role insert so RLS doesn't block writes.
 */
export const logAccessDenied = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { attempted_path: string; reason: string; required_roles: string[]; user_roles: string[] }) => input)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Always log to console for server-side observability.
    console.warn("[rp-access-denied]", {
      user_id: userId,
      attempted_path: data.attempted_path,
      reason: data.reason,
      required_roles: data.required_roles,
      user_roles: data.user_roles,
      at: new Date().toISOString(),
    });
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("rp_audit_logs").insert({
        actor_id: userId,
        actor_role: data.user_roles.join(",") || null,
        action: "access_denied",
        entity_type: "route",
        new_value: {
          attempted_path: data.attempted_path,
          reason: data.reason,
          required_roles: data.required_roles,
          user_roles: data.user_roles,
        },
      });
    } catch (err) {
      console.error("[rp-access-denied] insert failed", err);
    }
    return { ok: true };
  });
