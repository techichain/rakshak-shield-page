import { createFileRoute } from "@tanstack/react-router";

// Sends reminder notifications for rp_doubts that have been pending for >48h
// and have not yet had a reminder sent. Mirrors the shared-secret +
// rp_cron_runs logging pattern used by deadline-whatsapp-reminders.
//
// Idempotent: sets last_reminder_sent_at so the same doubt is never reminded twice.

export const Route = createFileRoute("/api/public/hooks/doubt-reminders")({
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

          const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

          const { data: rows, error } = await supabaseAdmin
            .from("rp_doubts")
            .select("id, team_id, posted_by, question, created_at, rp_teams:team_id(team_name, assigned_mentor_id, rp_mentors:assigned_mentor_id(profile_id))")
            .eq("status", "pending")
            .is("last_reminder_sent_at", null)
            .lte("created_at", cutoff)
            .limit(500);
          if (error) throw error;

          const { data: adminRows } = await supabaseAdmin
            .from("rp_user_roles")
            .select("user_id")
            .in("role", ["cfi_admin", "super_admin"]);
          const adminIds = (adminRows ?? []).map((r: any) => r.user_id);

          let reminded = 0;
          let whatsappSent = 0;
          for (const r of rows ?? []) {
            const teamName = (r as any).rp_teams?.team_name ?? "team";
            const mentorProfileId = (r as any).rp_teams?.rp_mentors?.profile_id ?? null;
            const recipients = new Set<string>(adminIds);
            if (mentorProfileId) recipients.add(mentorProfileId);
            const notifRows = Array.from(recipients).map((rid) => ({
              recipient_id: rid,
              type: "doubt_reminder",
              title: `Doubt still pending after 48h — ${teamName}`,
              message: String((r as any).question).slice(0, 200),
              action_link: mentorProfileId === rid
                ? "/rakshak-platform/mentor"
                : "/rakshak-platform/admin/doubts",
              related_entity_type: "rp_doubts",
              related_entity_id: (r as any).id,
            }));
            if (notifRows.length) {
              await supabaseAdmin.from("rp_notifications").insert(notifRows);
            }

            try {
              const wa = await notifyTeamWhatsApp({
                team_id: (r as any).team_id,
                body: `Reminder: a doubt from ${teamName} has been pending for 48h — please respond.`,
              });
              whatsappSent += wa.sent;
            } catch (e) {
              console.error("[doubt-reminders] whatsapp failed", e);
            }

            await supabaseAdmin
              .from("rp_doubts")
              .update({ last_reminder_sent_at: new Date().toISOString() })
              .eq("id", (r as any).id);
            reminded += 1;
          }

          notes = { scanned: (rows ?? []).length, reminded, whatsapp_sent: whatsappSent };
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
            hook_name: "doubt-reminders",
            status,
            started_at: startedAt.toISOString(),
            finished_at: new Date().toISOString(),
            duration_ms: Date.now() - t0,
            http_status: httpStatus,
            notes,
            error_message: errorMessage,
          });
        } catch (e) {
          console.error("[doubt-reminders] log insert failed", e);
        }
        return response!;
      },
    },
  },
});
