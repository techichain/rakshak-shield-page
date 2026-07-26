import { createFileRoute } from "@tanstack/react-router";

// Phase E — shared notifications dispatcher.
// Reads rp_notifications rows that have not been emailed yet and enqueues one
// transactional email per row through the SAME queue the rest of the platform
// uses (`enqueue_email` RPC -> transactional_emails queue, mirroring
// src/lib/rakshak-platform/admin-notify.server.ts). No new mail provider.
//
// Idempotent: email_sent_at is only written after a successful enqueue, so a
// failed row is simply retried on the next run.

const SITE_NAME = "rakshak-crashfreeindia";
const SENDER_DOMAIN = "notify.rakshak.crashfreeindia.org";
const FROM_DOMAIN = "rakshak.crashfreeindia.org";
const PORTAL_BASE = "https://rakshak.crashfreeindia.org";

// Skip backfilling anything older than this (marked as handled, never emailed).
const BACKFILL_CUTOFF_DAYS = 3;

const SUBJECT_PREFIX: Record<string, string> = {
  doubt_escalated: "Escalated doubt",
  session_booked: "Session booked",
  announcement: "Programme announcement",
  phase_rank: "Phase results",
  deadline_soon: "Deadline approaching",
  deadline_missed: "Deadline missed",
};

function buildHtml(n: { title: string; message: string | null; action_link: string | null }) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const link = n.action_link
    ? n.action_link.startsWith("http")
      ? n.action_link
      : `${PORTAL_BASE}${n.action_link}`
    : null;
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111111">
  <div style="max-width:560px;margin:0 auto;padding:28px 24px">
    <h1 style="font-size:20px;margin:0 0 12px">${esc(n.title)}</h1>
    ${n.message ? `<p style="font-size:15px;line-height:1.6;margin:0 0 20px">${esc(n.message)}</p>` : ""}
    ${
      link
        ? `<p style="margin:0 0 24px"><a href="${esc(link)}" style="display:inline-block;background:#c1121f;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:999px;font-size:14px">Open Rakshak's Portal</a></p>`
        : ""
    }
    <p style="font-size:12px;color:#666666;margin:0">Rakshak's Portal · Crash Free India</p>
  </div></body></html>`;
}

function buildText(n: { title: string; message: string | null; action_link: string | null }) {
  const link = n.action_link
    ? n.action_link.startsWith("http")
      ? n.action_link
      : `${PORTAL_BASE}${n.action_link}`
    : null;
  return [n.title, n.message ?? "", link ? `Open: ${link}` : ""].filter(Boolean).join("\n\n");
}

export const Route = createFileRoute("/api/public/hooks/rp-notify-dispatcher")({
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

          const { data: rows, error } = await supabaseAdmin
            .from("rp_notifications")
            .select("id, recipient_id, title, message, type, action_link, created_at")
            .is("email_sent_at", null)
            .order("created_at", { ascending: true })
            .limit(500);
          if (error) throw error;

          const cutoff = Date.now() - BACKFILL_CUTOFF_DAYS * 24 * 60 * 60 * 1000;
          const stale = (rows ?? []).filter((r: any) => Date.parse(r.created_at) < cutoff);
          const fresh = (rows ?? []).filter((r: any) => Date.parse(r.created_at) >= cutoff);

          if (stale.length) {
            await supabaseAdmin
              .from("rp_notifications")
              .update({ email_sent_at: new Date().toISOString() })
              .in(
                "id",
                stale.map((r: any) => r.id),
              );
          }

          let sent = 0;
          let skipped = 0;
          let failed = 0;

          if (fresh.length) {
            const recipientIds = Array.from(new Set(fresh.map((r: any) => r.recipient_id)));
            const { data: profiles } = await supabaseAdmin
              .from("rp_profiles")
              .select("id, email")
              .in("id", recipientIds);
            const emailById = new Map(
              (profiles ?? []).map((p: any) => [p.id, p.email as string | null]),
            );

            for (const n of fresh as any[]) {
              const to = emailById.get(n.recipient_id);
              if (!to) {
                // No address on file — mark handled so we don't loop forever.
                await supabaseAdmin
                  .from("rp_notifications")
                  .update({ email_sent_at: new Date().toISOString() })
                  .eq("id", n.id);
                skipped++;
                continue;
              }

              const prefix = SUBJECT_PREFIX[n.type as string];
              const subject = prefix ? `${prefix} · ${n.title}` : n.title;
              const messageId = crypto.randomUUID();

              await supabaseAdmin.from("email_send_log").insert({
                message_id: messageId,
                template_name: `rp-notification-${n.type ?? "generic"}`,
                recipient_email: to,
                status: "pending",
                metadata: { notification_id: n.id, type: n.type },
              });

              const { error: qErr } = await supabaseAdmin.rpc("enqueue_email", {
                queue_name: "transactional_emails",
                payload: {
                  message_id: messageId,
                  to,
                  from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
                  sender_domain: SENDER_DOMAIN,
                  subject,
                  html: buildHtml(n),
                  text: buildText(n),
                  purpose: "transactional",
                  label: `rp-notification-${n.type ?? "generic"}`,
                  idempotency_key: messageId,
                  queued_at: new Date().toISOString(),
                },
              });

              if (qErr) {
                failed++;
                await supabaseAdmin
                  .from("email_send_log")
                  .update({ status: "failed", error_message: qErr.message })
                  .eq("message_id", messageId);
                console.error("[rp-notify-dispatcher] enqueue failed", n.id, qErr.message);
                continue; // leave email_sent_at null so the next run retries
              }

              await supabaseAdmin
                .from("rp_notifications")
                .update({ email_sent_at: new Date().toISOString() })
                .eq("id", n.id);
              sent++;
            }
          }

          notes = { scanned: rows?.length ?? 0, sent, skipped, failed, stale: stale.length };
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
            hook_name: "rp-notify-dispatcher",
            status,
            started_at: startedAt.toISOString(),
            finished_at: new Date().toISOString(),
            duration_ms: Date.now() - t0,
            http_status: httpStatus,
            notes,
            error_message: errorMessage,
          });
        } catch (e) {
          console.error("[rp-notify-dispatcher] log insert failed", e);
        }
        return response!;
      },
    },
  },
});
