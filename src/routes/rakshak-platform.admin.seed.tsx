import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { seedDemoAccounts, seedDemoContent } from "@/lib/rakshak-platform/seed.functions";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { Sparkles, Users } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/seed")({
  component: SeedPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p>Could not load: {String(error)}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
});

function SeedPage() {
  const auth = useRPAuth();
  const acc = useServerFn(seedDemoAccounts);
  const con = useServerFn(seedDemoContent);
  const [accResult, setAccResult] = useState<any>(null);
  const [conResult, setConResult] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (auth.loading) {
    return <PlatformShell><Section><p>Loading…</p></Section></PlatformShell>;
  }
  if (!auth.isAdmin) {
    return <PlatformShell><Section><p>Admins only.</p></Section></PlatformShell>;
  }

  async function runAccounts() {
    setBusy("accounts"); setErr(null);
    try { setAccResult(await acc()); } catch (e: any) { setErr(String(e?.message ?? e)); }
    finally { setBusy(null); }
  }
  async function runContent() {
    setBusy("content"); setErr(null);
    try { setConResult(await con({ data: { confirm: true } })); } catch (e: any) { setErr(String(e?.message ?? e)); }
    finally { setBusy(null); }
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Demo seed</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">Demo accounts & data</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Create demo user accounts (one per role) and populate the database with sample teams, hazard locations, and paid sponsorships. Safe to run multiple times — accounts upsert, content appends.
        </p>

        {err && <p className="mt-4 text-sm text-red-600">{err}</p>}

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background p-6">
            <Users className="h-5 w-5 text-brand" />
            <h2 className="mt-3 font-heading text-xl">Demo accounts</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Creates one login per role with password <code className="font-mono">RakshakDemo!23</code>.
            </p>
            <button
              disabled={busy === "accounts"}
              onClick={runAccounts}
              className="mt-4 h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
            >
              {busy === "accounts" ? "Creating…" : "Create demo accounts"}
            </button>
            {accResult && (
              <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4 text-xs">
                <div className="mb-2 font-semibold">Password: {accResult.password}</div>
                <ul className="space-y-1">
                  {accResult.accounts.map((a: any) => (
                    <li key={a.email}>
                      <span className="font-mono">{a.email}</span> — {a.role} ({a.status})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-background p-6">
            <Sparkles className="h-5 w-5 text-brand" />
            <h2 className="mt-3 font-heading text-xl">Demo content</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Adds a cohort, 4 teams across cities, ~20 hazard locations, and 4 paid sponsorships.
            </p>
            <button
              disabled={busy === "content"}
              onClick={runContent}
              className="mt-4 h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
            >
              {busy === "content" ? "Seeding…" : "Seed demo content"}
            </button>
            {conResult && (
              <pre className="mt-5 overflow-x-auto rounded-xl border border-border bg-muted/40 p-4 text-xs">
                {JSON.stringify(conResult, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </Section>
    </PlatformShell>
  );
}
