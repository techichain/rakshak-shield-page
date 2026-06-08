import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function getOrigin() {
  // Caller-provided origin keeps test/preview/live URLs correct
  return undefined;
}

export const createSponsorshipCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      sponsorship_id: z.string().uuid(),
      origin: z.string().url(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const Stripe = (await import("stripe")).default;
    const apiKey = process.env.STRIPE_SANDBOX_API_KEY ?? process.env.STRIPE_API_KEY;
    if (!apiKey) throw new Error("Payments are not configured yet.");
    const stripe = new Stripe(apiKey);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pledge, error } = await supabaseAdmin
      .from("rp_sponsorships")
      .select("id, sponsor_name, sponsor_email, amount_inr, tier, status")
      .eq("id", data.sponsorship_id)
      .single();
    if (error || !pledge) throw new Error("Pledge not found");
    if (pledge.status === "paid") {
      return { url: `${data.origin}/rakshak-platform/sponsor?paid=1` };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: pledge.sponsor_email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "inr",
            unit_amount: pledge.amount_inr * 100, // INR -> paise
            product_data: {
              name: `Project Rakshak — ${pledge.tier.toUpperCase()} sponsorship`,
              description: `Sponsorship from ${pledge.sponsor_name}`,
            },
          },
        },
      ],
      metadata: {
        sponsorship_id: pledge.id,
        kind: "rp_sponsorship",
      },
      success_url: `${data.origin}/rakshak-platform/sponsor?paid=1&sid=${pledge.id}`,
      cancel_url: `${data.origin}/rakshak-platform/sponsor?cancelled=1`,
    });

    await supabaseAdmin
      .from("rp_sponsorships")
      .update({ provider: "stripe", provider_reference: session.id })
      .eq("id", pledge.id);

    return { url: session.url! };
  });
