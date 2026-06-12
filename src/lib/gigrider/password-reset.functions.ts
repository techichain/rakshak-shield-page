import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Forgot-password flow for the Gig Rider checklist admin account.
 *
 * Security model: the OTP is ALWAYS sent to the fixed recovery email
 * (RESET_RECIPIENT) and only ever resets the password of the fixed
 * admin account (ADMIN_EMAIL). No caller-supplied email or user id is
 * trusted, so this cannot be used to take over arbitrary accounts.
 */

const SITE_NAME = "Project Rakshak";
const SENDER_DOMAIN = "notify.rakshak.crashfreeindia.org";
const FROM_DOMAIN = "rakshak.crashfreeindia.org";

const RESET_RECIPIENT = "aastha.shreeharsh@crashfreeindia.org";
const ADMIN_EMAIL = "admin@gmail.com";
const OTP_ROLE = "gigrider_admin_reset";

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 1_000_000).toString().padStart(6, "0");
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getOrCreateUnsubscribeToken(
  supabaseAdmin: any,
  email: string,
): Promise<string> {
  const normalized = email.toLowerCase();
  const { data: existing } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalized)
    .maybeSingle();
  if (existing && !existing.used_at) return existing.token as string;
  const token = generateToken();
  await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .upsert({ token, email: normalized }, { onConflict: "email", ignoreDuplicates: true });
  const { data: stored } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", normalized)
    .maybeSingle();
  return (stored?.token as string) || token;
}

export const sendGigAdminResetOtp = createServerFn({ method: "POST" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const React = await import("react");
    const { render } = await import("@react-email/components");
    const { template } = await import("@/lib/email-templates/gigrider-reset-otp");

    // Throttle: max 3 reset requests / 10 minutes.
    const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("rp_email_otps")
      .select("id", { count: "exact", head: true })
      .eq("email", RESET_RECIPIENT)
      .eq("role", OTP_ROLE)
      .gte("created_at", tenMinAgo);
    if ((count ?? 0) >= 3) {
      throw new Error("Too many reset requests. Please wait a few minutes and try again.");
    }

    const code = generateCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

    const { error: insertErr } = await supabaseAdmin.from("rp_email_otps").insert({
      email: RESET_RECIPIENT,
      code_hash: codeHash,
      role: OTP_ROLE,
      expires_at: expiresAt,
    });
    if (insertErr) throw new Error("Could not generate a reset code. Please try again.");

    const templateData = { code, expiresInMinutes: 10 };
    const element = React.createElement(template.component, templateData);
    const html = await render(element);
    const plainText = await render(element, { plainText: true });
    const subject =
      typeof template.subject === "function"
        ? template.subject(templateData)
        : template.subject;

    const messageId = crypto.randomUUID();
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: "gigrider-reset-otp",
      recipient_email: RESET_RECIPIENT,
      status: "pending",
    });

    const unsubscribeToken = await getOrCreateUnsubscribeToken(supabaseAdmin, RESET_RECIPIENT);

    const { error: enqueueErr } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: RESET_RECIPIENT,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text: plainText,
        purpose: "transactional",
        label: "gigrider-reset-otp",
        idempotency_key: messageId,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });
    if (enqueueErr) throw new Error("Could not send the reset email. Please try again.");

    // Masked confirmation only — never reveal the full recovery address to callers.
    return { ok: true as const, sentTo: "aa•••@crashfreeindia.org", expiresInMinutes: 10 };
  },
);

const resetInput = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  newPassword: z.string().min(8, "At least 8 characters").max(72),
});

export const resetGigAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => resetInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const codeHash = await sha256Hex(data.code);

    const { data: otpRow, error: lookupErr } = await supabaseAdmin
      .from("rp_email_otps")
      .select("id, code_hash, expires_at, consumed_at, attempts")
      .eq("email", RESET_RECIPIENT)
      .eq("role", OTP_ROLE)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lookupErr) throw new Error("Could not verify the code. Please try again.");
    if (!otpRow) throw new Error("No active reset code. Please request a new one.");

    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      throw new Error("This code has expired. Please request a new one.");
    }
    if ((otpRow.attempts ?? 0) >= 5) {
      throw new Error("Too many wrong attempts. Please request a new code.");
    }

    if (otpRow.code_hash !== codeHash) {
      await supabaseAdmin
        .from("rp_email_otps")
        .update({ attempts: (otpRow.attempts ?? 0) + 1 })
        .eq("id", otpRow.id);
      throw new Error("Incorrect code. Please check the email and try again.");
    }

    // Mark consumed before changing the password.
    await supabaseAdmin
      .from("rp_email_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", otpRow.id);

    // Look up the fixed admin account by email.
    const { data: usersPage, error: userErr } =
      await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const adminUser = usersPage?.users?.find(
      (u) => (u.email ?? "").toLowerCase() === ADMIN_EMAIL,
    );
    if (userErr || !adminUser) throw new Error("Admin account not found.");
    const adminUserId = adminUser.id;

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      adminUserId,
      { password: data.newPassword },
    );
    if (updateErr) throw new Error("Could not update the password. Please try again.");

    // Audit trail
    await supabaseAdmin.from("audit_log").insert({
      action: "gigrider_admin_password_reset",
      target_type: "auth.users",
      target_id: adminUserId,
      meta: { method: "email_otp", recipient: "masked" },
    });

    return { ok: true as const, email: ADMIN_EMAIL };
  });
