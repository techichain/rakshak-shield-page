import { createFileRoute } from "@tanstack/react-router";

// Weekly admin digest: counts new teams, submissions, mentor apps in last 7 days.
// Sends email to admins if Resend is configured; always writes an in-app notification.
// Every invocation logs into rp_cron_runs for admin monitoring.

async function sendEmail(to: string[], subject: string, html: string) {
  const RESEND = process.env.RESEND_API_KEY;
  const LOVABLE = process.env.LOVABLE_API_KEY;
  if (!RESEND || !LOVABLE || to.length === 0) return { ok: false };
  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE}`,
      "X-Connection-Api-Key": RESEND,
    },
    body: JSON.stringify({ from: "Rakshak <onboarding@resend.dev>", to, subject, html }),
  });
  return { ok: res.ok };
}

export const Route = createFileRoute("/api/public/hooks/admin-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = new Date();
        const t0 = Date.now();
        let status: "ok" | "error" | "unauthorized" = "ok";
        let httpStatus = 200;
        let notes: any = {};
        let errorMessage: string | null = null;
        let response: Response;

        try {
          const expected = process.env.ADMIN_DIGEST_WEBHOOK_SECRET;
          if (!expected) {
            status = "error";
            httpStatus = 503;
            errorMessage = "Webhook secret not configured";
            response = new Response("Webhook secret not configured", { status: 503 });
          } else {
            const auth = request.headers.get("authorization") ?? "";
            const presented = auth.startsWith("Bearer ") ? auth.slice(7) : "";
            const { timingSafeEqual } = await import("crypto");
            const a = Buffer.from(presented);
            const b = Buffer.from(expected);
            if (a.length !== b.length || !timingSafeEqual(a, b)) {
              status = "unauthorized";
              httpStatus = 401;
              errorMessage = "Invalid bearer";
              response = new Response("Unauthorized", { status: 401 });
            } else {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const sinceIso = new Date(Date.now() - 7 * 86400000).toISOString();

              const [tNew, sNew, sPending, mNew, atRisk] = await Promise.all([
                supabaseAdmin.from("rp_teams").select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
                supabaseAdmin.from("rp_submissions").select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
                supabaseAdmin.from("rp_submissions").select("id", { count: "exact", head: true }).in("status", ["submitted", "resubmitted", "under_mentor_review"]),
                supabaseAdmin.from("rp_mentor_applications").select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
                supabaseAdmin.from("rp_teams").select("id", { count: "exact", head: true }).eq("risk_status", "at_risk"),
              ]);

              const stats = {
                new_teams: tNew.count ?? 0,
                new_submissions: sNew.count ?? 0,
                pending_review: sPending.count ?? 0,
                new_mentor_apps: mNew.count ?? 0,
                at_risk_teams: atRisk.count ?? 0,
              };

              const { data: admins } = await supabaseAdmin
                .from("rp_user_roles")
                .select("user_id, rp_profiles!inner(email, full_name)")
                .in("role", ["cfi_admin", "super_admin"]);

              const recipients = (admins ?? [])
                .map((a: any) => a.rp_profiles?.email)
                .filter((e: string | null): e is string => Boolean(e));

              const subject = `Rakshak weekly digest — ${stats.new_submissions} new submissions, ${stats.pending_review} pending`;
              const html = `
                <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;">
                  <h2>Rakshak weekly digest</h2>
                  <p style="color:#555;">Activity in the past 7 days.</p>
                  <ul style="line-height:1.8;">
                    <li><b>${stats.new_teams}</b> new teams</li>
                    <li><b>${stats.new_submissions}</b> new submissions</li>
                    <li><b>${stats.pending_review}</b> submissions awaiting review</li>
                    <li><b>${stats.new_mentor_apps}</b> new mentor applications</li>
                    <li><b>${stats.at_risk_teams}</b> teams currently at risk</li>
                  </ul>
                </div>`;
              await sendEmail(recipients, subject, html);

              for (const a of admins ?? []) {
                await supabaseAdmin.from("rp_notifications").insert({
                  recipient_id: (a as any).user_id,
                  type: "admin_digest",
                  title: subject,
                  message: `${stats.new_teams} new teams · ${stats.new_mentor_apps} new mentor applications · ${stats.at_risk_teams} at risk`,
                  action_link: "/rakshak-platform/admin/analytics",
                  related_entity_type: "digest",
                }).then(() => {}, () => {});
              }

              notes = { stats, recipients: recipients.length };
              response = new Response(JSON.stringify({ ok: true, ...notes }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }
          }
        } catch (e: any) {
          status = "error";
          httpStatus = 500;
          errorMessage = String(e?.message ?? e);
          response = new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Log run (best-effort, do not block response)
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("rp_cron_runs").insert({
            hook_name: "admin-digest",
            status,
            started_at: startedAt.toISOString(),
            finished_at: new Date().toISOString(),
            duration_ms: Date.now() - t0,
            http_status: httpStatus,
            notes,
            error_message: errorMessage,
          });
        } catch (e) {
          console.error("[admin-digest] log insert failed", e);
        }
        return response!;
      },
    },
  },
});
