import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { CheckCircle2, Circle, XCircle, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/qa-checklist")({
  component: QAChecklistPage,
  errorComponent: ({ error }) => {
    if (String(error).includes("Forbidden") || String(error).includes("Unauthorized")) {
      throw redirect({ to: "/rakshak-platform/auth" });
    }
    return <PlatformShell><Section><p role="alert" className="text-destructive">{String(error)}</p></Section></PlatformShell>;
  },
  notFoundComponent: () => <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>,
});

type State = "pending" | "pass" | "fail";

const STORAGE_KEY = "rp-qa-checklist-v1";

const GROUPS: { title: string; items: { id: string; label: string; detail?: string }[] }[] = [
  {
    title: "Auth",
    items: [
      { id: "auth-signin", label: "Sign in with email + password" },
      { id: "auth-google", label: "Sign in with Google OAuth" },
      { id: "auth-redirect", label: "Visiting an admin URL while signed out redirects to /auth" },
      { id: "auth-signout", label: "Sign out clears session and protected nav links" },
    ],
  },
  {
    title: "Admin dashboards",
    items: [
      { id: "admin-home", label: "Admin home loads (no console errors)" },
      { id: "admin-analytics", label: "Analytics charts render with non-zero data" },
      { id: "admin-cohorts", label: "Cohorts list + create flow works" },
      { id: "admin-meetings", label: "All-meetings table paginates" },
      { id: "admin-roles", label: "Roles approval/revoke flow updates user_roles" },
    ],
  },
  {
    title: "Cron & alerts",
    items: [
      { id: "cron-groups", label: "Cron health page shows grouped status (failing/stale/degraded/healthy)" },
      { id: "cron-refresh", label: "Refresh re-fetches and updates timestamps" },
      { id: "alerts-rule", label: "Create + edit + delete an alert rule" },
      { id: "alerts-escalate", label: "Manual escalation creates admin notifications" },
    ],
  },
  {
    title: "QA sweep",
    items: [
      { id: "qa-loads", label: "/admin/qa loads with at least one severity bucket" },
      { id: "qa-filter", label: "Severity filter updates counts" },
    ],
  },
  {
    title: "Certificates",
    items: [
      { id: "cert-issue", label: "Admin can issue a certificate from /admin/certificates" },
      { id: "cert-verify", label: "Public /verify/<slug> shows verified state" },
      { id: "cert-revoke", label: "Revoking a certificate flips the public page to 'revoked'" },
    ],
  },
  {
    title: "Exports",
    items: [
      { id: "export-csv", label: "Each dataset exports a non-empty CSV" },
      { id: "export-print", label: "Print-to-PDF route renders all rows" },
    ],
  },
  {
    title: "Integrations",
    items: [
      { id: "int-smoke-all", label: "'Run all smoke tests' returns at least one pass" },
      { id: "int-healthping", label: "/api/public/hooks/health-ping returns ok JSON" },
      { id: "int-copy", label: "Copy buttons for webhook URLs work" },
    ],
  },
  {
    title: "Responsive",
    items: [
      { id: "resp-360", label: "Layouts at 360×800 (small phone) — no horizontal scroll" },
      { id: "resp-768", label: "Tablet (768×1024) — admin nav usable" },
      { id: "resp-1280", label: "Desktop (1280×720) — content centered, no overflow" },
    ],
  },
];

function QAChecklistPage() {
  const [state, setState] = useState<Record<string, State>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  function set(id: string, s: State) {
    setState((p) => ({ ...p, [id]: s }));
  }

  function reset() {
    if (!confirm("Reset all checklist results?")) return;
    setState({});
  }

  const total = GROUPS.reduce((n, g) => n + g.items.length, 0);
  const pass = Object.values(state).filter((v) => v === "pass").length;
  const fail = Object.values(state).filter((v) => v === "fail").length;
  const pending = total - pass - fail;

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · QA</Eyebrow>
        <div className="mt-3 flex items-end justify-between gap-4 flex-wrap">
          <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">
            Manual QA<br /><span className="text-brand">regression checklist.</span>
          </h1>
          <button onClick={reset} className="inline-flex items-center gap-2 min-h-11 px-4 rounded-full border border-border text-sm hover:border-brand/40" aria-label="Reset checklist">
            <RotateCcw className="h-4 w-4" aria-hidden /> Reset
          </button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Tick each scenario as you verify it. Results persist locally in your browser only.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs" aria-live="polite">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">{pass} pass</span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-800 border border-red-300">{fail} fail</span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border">{pending} pending</span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-border text-muted-foreground">{total} total</span>
        </div>

        <div className="mt-10 space-y-8">
          {GROUPS.map((g) => (
            <section key={g.title} aria-labelledby={`grp-${g.title}`}>
              <h2 id={`grp-${g.title}`} className="font-heading text-xl">{g.title}</h2>
              <ul className="mt-3 space-y-2">
                {g.items.map((it) => {
                  const s = state[it.id] ?? "pending";
                  return (
                    <li key={it.id} className="rounded-xl border border-border bg-background p-3 flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-2">
                        {s === "pass" ? <CheckCircle2 className="h-5 w-5 text-emerald-700 mt-0.5" aria-hidden /> :
                          s === "fail" ? <XCircle className="h-5 w-5 text-red-700 mt-0.5" aria-hidden /> :
                          <Circle className="h-5 w-5 text-muted-foreground mt-0.5" aria-hidden />}
                        <span className="text-sm">{it.label}</span>
                      </div>
                      <div className="flex items-center gap-1" role="group" aria-label={`Set status for ${it.label}`}>
                        <button onClick={() => set(it.id, "pass")} aria-pressed={s === "pass"} className={`text-xs min-h-9 px-3 rounded-full border ${s === "pass" ? "bg-emerald-100 text-emerald-900 border-emerald-400" : "border-border text-muted-foreground hover:border-emerald-300"}`}>Pass</button>
                        <button onClick={() => set(it.id, "fail")} aria-pressed={s === "fail"} className={`text-xs min-h-9 px-3 rounded-full border ${s === "fail" ? "bg-red-100 text-red-900 border-red-400" : "border-border text-muted-foreground hover:border-red-300"}`}>Fail</button>
                        <button onClick={() => set(it.id, "pending")} aria-pressed={s === "pending"} className={`text-xs min-h-9 px-3 rounded-full border ${s === "pending" ? "bg-muted text-foreground border-border" : "border-border text-muted-foreground"}`}>Reset</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </Section>
    </PlatformShell>
  );
}
