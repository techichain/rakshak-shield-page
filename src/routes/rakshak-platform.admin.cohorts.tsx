import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { getCohortAnalytics } from "@/lib/rakshak-platform/analytics.functions";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";

export const Route = createFileRoute("/rakshak-platform/admin/cohorts")({
  component: CohortPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p className="text-red-600">{String(error)}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
});

const BRAND = ["#1f4ed8", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

function CohortPage() {
  const navigate = useNavigate();
  const { loading, userId, isAdmin } = useRPAuth();
  const fn = useServerFn(getCohortAnalytics);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isAdmin) navigate({ to: "/rakshak-platform/dashboard" });
  }, [loading, userId, isAdmin, navigate]);

  const { data } = useSuspenseQuery({
    queryKey: ["rp-cohort-analytics"],
    queryFn: () => fn(),
  });

  if (!isAdmin) return null;

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Cohort Analytics</Eyebrow>
        <h1 className="text-3xl font-extrabold mb-2">Cohort comparison</h1>
        <p className="text-muted-foreground mb-6">Compare progress, output and risk across cohorts.</p>

        {data.summary.length === 0 ? (
          <p className="text-muted-foreground">No cohorts yet. Create some in the admin overview.</p>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {data.summary.map((c, idx) => (
                <div key={c.cohort.id} className="rp-card p-5">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.cohort.status}</div>
                  <h3 className="text-lg font-bold">{c.cohort.name}</h3>
                  <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                    <Stat label="Teams" value={c.teams_total} />
                    <Stat label="Active" value={c.teams_active} accent="text-emerald-600" />
                    <Stat label="At risk" value={c.teams_at_risk} accent={c.teams_at_risk > 0 ? "text-red-600" : ""} />
                    <Stat label="Completed" value={c.teams_completed} />
                    <Stat label="Submissions" value={c.submissions_total} />
                    <Stat label="Avg score" value={c.avg_score} />
                    <Stat label="Locations" value={c.locations_total} />
                    <Stat label="Final picks" value={c.locations_final} />
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">Completion rate · <span className="font-semibold" style={{ color: BRAND[idx % BRAND.length] }}>{c.completion_rate}%</span></div>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="rp-card p-5">
                <h3 className="font-semibold mb-2">Phase funnel by cohort</h3>
                <p className="text-xs text-muted-foreground mb-3">Teams that reached each phase.</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={[0, 1, 2, 3, 4].map((p) => {
                    const point: any = { phase: `P${p}` };
                    data.summary.forEach((c) => {
                      const f = c.phase_funnel.find((x) => x.phase === p);
                      point[c.cohort.name] = f?.reached ?? 0;
                    });
                    return point;
                  })}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="phase" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {data.summary.map((c, i) => (
                      <Bar key={c.cohort.id} dataKey={c.cohort.name} fill={BRAND[i % BRAND.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rp-card p-5">
                <h3 className="font-semibold mb-2">Weekly submissions cadence</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.weeklyCadence}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {data.cohortNames.map((n: string, i: number) => (
                      <Line key={n} type="monotone" dataKey={n} stroke={BRAND[i % BRAND.length]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rp-card p-5">
                <h3 className="font-semibold mb-2">Score distribution (all teams)</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.scoreBuckets}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#1f4ed8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rp-card p-5">
                <h3 className="font-semibold mb-2">Cohort health radar</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={data.summary.map((c) => ({
                    cohort: c.cohort.name,
                    Active: c.teams_active,
                    Completed: c.teams_completed,
                    "At risk": c.teams_at_risk,
                    "Avg score": c.avg_score,
                    "Final locs": c.locations_final,
                  }))}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="cohort" />
                    <PolarRadiusAxis />
                    {["Active", "Completed", "At risk", "Avg score", "Final locs"].map((k, i) => (
                      <Radar key={k} name={k} dataKey={k} stroke={BRAND[i]} fill={BRAND[i]} fillOpacity={0.15} />
                    ))}
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </Section>
    </PlatformShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
