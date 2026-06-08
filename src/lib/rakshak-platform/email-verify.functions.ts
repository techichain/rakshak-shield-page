import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Server-side email authenticity check.
 *
 * Validates that:
 *  1. The address is syntactically valid.
 *  2. The domain is not on a common disposable / throwaway list.
 *  3. The domain actually publishes MX records (i.e. can receive mail)
 *     — queried via Cloudflare DNS-over-HTTPS so no API key is required.
 *
 * This is the same approach used by most "is this email real" widgets;
 * it cannot confirm the specific mailbox exists, but it eliminates
 * typos, fake domains, and disposable-mail services.
 */

const DISPOSABLE = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "yopmail.com",
  "trashmail.com",
  "throwawaymail.com",
  "fakeinbox.com",
  "getnada.com",
  "sharklasers.com",
  "dispostable.com",
  "maildrop.cc",
  "spambog.com",
  "tempinbox.com",
  "mintemail.com",
  "mailnesia.com",
  "tempr.email",
  "moakt.com",
  "emailondeck.com",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Input = z.object({
  email: z
    .string()
    .trim()
    .min(3)
    .max(254)
    .regex(EMAIL_RE, "Invalid email format"),
});

type MxAnswer = {
  Answer?: { type: number; data: string }[];
  Status?: number;
};

export const verifyEmailDeliverable = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const domain = email.split("@")[1];

    if (!domain || domain.length < 3) {
      return { ok: false as const, reason: "Email format looks invalid." };
    }
    if (DISPOSABLE.has(domain)) {
      return {
        ok: false as const,
        reason: "Disposable/temporary email addresses are not allowed.",
      };
    }

    // Cloudflare DNS-over-HTTPS — no key, works on Workers/edge.
    try {
      const res = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
        { headers: { accept: "application/dns-json" } },
      );
      if (!res.ok) {
        // Don't hard-fail the user on a DNS provider hiccup — fall through.
        return { ok: true as const, warning: "Could not verify mail server; proceeding." };
      }
      const body = (await res.json()) as MxAnswer;
      const mx = (body.Answer ?? []).filter((a) => a.type === 15);
      if (mx.length === 0) {
        return {
          ok: false as const,
          reason: `The domain "${domain}" has no mail servers — please check the address.`,
        };
      }
      return { ok: true as const };
    } catch {
      // Network error — don't block, but flag.
      return { ok: true as const, warning: "Could not verify mail server; proceeding." };
    }
  });
