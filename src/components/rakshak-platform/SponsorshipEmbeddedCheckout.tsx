import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createSponsorshipCheckout } from "@/lib/rakshak-platform/payments.functions";

interface Props {
  sponsorshipId: string;
  returnUrl: string;
}

export function SponsorshipEmbeddedCheckout({ sponsorshipId, returnUrl }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createSponsorshipCheckout({
      data: { sponsorship_id: sponsorshipId, return_url: returnUrl, environment: getStripeEnvironment() },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe did not return a client secret");
    return result.clientSecret;
  };

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
