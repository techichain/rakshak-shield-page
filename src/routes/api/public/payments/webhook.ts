import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const Stripe = (await import("stripe")).default;
        const apiKey = process.env.STRIPE_SANDBOX_API_KEY ?? process.env.STRIPE_API_KEY;
        const whSecret =
          process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET ??
          process.env.STRIPE_WEBHOOK_SECRET;

        const raw = await request.text();
        const sig = request.headers.get("stripe-signature");

        let event: any;
        if (apiKey && whSecret && sig) {
          try {
            const stripe = new Stripe(apiKey);
            event = stripe.webhooks.constructEvent(raw, sig, whSecret);
          } catch (e) {
            return new Response(`Invalid signature: ${String(e)}`, { status: 400 });
          }
        } else {
          // Fallback: accept normalized Lovable payload (no signature header)
          try {
            event = JSON.parse(raw);
          } catch {
            return new Response("Bad body", { status: 400 });
          }
        }

        const type = event?.type ?? event?.event_type;
        const obj = event?.data?.object ?? event?.data ?? {};
        const sponsorshipId =
          obj?.metadata?.sponsorship_id ??
          obj?.custom_data?.sponsorship_id ??
          null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (
          sponsorshipId &&
          (type === "checkout.session.completed" ||
            type === "transaction.completed" ||
            type === "payment_intent.succeeded")
        ) {
          // Look up amount + sponsor for finance entry
          const { data: pledge } = await supabaseAdmin
            .from("rp_sponsorships")
            .select("id, amount_inr, sponsor_name, tier, status")
            .eq("id", sponsorshipId)
            .maybeSingle();

          if (pledge && pledge.status !== "paid") {
            await supabaseAdmin
              .from("rp_sponsorships")
              .update({
                status: "paid",
                paid_at: new Date().toISOString(),
                payment_provider: "stripe",
                provider_reference: obj?.id ?? obj?.payment_intent ?? null,
              } as any)
              .eq("id", sponsorshipId);

            await supabaseAdmin.from("rp_finance_entries").insert({
              entry_type: "inflow",
              category: "sponsorship",
              amount_inr: pledge.amount_inr,
              description: `Sponsorship from ${pledge.sponsor_name} (${pledge.tier})`,
              reference_id: pledge.id,
              reference_type: "rp_sponsorships",
            } as any);
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
