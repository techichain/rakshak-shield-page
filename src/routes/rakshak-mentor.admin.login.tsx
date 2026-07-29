import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/mentor/auth";

export const Route = createFileRoute("/rakshak-mentor/admin/login")({
  head: () => ({ meta: [{ title: "Admin · Project Rakshak Mentor Portal" }] }),
  component: AdminLogin,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});

function AdminLogin() {
  const navigate = useNavigate();
  const { loading, isAdmin } = useIsAdmin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Guard against a pre-hydration native form submit (page reloads silently).
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!loading && isAdmin) navigate({ to: "/rakshak-mentor/admin" });
  }, [loading, isAdmin, navigate]);


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email.toLowerCase(),
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
        <div className="mb-6">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-medium">
            Crashfree India
          </div>
          <h1 className="mt-1 text-lg font-bold text-slate-900">
            Project Rakshak — Admin
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Sign in to review applications
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#4A35FF]/30 focus:border-[#4A35FF]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#4A35FF]/30 focus:border-[#4A35FF]"
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
            disabled={submitting || !hydrated}
            className="w-full bg-[#4A35FF] text-white text-sm font-semibold py-2.5 rounded-md hover:bg-[#3A28D9] disabled:opacity-50 transition"
          >
            {submitting ? "Please wait…" : "Sign in"}
          </button>

        </form>
        <p className="mt-5 text-xs text-slate-400 text-center">
          Access is restricted to CFI core-team admins.
        </p>
      </div>
    </div>
  );
}
