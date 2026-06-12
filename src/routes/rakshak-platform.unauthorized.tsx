import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";

type Search = { attempted?: string; reason?: string; required?: string };

export const Route = createFileRoute("/rakshak-platform/unauthorized")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    attempted: typeof s.attempted === "string" ? s.attempted : undefined,
    reason: typeof s.reason === "string" ? s.reason : undefined,
    required: typeof s.required === "string" ? s.required : undefined,
  }),
  component: Unauthorized,
});

function Unauthorized() {
  const search = useSearch({ from: "/rakshak-platform/unauthorized" }) as Search;
  return (
    <PlatformShell>
      <Section>
        <div data-testid="rp-unauthorized" className="max-w-2xl">
          <Eyebrow>403 · Access denied</Eyebrow>
          <h1 className="mt-6 font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
            You don't have access<br />
            <span className="text-brand">to this page.</span>
          </h1>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
            <ShieldAlert className="h-5 w-5 text-brand mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground space-y-1">
              {search.attempted && (
                <div><span className="text-foreground font-semibold">Attempted:</span> {search.attempted}</div>
              )}
              {search.required && (
                <div><span className="text-foreground font-semibold">Required role:</span> {search.required}</div>
              )}
              {search.reason && (
                <div><span className="text-foreground font-semibold">Reason:</span> {search.reason}</div>
              )}
              <div className="pt-2">
                This attempt has been logged. If you believe this is a mistake, contact an administrator.
              </div>
            </div>
          </div>
          <div className="mt-8 flex gap-3">
            <Link
              to="/rakshak-platform/dashboard"
              className="h-11 rounded-full bg-brand px-6 text-sm text-brand-foreground inline-flex items-center hover:bg-brand/90"
            >
              Back to dashboard
            </Link>
            <Link
              to="/rakshak-platform"
              className="h-11 rounded-full border border-border px-6 text-sm inline-flex items-center hover:border-brand"
            >
              Home
            </Link>
          </div>
        </div>
      </Section>
    </PlatformShell>
  );
}
