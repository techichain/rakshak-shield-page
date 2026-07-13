import { createFileRoute } from "@tanstack/react-router";

// Sends WhatsApp reminders for phase deadlines coming up in the next 24h.
// Inert until real WhatsApp credentials are configured — sends are logged
// and skipped so this hook never blocks or errors out.
//
// Follows the same shared-secret + rp_cron_runs pattern as meeting-reminders.

export const Route = createFileRoute("/api/public/hooks/deadline-whatsapp-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ADMIN_DIGEST_WEBHOOK_SECRET;
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!expected || provided.length !== expected.length || provided !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const startedAt = new Date();
        const t0 = Date.now();
        let status: "ok" | "error" = "ok";
        let httpStatus = 200;
        let notes: any = {};
        let errorMessage: string | null = null;
        let response: Response;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { notifyTeamWhatsApp } = await import(
            "@/lib/rakshak-platform/whatsapp.server"
          );

          const now = Date.now();
          const horizon = new Date(now + 24 * 60 * 60 * 1000).toISOString();
          const nowIso = new Date(now).toISOString();

          const { data: rows, error } = await supabaseAdmin
            .from("rp_team_phase_progress")
            .select("team_id, phase_number, deadline, status, rp_teams:team_id(team_name)")
            .not("deadline", "is", null)
            .gte("deadline", nowIso)
            .lte("deadline", horizon)
            .neq("status", "completed")
            .limit(500);
          if (error) throw error;

          let sent = 0;
          for (const r of rows ?? []) {
            const teamName = (r as any).rp_teams?.team_name ?? "your team";
            const when = new Date((r as any).deadline).toLocaleString();
            try {
              const result = await notifyTeamWhatsApp({
                team_id: (r as any).team_id,
                body: `Reminder: ${teamName} — Phase ${(r as any).phase_number} deadline is on ${when}. Please submit before it expires.`,
              });
              sent += result.sent;
            } catch (e) {
              console.error("[deadline-whatsapp-reminders] notify failed", e);
            }
          }

          notes = { scanned: (rows ?? []).length, sent };
          response = new Response(JSON.stringify(notes), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          status = "error";
          httpStatus = 500;
          errorMessage = String(e?.message ?? e);
          response = new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("rp_cron_runs").insert({
            hook_name: "deadline-whatsapp-reminders",
            status,
            started_at: startedAt.toISOString(),
            finished_at: new Date().toISOString(),
            duration_ms: Date.now() - t0,
            http_status: httpStatus,
            notes,
            error_message: errorMessage,
          });
        } catch (e) {
          console.error("[deadline-whatsapp-reminders] log insert failed", e);
        }
        return response!;
      },
    },
  },
});
