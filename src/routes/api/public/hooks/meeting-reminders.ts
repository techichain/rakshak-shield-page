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

async function sendEmail(to: string[], subject: string, html: string) {
  const RESEND = process.env.RESEND_API_KEY;
  const LOVABLE = process.env.LOVABLE_API_KEY;
  if (!RESEND || !LOVABLE || to.length === 0) {
    console.log("[meeting-reminders] skip email (no Resend key) →", to, subject);
    return { ok: false, reason: "no_email_provider" };
  }
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
      ${meeting.location ? `<p style="margin:4px 0;color:#555;">📍 ${escapeHtml(meeting.location)}</p>` : ""}
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
      POST: async () => {
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
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

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
            // also write in-app notifications
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

        return new Response(JSON.stringify({ scanned, sent }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
