import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SITE_NAME = "Project Rakshak";
const SENDER_DOMAIN = "notify.rakshak.crashfreeindia.org";
const FROM_DOMAIN = "rakshak.crashfreeindia.org";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE = z.enum(["team", "mentor", "evaluator", "admin"]);

const sendInput = z.object({
  email: z.string().trim().toLowerCase().min(3).max(254).regex(EMAIL_RE),
  role: ROLE,
});

const verifyInput = z.object({
  email: z.string().trim().toLowerCase().min(3).max(254).regex(EMAIL_RE),
  code: z.string().regex(/^\d{6}$/),
  fullName: z.string().trim().min(1).max(160),
  password: z.string().min(6).max(200),
  role: ROLE,
});

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

export const sendRegistrationOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => sendInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const React = await import("react");
    const { render } = await import("@react-email/components");
    const { TEMPLATES } = await import("@/lib/email-templates/registry");

    const email = data.email;

    // Block duplicate registration up front.
    const { data: existing } = await supabaseAdmin
      .from("rp_profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      throw new Error("An account with this email already exists. Please sign in instead.");
    }

    // Throttle: max 3 OTP requests / 10 minutes per email.
    const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("rp_email_otps")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", tenMinAgo);
    if ((count ?? 0) >= 3) {
      throw new Error("Too many code requests. Please wait a few minutes and try again.");
    }

    const code = generateCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

    const { error: insertErr } = await supabaseAdmin.from("rp_email_otps").insert({
      email,
      code_hash: codeHash,
      role: data.role,
      expires_at: expiresAt,
    });
    if (insertErr) throw new Error("Could not generate verification code. Please try again.");

    // Render + enqueue
    const entry = TEMPLATES["registration-otp"];
    if (!entry) throw new Error("Email template missing.");
    const templateData = { code, role: data.role, expiresInMinutes: 10 };
    const element = React.createElement(entry.component, templateData);
    const html = await render(element);
    const plainText = await render(element, { plainText: true });
    const subject =
      typeof entry.subject === "function" ? entry.subject(templateData) : entry.subject;

    const messageId = crypto.randomUUID();
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: "registration-otp",
      recipient_email: email,
      status: "pending",
    });

    const { error: enqueueErr } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text: plainText,
        purpose: "transactional",
        label: "registration-otp",
        idempotency_key: messageId,
        queued_at: new Date().toISOString(),
      },
    });
    if (enqueueErr) throw new Error("Could not send verification email. Please try again.");

    return { ok: true as const, expiresInMinutes: 10 };
  });

export const verifyOtpAndCreateAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => verifyInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email;
    const codeHash = await sha256Hex(data.code);

    // Find the latest unconsumed OTP for this email.
    const { data: otpRow, error: lookupErr } = await supabaseAdmin
      .from("rp_email_otps")
      .select("id, code_hash, expires_at, consumed_at, attempts, role")
      .eq("email", email)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lookupErr) throw new Error("Could not verify code. Please try again.");
    if (!otpRow) throw new Error("No active verification code. Please request a new one.");

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
      throw new Error("Incorrect code. Please check your email and try again.");
    }

    // Mark consumed
    await supabaseAdmin
      .from("rp_email_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", otpRow.id);

    // Create the auth user with email already confirmed.
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, rp_role: data.role },
    });
    if (createErr || !created.user) {
      // If user exists (race), surface friendly message.
      const msg = createErr?.message || "Could not create account.";
      if (/already/i.test(msg)) {
        throw new Error("An account with this email already exists. Please sign in instead.");
      }
      throw new Error(msg);
    }

    const user = created.user;

    // Onboard: profile + roles + mentor/approval, mirroring onboardRPWorkspace.
    await supabaseAdmin
      .from("rp_profiles")
      .upsert({ id: user.id, full_name: data.fullName, email }, { onConflict: "id" });

    if (data.role === "evaluator" || data.role === "admin") {
      const requestedRole = data.role === "admin" ? "cfi_admin" : "evaluator";
      await supabaseAdmin.from("rp_role_approvals").insert({
        user_id: user.id,
        requested_role: requestedRole,
        status: "pending",
        notes: `Self-requested ${requestedRole} access at sign-up.`,
      });
      return {
        status: "pending_approval" as const,
        redirectTo: "/rakshak-platform/dashboard" as const,
      };
    }

    const dbRole = data.role === "mentor" ? "mentor" : "team_leader";
    await supabaseAdmin
      .from("rp_user_roles")
      .upsert({ user_id: user.id, role: dbRole }, { onConflict: "user_id,role" });

    if (data.role === "mentor") {
      await supabaseAdmin
        .from("rp_mentors")
        .upsert({ profile_id: user.id }, { onConflict: "profile_id" });
      return { status: "active" as const, redirectTo: "/rakshak-platform/mentor" as const };
    }

    return { status: "active" as const, redirectTo: "/rakshak-platform/team" as const };
  });
