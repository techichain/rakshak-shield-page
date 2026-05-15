import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyObservations } from "@/lib/gigrider/observations.functions";
import { useAuth } from "@/lib/gigrider/auth";

export const Route = createFileRoute("/gigrider-checklist/observer/")({
  component: ObserverDashboard,
});

type Row = Awaited<ReturnType<typeof listMyObservations>>[number];

function ObserverDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchList = useServerFn(listMyObservations);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    fetchList({})
      .then((r) => setRows(r))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [user, loading, fetchList]);

  const drafts = (rows ?? []).filter((r) => r.status === "draft");
  const submitted = (rows ?? []).filter((r) => r.status !== "draft");

  return (
    <main className="max-w-2xl mx-auto px-4 py-5 space-y-5">
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Observations</h2>
          {drafts.length > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
              {drafts.length} draft{drafts.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate({ to: "/gigrider-checklist/observer/new" })}
          className="mt-4 w-full inline-flex items-center justify-center rounded-md bg-emerald-600 text-white px-4 py-3 text-base font-semibold hover:bg-emerald-700"
        >
          + New Observation
        </button>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-md">{error}</div>
      )}

      {drafts.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 px-1">Drafts</h3>
          <ul className="space-y-2">
            {drafts.map((r) => <ObsRow key={r.id} r={r} />)}
          </ul>
        </section>
      )}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 px-1">Submitted</h3>
        {rows == null ? (
          <p className="text-sm text-slate-400 px-1">Loading…</p>
        ) : submitted.length === 0 ? (
          <p className="text-sm text-slate-400 px-1">No submissions yet.</p>
        ) : (
          <ul className="space-y-2">
            {submitted.map((r) => <ObsRow key={r.id} r={r} />)}
          </ul>
        )}
      </section>

    </main>
  );
}

function ObsRow({ r }: { r: Row }) {
  const date = new Date(r.submitted_at ?? r.updated_at ?? r.started_at);
  const isDraft = r.status === "draft";
  return (
    <li>
      <Link
        to="/gigrider-checklist/observer/$id"
        params={{ id: r.id }}
        className="block bg-white rounded-lg border border-slate-200 px-4 py-3 hover:border-emerald-400"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {r.hotspot?.name ?? "Unspecified hotspot"}
            </p>
            <p className="text-xs text-slate-500">
              {r.hotspot?.city ?? "—"} · {date.toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {r.flagged && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-red-100 text-red-700 rounded">Flag</span>}
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
              isDraft ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
            }`}>{r.status}</span>
          </div>
        </div>
      </Link>
    </li>
  );
}
