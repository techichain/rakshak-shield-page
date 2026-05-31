import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  APPLICATION_STATUSES,
  STATUS_META,
  type ApplicationStatus,
} from "@/lib/mentor/constants";

export const Route = createFileRoute("/rakshak-mentor/admin/analytics")({
  component: AnalyticsPage,
});

type AppMini = {
  status: ApplicationStatus;
  expertise_domain: string | null;
  state: string | null;
  city: string;
  years_experience: number | null;
  submitted_at: string;
};
type EventMini = {
  event_type: string;
  path: string;
  session_id: string | null;
  referrer: string | null;
  created_at: string;
};

const RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "All time", days: null as number | null },
];

function AnalyticsPage() {
  const [range, setRange] = useState<number | null>(30);
  const [apps, setApps] = useState<AppMini[]>([]);
  const [events, setEvents] = useState<EventMini[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const sinceISO =
        range === null
          ? null
          : new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString();

      let appsQ = supabase
        .from("applications")
        .select("status, expertise_domain, state, city, years_experience, submitted_at")
        .eq("track", "mentor");
      if (sinceISO) appsQ = appsQ.gte("submitted_at", sinceISO);

      let evtQ = supabase
        .from("page_events")
        .select("event_type, path, session_id, referrer, created_at")
        .eq("track", "mentor");
      if (sinceISO) evtQ = evtQ.gte("created_at", sinceISO);

      const [{ data: a }, { data: e }] = await Promise.all([appsQ, evtQ]);
      setApps((a as AppMini[]) ?? []);
      setEvents((e as EventMini[]) ?? []);
      setLoading(false);
    })();
  }, [range]);

  // ----- APPLICATION METRICS -----
  const total = apps.length;
  const byStatus = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of APPLICATION_STATUSES) m[s] = 0;
    for (const a of apps) m[a.status] = (m[a.status] ?? 0) + 1;
    return m;
  }, [apps]);

  const stageConversions = useMemo(() => {
    const submitted = total;
    const reviewed = total - (byStatus.submitted ?? 0);
    const shortlisted = (byStatus.shortlisted ?? 0) + (byStatus.interview ?? 0) + (byStatus.selected ?? 0);
    const selected = byStatus.selected ?? 0;
    return [
      { label: "Submitted", value: submitted },
      { label: "Reviewed", value: reviewed, pct: pct(reviewed, submitted) },
      { label: "Shortlisted+", value: shortlisted, pct: pct(shortlisted, submitted) },
      { label: "Selected", value: selected, pct: pct(selected, submitted) },
    ];
  }, [total, byStatus]);

  const byDomain = useMemo(() => groupCount(apps, (a) => a.expertise_domain ?? "Unspecified"), [apps]);
  const byCity = useMemo(() => groupCount(apps, (a) => a.city || "Unknown"), [apps]);
  const byExp = useMemo(() => {
    const buckets = { "0-3": 0, "4-7": 0, "8-12": 0, "13-20": 0, "20+": 0 };
    for (const a of apps) {
      const y = a.years_experience ?? 0;
      if (y <= 3) buckets["0-3"]++;
      else if (y <= 7) buckets["4-7"]++;
      else if (y <= 12) buckets["8-12"]++;
      else if (y <= 20) buckets["13-20"]++;
      else buckets["20+"]++;
    }
    return buckets;
  }, [apps]);

  // ----- VISITOR METRICS -----
  const sessions = useMemo(() => {
    const s = new Set<string>();
    for (const e of events) if (e.session_id) s.add(e.session_id);
    return s.size;
  }, [events]);

  const applyVisits = events.filter((e) => e.event_type === "page_view" && e.path === "/rakshak-mentor/apply").length;
  const applyStarts = events.filter((e) => e.event_type === "apply_start").length;
  const applySubmits = events.filter((e) => e.event_type === "apply_submit").length;
  const startToSubmit = pct(applySubmits, applyStarts);

  const sourceBreakdown = useMemo(() => {
    const m: Record<string, number> = { LinkedIn: 0, Direct: 0, "Crashfree India": 0, Email: 0, Other: 0 };
    for (const e of events) {
      if (e.event_type !== "page_view") continue;
      const r = (e.referrer ?? "").toLowerCase();
      if (!r) m.Direct++;
      else if (r.includes("linkedin")) m.LinkedIn++;
      else if (r.includes("crashfreeindia")) m["Crashfree India"]++;
      else if (r.includes("mail")) m.Email++;
      else m.Other++;
    }
    return m;
  }, [events]);

  const topPages = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of events) if (e.event_type === "page_view") m[e.path] = (m[e.path] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [events]);

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Lightweight, decision-oriented metrics for the mentor track.
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.days)}
              className={`px-3 py-1.5 text-xs rounded-md border transition ${
                range === r.days
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-300 hover:border-slate-900"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="space-y-8">
          {/* Application analytics */}
          <Section title="Application analytics">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Total applications" value={total} />
              <Stat label="Submitted (new)" value={byStatus.submitted ?? 0} />
              <Stat label="Under review" value={byStatus.under_review ?? 0} />
              <Stat label="Selected" value={byStatus.selected ?? 0} />
            </div>

            <SubBlock title="By status">
              <Bars data={Object.fromEntries(APPLICATION_STATUSES.map((s) => [STATUS_META[s].label, byStatus[s] ?? 0]))} />
            </SubBlock>

            <SubBlock title="Stage conversion">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stageConversions.map((s) => (
                  <div key={s.label} className="border border-slate-200 rounded-md p-3">
                    <div className="text-xs text-slate-500">{s.label}</div>
                    <div className="text-xl font-bold text-slate-900">{s.value}</div>
                    {"pct" in s && (
                      <div className="text-xs text-slate-500">{s.pct}% of submitted</div>
                    )}
                  </div>
                ))}
              </div>
            </SubBlock>

            <div className="grid md:grid-cols-2 gap-4">
              <SubBlock title="By expertise domain"><Bars data={byDomain} /></SubBlock>
              <SubBlock title="By experience"><Bars data={byExp} /></SubBlock>
            </div>

            <SubBlock title="Geographic spread (top 10 cities)">
              <Bars data={Object.fromEntries(Object.entries(byCity).sort((a,b) => b[1]-a[1]).slice(0,10))} />
            </SubBlock>
          </Section>

          {/* Visitor analytics */}
          <Section title="Visitor analytics">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Unique visitors" value={sessions} />
              <Stat label="/apply visits" value={applyVisits} />
              <Stat label="Form starts" value={applyStarts} />
              <Stat label="Start → submit" value={`${startToSubmit}%`} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <SubBlock title="Traffic sources"><Bars data={sourceBreakdown} /></SubBlock>
              <SubBlock title="Top pages">
                <ul className="text-sm divide-y divide-slate-100">
                  {topPages.map(([p, c]) => (
                    <li key={p} className="py-2 flex justify-between gap-3">
                      <span className="text-slate-700 truncate">{p}</span>
                      <span className="font-semibold text-slate-900">{c}</span>
                    </li>
                  ))}
                  {topPages.length === 0 && <li className="text-slate-500 py-2">No data yet.</li>}
                </ul>
              </SubBlock>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function pct(num: number, denom: number): number {
  if (!denom) return 0;
  return Math.round((num / denom) * 1000) / 10;
}
function groupCount<T>(rows: T[], key: (r: T) => string) {
  const m: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r);
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold tracking-tight mb-4">{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}
function SubBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</div>
      {children}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
function Bars({ data }: { data: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(data));
  const entries = Object.entries(data);
  if (entries.length === 0) return <div className="text-sm text-slate-500">No data.</div>;
  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => (
        <div key={k}>
          <div className="flex justify-between text-xs text-slate-600 mb-1">
            <span>{k}</span><span className="font-semibold text-slate-900">{v}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#4A35FF]" style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
