import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { getCronHealth } from "@/lib/rakshak-platform/analytics.functions";
import { escalateAlerts } from "@/lib/rakshak-platform/cron-alerts.functions";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, BellRing, Clock } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/cron-health")({
  component: CronHealthPage,
  errorComponent: ({ error }) => (
    <PlatformShell>
      <Section><p role="alert" className="text-destructive">{String(error)}</p></Section>
    </PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
});

type Bucket = "failing" | "stale" | "degraded" | "healthy" | "unknown";

function bucketize(h: any): Bucket {
  if (!h.last_run_at) return "unknown";
  if (h.is_stale) return "stale";
  if (h.last_status !== "ok") return "failing";
  if (h.success_rate !== null && h.success_rate < 90) return "degraded";
  return "healthy";
}

const BUCKET_META: Record<Bucket, { label: string; tone: string; aria: string }> = {
  failing: { label: "Failing", tone: "bg-red-50 text-red-800 border-red-300", aria: "Failing hooks" },
  stale: { label: "Stale", tone: "bg-amber-50 text-amber-900 border-amber-300", aria: "Stale hooks" },
  degraded: { label: "Degraded", tone: "bg-orange-50 text-orange-900 border-orange-300", aria: "Degraded hooks" },
  healthy: { label: "Healthy", tone: "bg-emerald-50 text-emerald-800 border-emerald-300", aria: "Healthy hooks" },
  unknown: { label: "Unknown", tone: "bg-muted text-muted-foreground border-border", aria: "Hooks with no runs yet" },
};

function CronHealthPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { loading, userId, isAdmin } = useRPAuth();
  const fn = useServerFn(getCronHealth);
  const escalate = useServerFn(escalateAlerts);
  const [escalateMsg, setEscalateMsg] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!userId) navigate({ to: "/rakshak-platform/auth" });
    else if (!isAdmin) navigate({ to: "/rakshak-platform/dashboard" });
    else escalate().then((r: any) => r?.escalated ? setEscalateMsg(`Escalated ${r.escalated} alert${r.escalated === 1 ? "" : "s"}.`) : null).catch(() => {});
  }, [loading, userId, isAdmin, navigate, escalate]);

  const { data } = useSuspenseQuery({
    queryKey: ["rp-cron-health"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });

  const grouped = useMemo(() => {
    const g: Record<Bucket, any[]> = { failing: [], stale: [], degraded: [], healthy: [], unknown: [] };
    for (const h of data.summary) g[bucketize(h)].push(h);
    return g;
  }, [data.summary]);

  if (!isAdmin) return null;

  const order: Bucket[] = ["failing", "stale", "degraded", "healthy", "unknown"];

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Monitoring</Eyebrow>
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Cron &amp; webhook health</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/rakshak-platform/admin/alerts" className="inline-flex items-center gap-1 min-h-11 px-4 rounded-full border border-border text-sm hover:border-brand/40">
              <BellRing className="size-4" aria-hidden /> Alert rules
            </Link>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ["rp-cron-health"] })}
              className="inline-flex items-center gap-1 min-h-11 px-4 rounded-full border border-border text-sm hover:border-brand/40"
              aria-label="Refresh cron health data"
            >
              <RefreshCw className="size-4" aria-hidden /> Refresh
            </button>
          </div>
        </div>
        {escalateMsg && (
          <p role="status" className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 mb-4">{escalateMsg}</p>
        )}

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Hook status summary">
          {order.map((b) => (
            <span key={b} className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full border ${BUCKET_META[b].tone}`} aria-label={`${grouped[b].length} ${BUCKET_META[b].aria}`}>
              <span className="font-semibold">{grouped[b].length}</span> {BUCKET_META[b].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full border border-border text-muted-foreground">
            <Clock className="size-3" aria-hidden /> Auto-refresh 30s
          </span>
        </div>

        {data.summary.length === 0 ? (
          <div className="rp-card p-6">
            <p className="text-muted-foreground">No cron runs recorded yet. Hooks log into <code>rp_cron_runs</code> on each invocation.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {order.map((b) => {
              const list = grouped[b];
              if (list.length === 0) return null;
              return (
                <section key={b} aria-labelledby={`bucket-${b}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <h2 id={`bucket-${b}`} className="font-heading text-lg">{BUCKET_META[b].label}</h2>
                    <span className="text-xs text-muted-foreground">({list.length})</span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {list.map((h: any) => (
                      <article key={h.hook} className="rp-card p-5" aria-labelledby={`hook-${h.hook}`}>
                        <div className="flex items-center justify-between gap-2">
                          <h3 id={`hook-${h.hook}`} className="font-bold">{h.hook}</h3>
                          {b === "stale" ? (
                            <span className="text-xs px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-900 inline-flex items-center gap-1">
                              <AlertTriangle className="size-3" aria-hidden /> Stale
                            </span>
                          ) : b === "healthy" ? (
                            <span className="text-xs px-2 py-0.5 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 inline-flex items-center gap-1">
                              <CheckCircle2 className="size-3" aria-hidden /> Healthy
                            </span>
                          ) : b === "unknown" ? (
                            <span className="text-xs px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground inline-flex items-center gap-1">Unknown</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full border border-red-300 bg-red-50 text-red-800 inline-flex items-center gap-1">
                              <XCircle className="size-3" aria-hidden /> {h.last_status ?? "failing"}
                            </span>
                          )}
                        </div>
                        <dl className="grid grid-cols-2 gap-2 mt-3 text-sm">
                          <Cell label="Runs (last 200)" value={h.total_runs} />
                          <Cell label="Success rate" value={`${h.success_rate}%`} />
                          <Cell label="Avg duration" value={`${h.avg_duration_ms} ms`} />
                          <Cell label="Last duration" value={h.last_duration_ms ? `${h.last_duration_ms} ms` : "—"} />
                          <Cell label="Last run" value={h.last_run_at ? new Date(h.last_run_at).toLocaleString() : "Never"} className="col-span-2" />
                        </dl>
                        {h.last_error && (
                          <div className="mt-3 text-xs bg-red-50 border border-red-300 text-red-800 p-2 rounded">
                            <span className="font-semibold">Last error: </span>{h.last_error}
                          </div>
                        )}
                        <div className="mt-3">
                          <Link to="/rakshak-platform/admin/alerts" className="text-xs text-brand hover:underline">
                            Manage alert rule →
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <div className="rp-card p-5 mt-8">
          <h2 className="font-heading text-lg mb-3">Recent runs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Last 50 cron and webhook executions</caption>
              <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th scope="col" className="py-2 pr-3">When</th>
                  <th scope="col" className="pr-3">Hook</th>
                  <th scope="col" className="pr-3">Status</th>
                  <th scope="col" className="pr-3">HTTP</th>
                  <th scope="col" className="pr-3">Duration</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.started_at).toLocaleString()}</td>
                    <td className="pr-3">{r.hook_name}</td>
                    <td className="pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{r.status}</span>
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
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
