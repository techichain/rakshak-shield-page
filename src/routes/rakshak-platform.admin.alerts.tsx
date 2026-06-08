import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { listAlertRules, upsertAlertRule, deleteAlertRule, escalateAlerts } from "@/lib/rakshak-platform/cron-alerts.functions";
import { Plus, Trash2, BellRing, ShieldCheck, AlertTriangle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/rakshak-platform/admin/alerts")({
  component: AlertsPage,
  errorComponent: ({ error }) => {
    if (String(error).includes("Forbidden") || String(error).includes("Unauthorized")) {
      throw redirect({ to: "/rakshak-platform/auth" });
    }
    return <PlatformShell><Section><p role="alert" className="text-destructive">{String(error)}</p></Section></PlatformShell>;
  },
  notFoundComponent: () => <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>,
});

function AlertsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listAlertRules);
  const save = useServerFn(upsertAlertRule);
  const del = useServerFn(deleteAlertRule);
  const escalate = useServerFn(escalateAlerts);
  const { data } = useSuspenseQuery({ queryKey: ["rp-alert-rules"], queryFn: () => list() });
  const [editing, setEditing] = useState<any | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const { data: recentAlerts } = useQuery({
    queryKey: ["rp-recent-alert-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rp_notifications")
        .select("id,title,message,created_at,is_read,related_entity_id")
        .like("type", "cron_alert%")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await save({
        data: {
          id: editing?.id,
          hook_name: String(fd.get("hook_name") || "").trim(),
          max_consecutive_failures: Number(fd.get("max_consecutive_failures") || 3),
          max_stale_hours: Number(fd.get("max_stale_hours") || 24),
          is_active: fd.get("is_active") === "on",
          notes: String(fd.get("notes") || "") || null,
        },
      });
      setEditing(null);
      (e.target as HTMLFormElement).reset();
      setMsg("Rule saved.");
      qc.invalidateQueries({ queryKey: ["rp-alert-rules"] });
    } catch (err: any) {
      setMsg(err?.message ?? "Save failed");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete alert rule for ${name}?`)) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["rp-alert-rules"] });
  }

  async function handleEscalate() {
    const r = await escalate();
    setMsg(`Escalated ${r.escalated} alert${r.escalated === 1 ? "" : "s"}.`);
    qc.invalidateQueries({ queryKey: ["rp-alert-rules"] });
    qc.invalidateQueries({ queryKey: ["rp-recent-alert-notifications"] });
  }

  const alerting = data.rules.filter((r: any) => r.is_alerting);
  const bySeverity = {
    failing: alerting.filter((r: any) => r.alert_reason?.includes("consecutive failures")),
    stale: alerting.filter((r: any) => r.alert_reason?.startsWith("No run")),
  };

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Cron alerts</Eyebrow>
        <div className="mt-3 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">
            Alert thresholds.<br /><span className="text-brand">Escalation rules.</span>
          </h1>
          <button
            onClick={handleEscalate}
            className="inline-flex items-center gap-2 min-h-11 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90"
            aria-label="Run escalation evaluation now"
          >
            <Send className="h-4 w-4" aria-hidden /> Run escalation now
          </button>
        </div>
        {msg && <p role="status" className="mt-3 text-sm text-muted-foreground">{msg}</p>}

        {alerting.length > 0 && (
          <div className="mt-8 rounded-2xl border border-red-300 bg-red-50 p-5" role="alert" aria-live="polite">
            <div className="flex items-center gap-2 text-red-800">
              <BellRing className="h-5 w-5" aria-hidden />
              <span className="font-medium">{alerting.length} hook{alerting.length === 1 ? "" : "s"} currently alerting</span>
            </div>
            {bySeverity.failing.length > 0 && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-red-800">Failing</h3>
                <ul className="mt-1 text-sm space-y-1 text-red-900">
                  {bySeverity.failing.map((r: any) => (
                    <li key={r.id}><span className="font-mono font-semibold">{r.hook_name}</span> — {r.alert_reason}</li>
                  ))}
                </ul>
              </div>
            )}
            {bySeverity.stale.length > 0 && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-red-800">Stale</h3>
                <ul className="mt-1 text-sm space-y-1 text-red-900">
                  {bySeverity.stale.map((r: any) => (
                    <li key={r.id}><span className="font-mono font-semibold">{r.hook_name}</span> — {r.alert_reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <form onSubmit={submit} className="mt-10 rounded-2xl border border-border bg-background p-6" aria-labelledby="rule-form-heading">
          <h2 id="rule-form-heading" className="font-heading text-xl">{editing ? `Edit rule: ${editing.hook_name}` : "Add a rule"}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <div className="md:col-span-2">
              <label htmlFor="hook_name" className="text-xs text-muted-foreground">Hook name</label>
              <input id="hook_name" name="hook_name" required maxLength={80} placeholder="meeting-reminders" defaultValue={editing?.hook_name ?? ""} className="rp-input w-full" />
            </div>
            <div>
              <label htmlFor="max_consecutive_failures" className="text-xs text-muted-foreground">Max failures</label>
              <input id="max_consecutive_failures" name="max_consecutive_failures" type="number" min={1} max={50} required defaultValue={editing?.max_consecutive_failures ?? 3} className="rp-input w-full" />
            </div>
            <div>
              <label htmlFor="max_stale_hours" className="text-xs text-muted-foreground">Stale (hours)</label>
              <input id="max_stale_hours" name="max_stale_hours" type="number" min={1} max={720} required defaultValue={editing?.max_stale_hours ?? 24} className="rp-input w-full" />
            </div>
            <label className="inline-flex items-center gap-2 text-sm self-end min-h-12 px-4 rounded-full border border-border">
              <input type="checkbox" name="is_active" defaultChecked={editing ? editing.is_active : true} /> Active
            </label>
          </div>
          <div className="mt-3">
            <label htmlFor="notes" className="text-xs text-muted-foreground">Notes</label>
            <input id="notes" name="notes" maxLength={500} placeholder="Optional context for on-call" defaultValue={editing?.notes ?? ""} className="rp-input w-full" />
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="inline-flex items-center gap-2 min-h-11 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90">
              <Plus className="h-4 w-4" aria-hidden /> {editing ? "Update rule" : "Add rule"}
            </button>
            {editing && <button type="button" onClick={() => setEditing(null)} className="min-h-11 rounded-full border border-border px-5 text-sm">Cancel</button>}
          </div>
        </form>

        <h2 className="mt-12 font-heading text-xl">All rules</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">Configured cron alert rules</caption>
            <thead className="bg-brand-lite text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">Hook</th>
                <th scope="col" className="px-4 py-3">Active</th>
                <th scope="col" className="px-4 py-3">Max failures</th>
                <th scope="col" className="px-4 py-3">Stale window</th>
                <th scope="col" className="px-4 py-3">Current state</th>
                <th scope="col" className="px-4 py-3">Last run</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.rules.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No alert rules yet.</td></tr>
              )}
              {data.rules.map((r: any) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs">{r.hook_name}</td>
                  <td className="px-4 py-3">{r.is_active ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{r.max_consecutive_failures} <span className="text-muted-foreground">({r.consecutive_failures} now)</span></td>
                  <td className="px-4 py-3">{r.max_stale_hours}h</td>
                  <td className="px-4 py-3">
                    {r.is_alerting ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-red-300 bg-red-50 text-red-800">
                        <AlertTriangle className="h-3 w-3" aria-hidden /> Alerting
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800">
                        <ShieldCheck className="h-3 w-3" aria-hidden /> Healthy
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.last_run_at ? new Date(r.last_run_at).toLocaleString() : "Never"}</td>
                  <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                    <button onClick={() => setEditing(r)} className="text-xs text-brand hover:underline" aria-label={`Edit rule for ${r.hook_name}`}>Edit</button>
                    <button onClick={() => handleDelete(r.id, r.hook_name)} className="text-xs text-red-700 hover:underline inline-flex items-center gap-1" aria-label={`Delete rule for ${r.hook_name}`}>
                      <Trash2 className="h-3 w-3" aria-hidden /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-12 font-heading text-xl">Recent triggered alerts</h2>
        <p className="text-xs text-muted-foreground mt-1">Notifications sent to admin recipients (last 20).</p>
        <ul className="mt-3 space-y-2">
          {(recentAlerts ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">No alerts have been escalated yet.</li>
          )}
          {(recentAlerts ?? []).map((n: any) => (
            <li key={n.id} className="rounded-xl border border-border bg-background p-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{n.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>
              </div>
              <time className="text-xs text-muted-foreground whitespace-nowrap" dateTime={n.created_at}>
                {new Date(n.created_at).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      </Section>
    </PlatformShell>
  );
}
