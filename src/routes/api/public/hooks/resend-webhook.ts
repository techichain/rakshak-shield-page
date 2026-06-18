import { createFileRoute } from "@tanstack/react-router";

// Resend delivery webhook — receives email events and updates email_send_log.
// Configure in Resend dashboard → Webhooks → add URL:
//   https://rakshak.crashfreeindia.org/api/public/hooks/resend-webhook
// Events: email.sent, email.delivered, email.delivery_delayed,
//         email.bounced, email.complained, email.opened, email.clicked

export const Route = createFileRoute("/api/public/hooks/resend-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const payload = (await request.json()) as {
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

          // Find the log row by resend_message_id stored in metadata
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
            // Fallback: update the most recent matching row by recipient
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
                .eq("message_id", rows[0].message_id);
            }
          }

          // Bounced → add to suppression list to avoid retries
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
