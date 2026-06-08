import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutResult = { clientSecret: string } | { error: string };

const Input = z.object({
  sponsorship_id: z.string().uuid(),
  return_url: z.string().url(),
  environment: z.enum(["sandbox", "live"]),
});

export const createSponsorshipCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<CheckoutResult> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: pledge, error } = await supabaseAdmin
        .from("rp_sponsorships")
        .select("id, sponsor_name, sponsor_email, amount_inr, tier, status")
        .eq("id", data.sponsorship_id)
        .single();
      if (error || !pledge) return { error: "Pledge not found" };
      if (pledge.status === "paid") {
        return { error: "This pledge has already been paid." };
      }

      const stripe = createStripeClient(data.environment as StripeEnv);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.return_url,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "inr",
              unit_amount: Math.round(Number(pledge.amount_inr) * 100),
              product_data: {
                name: `Project Rakshak — ${String(pledge.tier).toUpperCase()} sponsorship`,
                description: `Sponsorship pledge from ${pledge.sponsor_name}`,
              },
            },
          },
        ],
        payment_intent_data: {
          description: `Project Rakshak ${String(pledge.tier).toUpperCase()} sponsorship`,
          metadata: { sponsorship_id: pledge.id, kind: "rp_sponsorship" },
        },
        metadata: { sponsorship_id: pledge.id, kind: "rp_sponsorship" },
        ...(pledge.sponsor_email ? { customer_email: pledge.sponsor_email } : {}),
      });

      await supabaseAdmin
        .from("rp_sponsorships")
        .update({ payment_provider: "stripe", provider_reference: session.id } as any)
        .eq("id", pledge.id);

      return { clientSecret: session.client_secret ?? "" };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });
