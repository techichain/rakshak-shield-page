import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// Resend delivery webhook — receives email events and updates email_send_log.
// Configure in Resend dashboard → Webhooks → add URL:
//   https://rakshak.crashfreeindia.org/api/public/hooks/resend-webhook
// Set RESEND_WEBHOOK_SECRET to the signing secret shown by Resend.
//
// Security: Resend uses Svix-style HMAC-SHA256 signatures. We verify them
// before processing any payload — otherwise anyone could POST fake
// `email.bounced` events and permanently suppress arbitrary addresses.

function verifySvixSignature(opts: {
  secret: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  body: string;
}): boolean {
  // Reject replay attempts >5 minutes old.
  const ts = Number(opts.svixTimestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 5 * 60) return false;

  // Svix signing secret is "whsec_<base64>"; strip prefix and decode.
  const rawSecret = opts.secret.startsWith("whsec_")
    ? opts.secret.slice("whsec_".length)
    : opts.secret;
  let keyBytes: Buffer;
  try {
    keyBytes = Buffer.from(rawSecret, "base64");
  } catch {
    return false;
  }

  const signedContent = `${opts.svixId}.${opts.svixTimestamp}.${opts.body}`;
  const expected = createHmac("sha256", keyBytes).update(signedContent).digest("base64");

  // svix-signature looks like "v1,<sig> v1,<sig2> ..."; any match wins.
  for (const part of opts.svixSignature.split(" ")) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export const Route = createFileRoute("/api/public/hooks/resend-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const secret = process.env.RESEND_WEBHOOK_SECRET;
          if (!secret) {
            console.error("[resend-webhook] RESEND_WEBHOOK_SECRET not configured");
            return new Response("Not configured", { status: 503 });
          }

          const svixId = request.headers.get("svix-id") ?? "";
          const svixTimestamp = request.headers.get("svix-timestamp") ?? "";
          const svixSignature = request.headers.get("svix-signature") ?? "";
          const body = await request.text();

          if (!svixId || !svixTimestamp || !svixSignature) {
            return new Response("Missing signature headers", { status: 401 });
          }
          if (!verifySvixSignature({ secret, svixId, svixTimestamp, svixSignature, body })) {
            return new Response("Invalid signature", { status: 401 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const payload = JSON.parse(body) as {
            type: string;
            data: {
              email_id: string;
              to: string[];
              from: string;
              subject: string;
              created_at: string;
              [key: string]: any;
            };
          };

          const { type, data } = payload;
          const resendId = data?.email_id;
          const recipientEmail = data?.to?.[0];

          console.log(
            "[resend-webhook] event:",
            type,
            "| resend_id:",
            resendId,
            "| to:",
            recipientEmail,
          );

          if (!resendId && !recipientEmail) {
            return new Response(JSON.stringify({ ok: true, skipped: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          const statusMap: Record<string, string> = {
            "email.sent": "sent",
            "email.delivered": "delivered",
            "email.delivery_delayed": "delayed",
            "email.bounced": "bounced",
            "email.complained": "complained",
            "email.opened": "opened",
            "email.clicked": "clicked",
          };
          const newStatus = statusMap[type];
          if (!newStatus) {
            return new Response(JSON.stringify({ ok: true, ignored: type }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          let updated = false;
          if (resendId) {
            const { data: rows } = await supabaseAdmin
              .from("email_send_log")
              .select("message_id")
              .eq("metadata->>resend_message_id", resendId)
              .limit(1);

            if (rows && rows.length > 0) {
              await supabaseAdmin
                .from("email_send_log")
                .update({ status: newStatus })
                .eq("message_id", rows[0].message_id as string);
              updated = true;
            }
          }

          if (!updated && recipientEmail) {
            const { data: rows } = await supabaseAdmin
              .from("email_send_log")
              .select("message_id")
              .eq("recipient_email", recipientEmail)
              .order("created_at", { ascending: false })
              .limit(1);
            if (rows && rows.length > 0) {
              await supabaseAdmin
                .from("email_send_log")
                .update({ status: newStatus })
                .eq("message_id", rows[0].message_id as string);
            }
          }

          if (type === "email.bounced" && recipientEmail) {
            await supabaseAdmin
              .from("suppressed_emails")
              .upsert(
                { email: recipientEmail.toLowerCase(), reason: "bounced" },
                { onConflict: "email", ignoreDuplicates: true },
              )
              .then(() => {}, () => {});
          }

          return new Response(JSON.stringify({ ok: true, processed: type }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("[resend-webhook] error", err);
          return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
