import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { getCronHealth } from "@/lib/rakshak-platform/analytics.functions";
import { escalateAlerts } from "@/lib/rakshak-platform/cron-alerts.functions";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, BellRing } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/cron-health")({
  component: CronHealthPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p className="text-red-600">{String(error)}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
});

function CronHealthPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { loading, userId, isAdmin } = useRPAuth();
  const fn = useServerFn(getCronHealth);
  const escalate = useServerFn(escalateAlerts);

  useEffect(() => {
    if (loading) return;
    if (!userId) navigate({ to: "/rakshak-platform/auth" });
    else if (!isAdmin) navigate({ to: "/rakshak-platform/dashboard" });
    else escalate().catch(() => {});
  }, [loading, userId, isAdmin, navigate, escalate]);

  const { data } = useSuspenseQuery({
    queryKey: ["rp-cron-health"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });

  if (!isAdmin) return null;

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Monitoring</Eyebrow>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="text-3xl font-extrabold">Cron & webhook health</h1>
          <button onClick={() => qc.invalidateQueries({ queryKey: ["rp-cron-health"] })} className="rp-btn-secondary inline-flex items-center gap-1">
            <RefreshCw className="size-4" /> Refresh
          </button>
        </div>

        {data.summary.length === 0 ? (
          <div className="rp-card p-6">
            <p className="text-muted-foreground">No cron runs recorded yet. Hooks log into <code>rp_cron_runs</code> on each invocation.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {data.summary.map((h) => (
              <div key={h.hook} className="rp-card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{h.hook}</h3>
                  {h.is_stale ? (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-700 inline-flex items-center gap-1">
                      <AlertTriangle className="size-3" /> Stale
                    </span>
                  ) : h.last_status === "ok" ? (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 inline-flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Healthy
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 inline-flex items-center gap-1">
                      <XCircle className="size-3" /> {h.last_status}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                  <Cell label="Runs (last 200)" value={h.total_runs} />
                  <Cell label="Success rate" value={`${h.success_rate}%`} />
                  <Cell label="Avg duration" value={`${h.avg_duration_ms} ms`} />
                  <Cell label="Last duration" value={h.last_duration_ms ? `${h.last_duration_ms} ms` : "—"} />
                  <Cell label="Last run" value={h.last_run_at ? new Date(h.last_run_at).toLocaleString() : "Never"} className="col-span-2" />
                </div>
                {h.last_error && (
                  <div className="mt-3 text-xs bg-red-50 border border-red-200 text-red-700 p-2 rounded">
                    {h.last_error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="rp-card p-5">
          <h3 className="font-semibold mb-3">Recent runs</h3>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <tr><th className="py-2 pr-3">When</th><th className="pr-3">Hook</th><th className="pr-3">Status</th><th className="pr-3">HTTP</th><th className="pr-3">Duration</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {data.recent.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.started_at).toLocaleString()}</td>
                    <td className="pr-3">{r.hook_name}</td>
                    <td className="pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{r.status}</span>
                    </td>
                    <td className="pr-3">{r.http_status ?? "—"}</td>
                    <td className="pr-3">{r.duration_ms ?? "—"} ms</td>
                    <td className="pr-3 text-xs text-muted-foreground truncate max-w-[260px]">{r.error_message ?? (r.notes ? JSON.stringify(r.notes) : "")}</td>
                  </tr>
                ))}
                {data.recent.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground text-sm">No runs yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
    </PlatformShell>
  );
}

function Cell({ label, value, className }: { label: string; value: any; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
