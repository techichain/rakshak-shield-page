import { createFileRoute } from "@tanstack/react-router";

// Phase E — deadline reminder / overdue sweep over rp_team_phase_progress.
// Writes in-app notifications only; the shared dispatcher delivers the emails.
// Idempotent via deadline_reminder_sent_at / overdue_at.

const DRAFTISH = ["not_started", "draft", "changes_requested"];

export const Route = createFileRoute("/api/public/hooks/rp-deadline-sweep")({
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
          const now = new Date();
          const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

          const { data: teams } = await supabaseAdmin
            .from("rp_teams")
            .select("id, team_name, team_leader_id");
          const teamById = new Map((teams ?? []).map((t: any) => [t.id, t]));

          const { data: adminRows } = await supabaseAdmin
            .from("rp_user_roles")
            .select("user_id")
            .in("role", ["cfi_admin", "super_admin"]);
          const adminIds = Array.from(new Set((adminRows ?? []).map((r: any) => r.user_id)));

          // 1. Reminders — deadline within 3 days, still draft-ish, not reminded.
          const { data: upcoming, error: upErr } = await supabaseAdmin
            .from("rp_team_phase_progress")
            .select("id, team_id, phase_number, deadline, status")
            .is("deadline_reminder_sent_at", null)
            .not("deadline", "is", null)
            .gte("deadline", now.toISOString())
            .lte("deadline", soon)
            .in("status", DRAFTISH as any)
            .limit(500);
          if (upErr) throw upErr;

          let reminded = 0;
          for (const row of upcoming ?? []) {
            const team = teamById.get((row as any).team_id);
            if (!team?.team_leader_id) continue;
            const when = new Date((row as any).deadline).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              dateStyle: "medium",
              timeStyle: "short",
            });
            const { error: nErr } = await supabaseAdmin.from("rp_notifications").insert({
              recipient_id: team.team_leader_id,
              title: `Phase ${(row as any).phase_number} deadline in under 3 days`,
              message: `${team.team_name}: your Phase ${(row as any).phase_number} submission is due ${when} IST.`,
              type: "deadline_soon",
              related_entity_type: "rp_team_phase_progress",
              related_entity_id: (row as any).id,
              action_link: `/rakshak-platform/team/phase/${(row as any).phase_number}`,
            });
            if (nErr) continue;
            await supabaseAdmin
              .from("rp_team_phase_progress")
              .update({ deadline_reminder_sent_at: new Date().toISOString() })
              .eq("id", (row as any).id);
            reminded++;
          }

          // 2. Overdue — deadline passed, nothing submitted, not yet flagged.
          const { data: missed, error: mErr } = await supabaseAdmin
            .from("rp_team_phase_progress")
            .select("id, team_id, phase_number, deadline, status, submitted_at")
            .is("overdue_at", null)
            .is("submitted_at", null)
            .not("deadline", "is", null)
            .lt("deadline", now.toISOString())
            .in("status", DRAFTISH as any)
            .limit(500);
          if (mErr) throw mErr;

          let flagged = 0;
          for (const row of missed ?? []) {
            const team = teamById.get((row as any).team_id);
            const phase = (row as any).phase_number;
            const reason = `Missed Phase ${phase} deadline`;
            const { error: uErr } = await supabaseAdmin
              .from("rp_team_phase_progress")
              .update({
                overdue_at: new Date().toISOString(),
                is_at_risk: true,
                at_risk_reason: reason,
              })
              .eq("id", (row as any).id);
            if (uErr) continue;

            const recipients = new Set<string>(adminIds);
            if (team?.team_leader_id) recipients.add(team.team_leader_id);
            const { data: members } = await supabaseAdmin
              .from("rp_team_members")
              .select("profile_id")
              .eq("team_id", (row as any).team_id);
            for (const m of members ?? []) {
              if ((m as any).profile_id) recipients.add((m as any).profile_id);
            }

            await supabaseAdmin.from("rp_notifications").insert(
              Array.from(recipients).map((rid) => ({
                recipient_id: rid,
                title: `Phase ${phase} deadline missed`,
                message: `${team?.team_name ?? "A team"} has missed the Phase ${phase} deadline and is now flagged at risk.`,
                type: "deadline_missed",
                related_entity_type: "rp_team_phase_progress",
                related_entity_id: (row as any).id,
                action_link: adminIds.length
                  ? `/rakshak-platform/team/phase/${phase}`
                  : `/rakshak-platform/team/phase/${phase}`,
              })),
            );
            flagged++;
          }

          notes = { reminded, flagged };
          response = new Response(JSON.stringify({ ok: true, ...notes }), {
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
            hook_name: "rp-deadline-sweep",
            status,
            started_at: startedAt.toISOString(),
            finished_at: new Date().toISOString(),
            duration_ms: Date.now() - t0,
            http_status: httpStatus,
            notes,
            error_message: errorMessage,
          });
        } catch (e) {
          console.error("[rp-deadline-sweep] log insert failed", e);
        }
        return response!;
      },
    },
  },
});
