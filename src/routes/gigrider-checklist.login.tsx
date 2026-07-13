import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/gigrider/auth";
import { useServerFn } from "@tanstack/react-start";
import {
  sendGigAdminResetOtp,
  resetGigAdminPassword,
} from "@/lib/gigrider/password-reset.functions";

export const Route = createFileRoute("/gigrider-checklist/login")({
  component: LoginPage,
});

const USERNAME_EMAIL_DOMAIN = "gigrider.local";

const schema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, "Enter your username or email")
    .max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});

function toEmail(identifier: string): string | null {
  const v = identifier.trim();
  if (v.includes("@")) {
    return z.string().email().safeParse(v).success ? v.toLowerCase() : null;
  }
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(v)) return null;
  return `${v.toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}

type ResetStep = "idle" | "sending" | "code" | "resetting" | "done";

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Forgot-password state
  const [showReset, setShowReset] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>("idle");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetInfo, setResetInfo] = useState<string | null>(null);
  const sendOtp = useServerFn(sendGigAdminResetOtp);
  const doReset = useServerFn(resetGigAdminPassword);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/gigrider-checklist" });
  }, [loading, user, navigate]);

  const handleSendOtp = async () => {
    setResetError(null);
    setResetStep("sending");
    try {
      const res = await sendOtp();
      setResetInfo(`A 6-digit code was sent to ${res.sentTo}. It expires in ${res.expiresInMinutes} minutes.`);
      setResetStep("code");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Could not send the code");
      setResetStep("idle");
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    if (!/^\d{6}$/.test(resetCode.trim())) {
      setResetError("Enter the 6-digit code from the email");
      return;
    }
    if (newPassword.length < 8) {
      setResetError("New password must be at least 8 characters");
      return;
    }
    setResetStep("resetting");
    try {
      const res = await doReset({ data: { code: resetCode.trim(), newPassword } });
      setResetInfo(`Password updated. Sign in with ${res.email} and your new password.`);
      setResetStep("done");
      setResetCode("");
      setNewPassword("");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Reset failed");
      setResetStep("code");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ identifier, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    const email = toEmail(parsed.data.identifier);
    if (!email) {
      setError("Username must be 3–32 chars (letters, digits, . _ -) or a valid email");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: parsed.data.password,
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-900">Gig Rider Safety</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Username <span className="text-slate-400">(or email for admins)</span>
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="priya01"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoComplete="current-password"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 text-white text-sm font-semibold py-2.5 rounded-md hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            {submitting ? "Please wait…" : "Sign in"}
          </button>
        </form>

        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => {
              setShowReset((v) => !v);
              setResetError(null);
              setResetInfo(null);
              setResetStep("idle");
            }}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
          >
            Forgot password? (admin)
          </button>
        </div>

        {showReset && (
          <div className="mt-3 border-t border-slate-200 pt-4">
            {resetStep === "idle" || resetStep === "sending" ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  A one-time code will be sent to the registered recovery email
                  (aa•••@crashfreeindia.org) to reset the admin password.
                </p>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={resetStep === "sending"}
                  className="w-full bg-slate-800 text-white text-sm font-semibold py-2.5 rounded-md hover:bg-slate-900 disabled:opacity-50 transition"
                >
                  {resetStep === "sending" ? "Sending code…" : "Send reset code"}
                </button>
              </div>
            ) : resetStep === "done" ? (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                {resetInfo}
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-3">
                {resetInfo && (
                  <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                    {resetInfo}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    6-digit code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="123456"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    New password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                {resetError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {resetError}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={resetStep === "resetting"}
                    className="flex-1 bg-emerald-600 text-white text-sm font-semibold py-2.5 rounded-md hover:bg-emerald-700 disabled:opacity-50 transition"
                  >
                    {resetStep === "resetting" ? "Updating…" : "Set new password"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="px-3 text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2"
                  >
                    Resend
                  </button>
                </div>
              </form>
            )}
            {resetStep === "idle" && resetError && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {resetError}
              </div>
            )}
          </div>
        )}

        <p className="mt-4 text-xs text-slate-400 text-center">
          Need an observer account? Ask an admin to create one for you.
        </p>
      </div>
    </div>
  );
}
