import { createFileRoute } from "@tanstack/react-router";

// Sends meeting reminder emails 24h, 1h, and 30min before scheduled_start.
// Invoked by pg_cron every 5 minutes. Marks sent timestamps so reminders fire once.
// Email delivery uses Resend via the Lovable connector gateway when RESEND_API_KEY is
// present; otherwise it logs and still marks as sent to avoid noisy retries.

type Window = { col: "reminder_24h_sent_at" | "reminder_1h_sent_at" | "reminder_30m_sent_at"; label: string; minBefore: number; maxBefore: number };

const WINDOWS: Window[] = [
  { col: "reminder_24h_sent_at", label: "24 hours", minBefore: 23 * 60, maxBefore: 24 * 60 + 30 },
  { col: "reminder_1h_sent_at",  label: "1 hour",   minBefore: 50,      maxBefore: 75 },
  { col: "reminder_30m_sent_at", label: "30 minutes", minBefore: 20,    maxBefore: 35 },
];

function icsBody(m: any) {
  const fmt = (s: string) => new Date(s).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rakshak//EN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${m.id}@rakshak`, `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(m.scheduled_start)}`, `DTEND:${fmt(m.scheduled_end)}`,
    `SUMMARY:${String(m.title).replace(/\n/g, " ")}`,
    `DESCRIPTION:${String(m.agenda || "").replace(/\n/g, "\\n")}`,
    m.meeting_link ? `URL:${m.meeting_link}` : "",
    m.location ? `LOCATION:${m.location}` : "",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

async function sendEmail(to: string[], subject: string, html: string, meeting?: any) {
  const RESEND = process.env.RESEND_API_KEY;
  const LOVABLE = process.env.LOVABLE_API_KEY;
  if (!RESEND || !LOVABLE || to.length === 0) {
    console.log("[meeting-reminders] skip email (no Resend key) →", to, subject);
    return { ok: false, reason: "no_email_provider" };
  }
  const attachments = meeting
    ? [{
        filename: "invite.ics",
        content: Buffer.from(icsBody(meeting)).toString("base64"),
        content_type: "text/calendar; charset=utf-8; method=PUBLISH",
      }]
    : undefined;
  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE}`,
      "X-Connection-Api-Key": RESEND,
    },
    body: JSON.stringify({
      from: "Rakshak <onboarding@resend.dev>",
      to,
      subject,
      html,
      ...(attachments ? { attachments } : {}),
    }),
  });
  const body = await res.text();
  if (!res.ok) console.error("[meeting-reminders] resend failed", res.status, body);
  return { ok: res.ok, body };
}

function html(meeting: any, label: string) {
  const when = new Date(meeting.scheduled_start).toLocaleString();
  const link = meeting.meeting_link
    ? `<p><a href="${meeting.meeting_link}" style="background:#0f766e;color:#fff;padding:10px 16px;border-radius:9999px;text-decoration:none;">Join meeting</a></p>`
    : "";
  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;">
      <h2 style="margin:0 0 8px;">Reminder · ${label}</h2>
      <p style="color:#555;margin:0 0 16px;">Your Rakshak meeting starts in ${label}.</p>
      <h3 style="margin:0;">${escapeHtml(meeting.title)}</h3>
      <p style="margin:4px 0;color:#555;">${when}</p>
      ${meeting.agenda ? `<p style="margin:8px 0;color:#444;white-space:pre-line;">${escapeHtml(meeting.agenda)}</p>` : ""}
      ${meeting.location ? `<p style="margin:4px 0;color:#555;">Location: ${escapeHtml(meeting.location)}</p>` : ""}
      ${link}
      <p style="color:#999;font-size:12px;margin-top:24px;">Rakshak Citizen Safety Mission</p>
    </div>`;
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export const Route = createFileRoute("/api/public/hooks/meeting-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require shared secret to prevent abuse (anyone could otherwise trigger
        // email + DB writes). Configure pg_cron / scheduler to send this header.
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
        let status: "ok" | "error" | "unauthorized" = "ok";
        let httpStatus = 200;
        let notes: any = {};
        let errorMessage: string | null = null;
        let response: Response;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const now = Date.now();
          const horizon = new Date(now + 25 * 60 * 60 * 1000).toISOString();
          const past = new Date(now - 15 * 60 * 1000).toISOString();

          const { data: meetings, error } = await supabaseAdmin
            .from("rp_meetings")
            .select("*, rp_meeting_attendees(profile_id, rp_profiles(full_name, email))")
            .gte("scheduled_start", past)
            .lte("scheduled_start", horizon)
            .neq("status", "cancelled")
            .limit(500);
          if (error) throw error;

          let sent = 0;
          let scanned = 0;
          for (const m of meetings ?? []) {
            scanned++;
            const minsUntil = (new Date(m.scheduled_start).getTime() - now) / 60000;
            for (const w of WINDOWS) {
              if ((m as any)[w.col]) continue;
              if (minsUntil < w.minBefore || minsUntil > w.maxBefore) continue;
              const recipients = ((m.rp_meeting_attendees ?? []) as any[])
                .map((a) => a.rp_profiles?.email)
                .filter((e): e is string => Boolean(e));
              const subject = `Reminder: ${m.title} in ${w.label}`;
              await sendEmail(recipients, subject, html(m, w.label));
              const patch: Record<string, string> = {};
              patch[w.col] = new Date().toISOString();
              await (supabaseAdmin.from("rp_meetings") as any)
                .update(patch)
                .eq("id", m.id);
              for (const a of (m.rp_meeting_attendees ?? []) as any[]) {
                await supabaseAdmin.from("rp_notifications").insert({
                  recipient_id: a.profile_id,
                  type: "meeting_reminder",
                  title: subject,
                  message: `Starts ${new Date(m.scheduled_start).toLocaleString()}`,
                  action_link: m.meeting_link ?? null,
                  related_entity_type: "meeting",
                  related_entity_id: m.id,
                }).then(() => {}, () => {});
              }
              sent++;
            }
          }

          notes = { scanned, sent };
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
            hook_name: "meeting-reminders",
            status,
            started_at: startedAt.toISOString(),
            finished_at: new Date().toISOString(),
            duration_ms: Date.now() - t0,
            http_status: httpStatus,
            notes,
            error_message: errorMessage,
          });
        } catch (e) {
          console.error("[meeting-reminders] log insert failed", e);
        }
        return response!;
      },
    },
  },
});
