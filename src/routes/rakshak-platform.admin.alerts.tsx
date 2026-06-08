import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { listAlertRules, upsertAlertRule, deleteAlertRule, escalateAlerts } from "@/lib/rakshak-platform/cron-alerts.functions";
import { Plus, Trash2, BellRing, ShieldCheck, AlertTriangle, Send } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/alerts")({
  component: AlertsPage,
  errorComponent: ({ error }) => {
    if (String(error).includes("Forbidden") || String(error).includes("Unauthorized")) {
      throw redirect({ to: "/rakshak-platform/auth" });
    }
    return <PlatformShell><Section><p className="text-red-600">{String(error)}</p></Section></PlatformShell>;
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
      qc.invalidateQueries({ queryKey: ["rp-alert-rules"] });
    } catch (err: any) {
      setMsg(err?.message ?? "Save failed");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this alert rule?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["rp-alert-rules"] });
  }

  async function handleEscalate() {
    const r = await escalate();
    setMsg(`Escalated ${r.escalated} alert${r.escalated === 1 ? "" : "s"}.`);
    qc.invalidateQueries({ queryKey: ["rp-alert-rules"] });
  }

  const alerting = data.rules.filter((r: any) => r.is_alerting);

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Cron alerts</Eyebrow>
        <div className="mt-3 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="font-heading text-4xl tracking-tight">
            Alert thresholds.<br /><span className="text-brand">Escalation rules.</span>
          </h1>
          <button onClick={handleEscalate} className="inline-flex items-center gap-2 h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90">
            <Send className="h-4 w-4" /> Run escalation now
          </button>
        </div>
        {msg && <p className="mt-3 text-sm text-muted-foreground">{msg}</p>}

        {alerting.length > 0 && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-center gap-2 text-red-700">
              <BellRing className="h-5 w-5" />
              <span className="font-medium">{alerting.length} hook{alerting.length === 1 ? "" : "s"} currently alerting</span>
            </div>
            <ul className="mt-3 text-sm space-y-1 text-red-800/90">
              {alerting.map((r: any) => (
                <li key={r.id}><span className="font-mono font-semibold">{r.hook_name}</span> — {r.alert_reason}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={submit} className="mt-10 rounded-2xl border border-border bg-background p-6">
          <h2 className="font-heading text-xl">{editing ? `Edit rule: ${editing.hook_name}` : "Add a rule"}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <input name="hook_name" required maxLength={80} placeholder="hook-name" defaultValue={editing?.hook_name ?? ""} className="rp-input md:col-span-2" />
            <input name="max_consecutive_failures" type="number" min={1} max={50} required placeholder="Max failures" defaultValue={editing?.max_consecutive_failures ?? 3} className="rp-input" />
            <input name="max_stale_hours" type="number" min={1} max={720} required placeholder="Max stale (hours)" defaultValue={editing?.max_stale_hours ?? 24} className="rp-input" />
            <label className="inline-flex items-center gap-2 text-sm h-12 px-4 rounded-full border border-border">
              <input type="checkbox" name="is_active" defaultChecked={editing ? editing.is_active : true} /> Active
            </label>
          </div>
          <input name="notes" maxLength={500} placeholder="Notes (optional)" defaultValue={editing?.notes ?? ""} className="rp-input mt-3 w-full" />
          <div className="mt-4 flex gap-2">
            <button type="submit" className="inline-flex items-center gap-2 h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90">
              <Plus className="h-4 w-4" /> {editing ? "Update rule" : "Add rule"}
            </button>
            {editing && <button type="button" onClick={() => setEditing(null)} className="h-10 rounded-full border border-border px-5 text-sm">Cancel</button>}
          </div>
        </form>

        <div className="mt-10 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-brand-lite text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Hook</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Max failures</th>
                <th className="px-4 py-3">Stale window</th>
                <th className="px-4 py-3">Current state</th>
                <th className="px-4 py-3">Last run</th>
                <th className="px-4 py-3"></th>
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
                  <td className="px-4 py-3">{r.max_consecutive_failures} ({r.consecutive_failures} now)</td>
                  <td className="px-4 py-3">{r.max_stale_hours}h</td>
                  <td className="px-4 py-3">
                    {r.is_alerting ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-700">
                        <AlertTriangle className="h-3 w-3" /> Alerting
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                        <ShieldCheck className="h-3 w-3" /> Healthy
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.last_run_at ? new Date(r.last_run_at).toLocaleString() : "Never"}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button onClick={() => setEditing(r)} className="text-xs text-brand hover:underline">Edit</button>
                    <button onClick={() => handleDelete(r.id)} className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"><Trash2 className="h-3 w-3" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </PlatformShell>
  );
}
