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

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/gigrider-checklist" });
  }, [loading, user, navigate]);

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

        <p className="mt-4 text-xs text-slate-400 text-center">
          Need an observer account? Ask an admin to create one for you.
        </p>
      </div>
    </div>
  );
}
