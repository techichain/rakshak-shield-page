import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { PlatformShell, Section } from "@/components/rakshak-platform/Shell";

const callbackSearchSchema = z.object({
  code: z.string().optional(),
  mode: z.enum(["login", "register"]).default("login").catch("login"),
  role: z.enum(["team", "mentor", "evaluator", "admin"]).default("team").catch("team"),
  error_description: z.string().optional(),
});

export const Route = createFileRoute("/rakshak-platform/auth/callback")({
  validateSearch: (s: Record<string, unknown>) => callbackSearchSchema.parse(s),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { code, mode, role, error_description } = Route.useSearch();
  const [error, setError] = useState<string | null>(error_description ?? null);

  useEffect(() => {
    let cancelled = false;

    async function finishSignIn() {
      try {
        if (error_description) throw new Error(error_description);
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) throw new Error("This sign-in link is invalid or has expired. Please request a new link.");

        if (cancelled) return;
        if (mode === "register") {
          navigate({ to: "/rakshak-platform/auth", search: { mode, role, verified: "1" }, replace: true });
        } else {
          navigate({ to: "/rakshak-platform/dashboard", replace: true });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not complete sign-in.");
      }
    }

    finishSignIn();
    return () => {
      cancelled = true;
    };
  }, [code, error_description, mode, navigate, role]);

  return (
    <PlatformShell>
      <Section>
        <div className="mx-auto max-w-md space-y-4">
          <h1 className="font-heading text-3xl font-bold">Completing sign-in…</h1>
          {error ? (
            <>
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => navigate({ to: "/rakshak-platform/auth", search: { mode, role }, replace: true })}
                className="h-12 w-full rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
              >
                Request a new link
              </button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Please wait while we securely verify your email.</p>
          )}
        </div>
      </Section>
    </PlatformShell>
  );
}