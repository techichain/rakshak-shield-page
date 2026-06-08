import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { Copy, CheckCircle2, Circle, ExternalLink, Mail, Sparkles, MessageSquare, Database, Webhook } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/integrations")({
  component: IntegrationsPage,
  errorComponent: ({ error }) => {
    if (String(error).includes("Forbidden") || String(error).includes("Unauthorized")) {
      throw redirect({ to: "/rakshak-platform/auth" });
    }
    return <PlatformShell><Section><p className="text-red-600">{String(error)}</p></Section></PlatformShell>;
  },
  notFoundComponent: () => <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>,
});

function IntegrationsPage() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
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
  ];

  const services = [
    {
      icon: <Mail className="h-5 w-5" />,
      name: "Resend (email)",
      configured: true,
      description: "Transactional + digest email delivery via Resend connector.",
      docs: "https://resend.com/docs",
    },
    {
      icon: <Sparkles className="h-5 w-5" />,
      name: "Lovable AI Gateway",
      configured: true,
      description: "Powers the AI report checker (Gemini 2.5 Flash).",
      docs: "https://docs.lovable.dev/features/ai-gateway",
    },
    {
      icon: <Database className="h-5 w-5" />,
      name: "Lovable Cloud (Supabase)",
      configured: true,
      description: "Database, auth, storage, realtime — fully managed.",
      docs: "https://supabase.com/docs",
    },
  ];

  const placeholders = [
    {
      icon: <MessageSquare className="h-5 w-5" />,
      name: "Slack notifications",
      description: "Mirror admin notifications to a Slack channel via incoming webhook.",
      status: "Coming soon",
    },
    {
      icon: <MessageSquare className="h-5 w-5" />,
      name: "WhatsApp Business",
      description: "Send phase deadline reminders to team leaders via WhatsApp Business API.",
      status: "Coming soon",
    },
    {
      icon: <Database className="h-5 w-5" />,
      name: "Google Sheets sync",
      description: "Periodic export of teams / submissions to a shared Sheet for partners.",
      status: "Coming soon",
    },
    {
      icon: <Webhook className="h-5 w-5" />,
      name: "Custom outbound webhooks",
      description: "Fire HTTP callbacks on submission/approval/at-risk events to your stack.",
      status: "Coming soon",
    },
  ];

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Integrations</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Connect Rakshak<br /><span className="text-brand">to your stack.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
          Active webhook endpoints, connected services, and a roadmap of integrations the team can wire up next.
        </p>

        <h2 className="mt-14 font-heading text-2xl">Webhook endpoints</h2>
        <p className="mt-1 text-sm text-muted-foreground">Configure these in pg_cron or your scheduler of choice.</p>
        <div className="mt-6 space-y-4">
          {webhooks.map((w) => {
            const url = `${origin}${w.path}`;
            return (
              <div key={w.path} className="rounded-2xl border border-border bg-background p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="font-heading text-lg">{w.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{w.description}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Live
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-brand-lite border border-brand/15 px-3 py-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-brand text-brand-foreground">{w.method}</span>
                  <code className="flex-1 text-xs truncate">{url}</code>
                  <button onClick={() => copy(url, w.path)} className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
                    {copied === w.path ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied === w.path ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-muted-foreground">Auth: </span><span className="font-mono">{w.auth}</span></div>
                  <div><span className="text-muted-foreground">Cadence: </span>{w.cadence}</div>
                </div>
              </div>
            );
          })}
        </div>

        <h2 className="mt-16 font-heading text-2xl">Connected services</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {services.map((s) => (
            <div key={s.name} className="rounded-2xl border border-border bg-background p-5">
              <div className="flex items-center gap-2 text-brand">{s.icon}<span className="font-heading">{s.name}</span></div>
              <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </span>
                <a href={s.docs} target="_blank" rel="noreferrer" className="text-xs text-brand inline-flex items-center gap-1 hover:underline">
                  Docs <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
        </div>

        <h2 className="mt-16 font-heading text-2xl">Roadmap</h2>
        <p className="mt-1 text-sm text-muted-foreground">External system hooks planned for upcoming releases.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {placeholders.map((p) => (
            <div key={p.name} className="rounded-2xl border border-dashed border-border bg-background p-5 opacity-90">
              <div className="flex items-center gap-2 text-muted-foreground">{p.icon}<span className="font-heading text-foreground">{p.name}</span></div>
              <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
              <div className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Circle className="h-3 w-3" /> {p.status}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </PlatformShell>
  );
}
