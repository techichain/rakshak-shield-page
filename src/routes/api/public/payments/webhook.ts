import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, createStripeClient, getWebhookSecret } from "@/lib/stripe.server";

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") ?? "sandbox") as StripeEnv;
        if (env !== "sandbox" && env !== "live") {
          return new Response("Bad env", { status: 400 });
        }

        const raw = await request.text();
        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 400 });

        let event: any;
        try {
          const stripe = createStripeClient(env);
          event = stripe.webhooks.constructEvent(raw, sig, getWebhookSecret(env));
        } catch (e) {
          return new Response(`Invalid signature: ${String(e)}`, { status: 400 });
        }

        const obj = event?.data?.object ?? {};
        const sponsorshipId =
          obj?.metadata?.sponsorship_id ??
          obj?.payment_intent_data?.metadata?.sponsorship_id ??
          null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const shouldMarkPaid =
          sponsorshipId &&
          (event.type === "checkout.session.completed" ||
            event.type === "payment_intent.succeeded");

        if (shouldMarkPaid) {
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
              entry_type: "sponsorship",
              category: "sponsorship",
              amount_inr: pledge.amount_inr,
              description: `Sponsorship from ${pledge.sponsor_name} (${pledge.tier})`,
              metadata: { sponsorship_id: pledge.id, stripe_event: event.id },
            } as any);
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
