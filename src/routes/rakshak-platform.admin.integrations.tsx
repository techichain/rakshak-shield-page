import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { runIntegrationSmoke, type SmokeResult } from "@/lib/rakshak-platform/integrations.functions";
import {
  Copy,
  CheckCircle2,
  Circle,
  ExternalLink,
  Mail,
  Sparkles,
  MessageSquare,
  Database,
  Webhook,
  PlayCircle,
  XCircle,
  MinusCircle,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/integrations")({
  component: IntegrationsPage,
  errorComponent: ({ error }) => {
    if (String(error).includes("Forbidden") || String(error).includes("Unauthorized")) {
      throw redirect({ to: "/rakshak-platform/auth" });
    }
    return (
      <PlatformShell>
        <Section>
          <p role="alert" className="text-destructive">{String(error)}</p>
        </Section>
      </PlatformShell>
    );
  },
  notFoundComponent: () => (
    <PlatformShell>
      <Section><p>Not found.</p></Section>
    </PlatformShell>
  ),
});

const SMOKE_TARGETS: { key: string; name: string }[] = [
  { key: "supabase", name: "Lovable Cloud (database)" },
  { key: "storage", name: "Storage buckets" },
  { key: "ai", name: "Lovable AI Gateway" },
  { key: "admin-digest", name: "Admin digest webhook secret" },
  { key: "cron", name: "Cron run telemetry" },
  { key: "slack", name: "Slack notifications" },
  { key: "whatsapp", name: "WhatsApp Business" },
  { key: "sheets", name: "Google Sheets sync" },
  { key: "outbound", name: "Custom outbound webhooks" },
];

function StatusBadge({ status, size = "sm" }: { status: SmokeResult["status"] | "idle" | "running"; size?: "sm" | "lg" }) {
  const pad = size === "lg" ? "text-sm px-3 py-1" : "text-xs px-2 py-0.5";
  const icon = size === "lg" ? "h-4 w-4" : "h-3 w-3";
  if (status === "running") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border border-border bg-muted text-foreground ${pad}`}>
        <Loader2 className={`${icon} animate-spin`} aria-hidden /> Checking…
      </span>
    );
  }
  if (status === "pass") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 ${pad}`}>
        <CheckCircle2 className={icon} aria-hidden /> Working
      </span>
    );
  }
  if (status === "fail") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 text-red-800 ${pad}`}>
        <XCircle className={icon} aria-hidden /> Not working
      </span>
    );
  }
  if (status === "skip") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border border-border bg-muted text-muted-foreground ${pad}`}>
        <MinusCircle className={icon} aria-hidden /> Not set up
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-border bg-background text-muted-foreground ${pad}`}>
      <Circle className={icon} aria-hidden /> Not checked yet
    </span>
  );
}

function IntegrationsPage() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [copied, setCopied] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, SmokeResult>>({});
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const smoke = useServerFn(runIntegrationSmoke);

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  async function run(keys?: string[]) {
    const target = keys ?? SMOKE_TARGETS.map((t) => t.key);
    setRunning(new Set(target));
    try {
      const r = await smoke({ data: { keys: target } });
      setResults((prev) => {
        const next = { ...prev };
        for (const item of r.results) next[item.key] = item;
        return next;
      });
      setLastRunAt(r.ran_at);
    } catch (e) {
      for (const k of target) {
        setResults((prev) => ({
          ...prev,
          [k]: { key: k, name: k, status: "fail", latency_ms: 0, detail: String((e as any)?.message ?? e) },
        }));
      }
    } finally {
      setRunning(new Set());
    }
  }

  const webhooks = [
    {
      name: "Admin weekly digest",
      path: "/api/public/hooks/admin-digest",
      method: "POST",
      auth: "Bearer ADMIN_DIGEST_WEBHOOK_SECRET",
      cadence: "Weekly (Sundays 18:00 IST recommended)",
      description: "Sends weekly programme summary to admins via email + in-app.",
    },
    {
      name: "Meeting reminders",
      path: "/api/public/hooks/meeting-reminders",
      method: "POST",
      auth: "None (idempotent)",
      cadence: "Every 5 minutes",
      description: "Fires 24h/1h/30m reminders for upcoming mentor & team meetings.",
    },
    {
      name: "Health ping",
      path: "/api/public/hooks/health-ping",
      method: "GET",
      auth: "None",
      cadence: "Ad-hoc / uptime checks",
      description: "Lightweight liveness endpoint used by external uptime monitors and smoke tests.",
    },
  ];

  const services = [
    { key: "ai", icon: <Sparkles className="h-5 w-5" aria-hidden />, name: "Lovable AI Gateway", description: "Powers the AI report checker (Gemini 2.5 Flash).", docs: "https://docs.lovable.dev/features/ai-gateway" },
    { key: "supabase", icon: <Database className="h-5 w-5" aria-hidden />, name: "Lovable Cloud", description: "Database, auth, storage, realtime — fully managed.", docs: "https://supabase.com/docs" },
    { key: "admin-digest", icon: <Mail className="h-5 w-5" aria-hidden />, name: "Resend (email)", description: "Transactional + digest email delivery via Resend.", docs: "https://resend.com/docs" },
  ];

  const placeholders = [
    { key: "slack", icon: <MessageSquare className="h-5 w-5" aria-hidden />, name: "Slack notifications", description: "Mirror admin notifications to a Slack channel via incoming webhook." },
    { key: "whatsapp", icon: <MessageSquare className="h-5 w-5" aria-hidden />, name: "WhatsApp Business", description: "Send phase deadline reminders to team leaders via WhatsApp Business API." },
    { key: "sheets", icon: <Database className="h-5 w-5" aria-hidden />, name: "Google Sheets sync", description: "Periodic export of teams / submissions to a shared Sheet for partners." },
    { key: "outbound", icon: <Webhook className="h-5 w-5" aria-hidden />, name: "Custom outbound webhooks", description: "Fire HTTP callbacks on submission/approval/at-risk events to your stack." },
  ];

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Integrations</Eyebrow>
        <div className="mt-3 flex items-end justify-between gap-4 flex-wrap">
          <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">
            Connect Rakshak<br /><span className="text-brand">to your stack.</span>
          </h1>
          <button
            onClick={() => run()}
            disabled={running.size > 0}
            className="inline-flex items-center gap-2 min-h-11 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
            aria-label="Run all integration smoke tests"
          >
            {running.size > 0 ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PlayCircle className="h-4 w-4" aria-hidden />}
            Run all smoke tests
          </button>
        </div>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
          Active webhook endpoints, connected services, and a roadmap of integrations the team can wire up next.
          Run smoke tests to validate readiness before connecting real external systems.
        </p>
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          {lastRunAt ? `Last run: ${new Date(lastRunAt).toLocaleString()}` : "No smoke tests run yet."}
        </p>

        <h2 className="mt-14 font-heading text-2xl">Webhook endpoints</h2>
        <p className="mt-1 text-sm text-muted-foreground">Configure these in pg_cron or your scheduler of choice.</p>
        <div className="mt-6 space-y-4">
          {webhooks.map((w) => {
            const url = `${origin}${w.path}`;
            return (
              <article key={w.path} className="rounded-2xl border border-border bg-background p-5" aria-labelledby={`hook-${w.path}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h3 id={`hook-${w.path}`} className="font-heading text-lg">{w.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{w.description}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" aria-hidden /> Live
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-brand-lite border border-brand/15 px-3 py-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-brand text-brand-foreground" aria-label={`HTTP method ${w.method}`}>{w.method}</span>
                  <code className="flex-1 text-xs truncate">{url}</code>
                  <button
                    onClick={() => copy(url, w.path)}
                    className="inline-flex items-center gap-1 text-xs text-brand hover:underline min-h-9 px-2"
                    aria-label={`Copy URL for ${w.name}`}
                  >
                    {copied === w.path ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
                    {copied === w.path ? "Copied" : "Copy"}
                  </button>
                </div>
                <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div><dt className="text-muted-foreground inline">Auth: </dt><dd className="inline font-mono">{w.auth}</dd></div>
                  <div><dt className="text-muted-foreground inline">Cadence: </dt><dd className="inline">{w.cadence}</dd></div>
                </dl>
              </article>
            );
          })}
        </div>

        <h2 className="mt-16 font-heading text-2xl">Connected services</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 list-none p-0">
          {services.map((s) => {
            const res = results[s.key];
            const isRunning = running.has(s.key);
            return (
              <li key={s.key} className="rounded-2xl border border-border bg-background p-5">
                <div className="flex items-center gap-2 text-brand">{s.icon}<span className="font-heading text-foreground">{s.name}</span></div>
                <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
                <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                  <StatusBadge status={isRunning ? "running" : (res?.status ?? "idle") as any} />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => run([s.key])}
                      disabled={isRunning}
                      className="text-xs text-brand hover:underline inline-flex items-center gap-1 min-h-9"
                      aria-label={`Run smoke test for ${s.name}`}
                    >
                      <PlayCircle className="h-3.5 w-3.5" aria-hidden /> Smoke test
                    </button>
                    <a href={s.docs} target="_blank" rel="noreferrer" className="text-xs text-brand inline-flex items-center gap-1 hover:underline min-h-9" aria-label={`${s.name} docs (opens in new tab)`}>
                      Docs <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  </div>
                </div>
                {res && (
                  <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
                    {res.detail} {res.latency_ms ? `· ${res.latency_ms}ms` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        <h2 className="mt-16 font-heading text-2xl">Roadmap (smoke-testable)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each placeholder reports a clear readiness signal so you can validate wiring the moment credentials land.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 list-none p-0">
          {placeholders.map((p) => {
            const res = results[p.key];
            const isRunning = running.has(p.key);
            return (
              <li key={p.key} className="rounded-2xl border border-dashed border-border bg-background p-5">
                <div className="flex items-center gap-2 text-muted-foreground">{p.icon}<span className="font-heading text-foreground">{p.name}</span></div>
                <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                  <StatusBadge status={isRunning ? "running" : (res?.status ?? "idle") as any} />
                  <button
                    type="button"
                    onClick={() => run([p.key])}
                    disabled={isRunning}
                    className="text-xs text-brand hover:underline inline-flex items-center gap-1 min-h-9"
                    aria-label={`Run smoke test for ${p.name}`}
                  >
                    <PlayCircle className="h-3.5 w-3.5" aria-hidden /> Smoke test
                  </button>
                </div>
                {res && (
                  <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
                    {res.detail}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
    </PlatformShell>
  );
}
