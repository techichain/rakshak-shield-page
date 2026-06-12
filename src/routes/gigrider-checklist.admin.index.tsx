import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, signOut } from "@/lib/gigrider/auth";
import { useRole } from "@/lib/gigrider/useRole";
import { createObserver, listObservers, listAllObservations, USERNAME_EMAIL_DOMAIN } from "@/lib/gigrider/admin.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/gigrider-checklist/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!user) navigate({ to: "/gigrider-checklist/login" });
    // Send non-admins to the gigrider root, which will route observers to
    // their dashboard and show a "no access" screen for users with no
    // gig-rider role (e.g. Rakshak admins on the shared Supabase session).
    else if (role !== "admin") navigate({ to: "/gigrider-checklist" });
  }, [user, role, authLoading, roleLoading, navigate]);

  if (authLoading || roleLoading || !user || role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Admin Dashboard</h1>
          <p className="text-xs text-slate-500">{user.email} · admin</p>
        </div>
        <button
          onClick={() => signOut()}
          className="text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md border border-slate-200"
        >
          Sign out
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <ObservationsPanel />
        <ObserversPanel />
      </main>
    </div>
  );
}

type Row = {
  id: string;
  status: "draft" | "submitted" | "reviewed";
  flagged: boolean;
  flag_reason: string | null;
  hotspot_id: string | null;
  surveyor_id: string | null;
  observer_id: string;
  gig_worker_id: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy_meters: number | null;
  started_at: string;
  submitted_at: string | null;
  updated_at: string;
  road_env_type: string | null;
  hotspot: { id: string; name: string; city: string; sublabel: string | null } | null;
  surveyor: { id: string; name: string } | null;
  observer: { id: string; name: string; username: string | null } | null;
};

function ObservationsPanel() {
  const navigate = useNavigate();
  const list = useServerFn(listAllObservations);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["gigrider-admin-observations"],
    queryFn: () => list() as Promise<Row[]>,
    refetchOnWindowFocus: true,
    // Poll every 30s instead of subscribing to realtime — keeps the broad
    // `observations` channel off the wire so we don't leak row events to
    // non-admin subscribers.
    refetchInterval: 30_000,
  });


  const rows = data ?? [];

  // Filters
  const [status, setStatus] = useState<"all" | "draft" | "submitted">("all");
  const [flagged, setFlagged] = useState<"all" | "yes" | "no">("all");
  const [observerId, setObserverId] = useState<string>("all");
  const [surveyor, setSurveyor] = useState<string>("all");
  const [hotspotId, setHotspotId] = useState<string>("all");
  const [search, setSearch] = useState("");

  const observerOpts = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => r.observer && m.set(r.observer.id, r.observer.name));
    return [...m.entries()];
  }, [rows]);
  const surveyorOpts = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => r.surveyor && m.set(r.surveyor.id, r.surveyor.name));
    return [...m.entries()];
  }, [rows]);
  const hotspotOpts = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => r.hotspot && m.set(r.hotspot.id, `${r.hotspot.city} — ${r.hotspot.name}`));
    return [...m.entries()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (flagged === "yes" && !r.flagged) return false;
      if (flagged === "no" && r.flagged) return false;
      if (observerId !== "all" && r.observer?.id !== observerId) return false;
      if (surveyor !== "all" && r.surveyor?.id !== surveyor) return false;
      if (hotspotId !== "all" && r.hotspot?.id !== hotspotId) return false;
      if (q) {
        const hay = [
          r.gig_worker_id,
          r.observer?.name,
          r.surveyor?.name,
          r.hotspot?.name,
          r.hotspot?.city,
          r.flag_reason,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, status, flagged, observerId, surveyor, hotspotId, search]);

  const downloadCSV = () => {
    // Collect every key present on any observation row, plus joined name columns.
    const baseKeys = new Set<string>();
    filtered.forEach((r) => {
      Object.keys(r).forEach((k) => {
        if (k === "hotspot" || k === "surveyor" || k === "observer" || k === "photos") return;
        baseKeys.add(k);
      });
    });
    const dataKeys = Array.from(baseKeys);
    const joinedKeys = [
      "observer_name", "observer_username",
      "surveyor_name",
      "hotspot_name", "hotspot_city", "hotspot_sublabel",
    ];
    const headers = [...dataKeys, ...joinedKeys];

    const esc = (v: unknown) => {
      if (v == null) return "";
      const s = Array.isArray(v) || (typeof v === "object")
        ? JSON.stringify(v)
        : String(v);
      const safe = s.replace(/"/g, '""');
      return /[",\n]/.test(safe) ? `"${safe}"` : safe;
    };

    const lines = [headers.join(",")];
    filtered.forEach((r: any) => {
      const row = [
        ...dataKeys.map((k) => esc(r[k])),
        esc(r.observer?.name),
        esc(r.observer?.username),
        esc(r.surveyor?.name),
        esc(r.hotspot?.name),
        esc(r.hotspot?.city),
        esc(r.hotspot?.sublabel),
      ];
      lines.push(row.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `observations-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const counts = useMemo(() => ({
    total: rows.length,
    drafts: rows.filter((r) => r.status === "draft").length,
    submitted: rows.filter((r) => r.status === "submitted").length,
    flagged: rows.filter((r) => r.flagged).length,
  }), [rows]);

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Observations</h2>
          <p className="text-xs text-slate-500 mt-1">
            Live · {counts.total} total · {counts.drafts} drafts · {counts.submitted} submitted · {counts.flagged} flagged
          </p>
        </div>
        <button
          onClick={downloadCSV}
          disabled={filtered.length === 0}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-40"
        >
          Download CSV ({filtered.length})
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="px-2 py-2 border border-slate-300 rounded-md text-sm">
          <option value="all">All status</option>
          <option value="draft">Drafts</option>
          <option value="submitted">Submitted</option>
        </select>
        <select value={flagged} onChange={(e) => setFlagged(e.target.value as any)} className="px-2 py-2 border border-slate-300 rounded-md text-sm">
          <option value="all">All flags</option>
          <option value="yes">Flagged</option>
          <option value="no">Not flagged</option>
        </select>
        <select value={observerId} onChange={(e) => setObserverId(e.target.value)} className="px-2 py-2 border border-slate-300 rounded-md text-sm">
          <option value="all">All observers</option>
          {observerOpts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={surveyor} onChange={(e) => setSurveyor(e.target.value)} className="px-2 py-2 border border-slate-300 rounded-md text-sm">
          <option value="all">All surveyors</option>
          {surveyorOpts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={hotspotId} onChange={(e) => setHotspotId(e.target.value)} className="px-2 py-2 border border-slate-300 rounded-md text-sm">
          <option value="all">All hotspots</option>
          {hotspotOpts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search gig worker ID, names…"
          className="px-3 py-2 border border-slate-300 rounded-md text-sm"
        />
      </div>

      <div className="mt-4 overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-3 py-2">Updated</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Observer</th>
              <th className="text-left px-3 py-2">Surveyor</th>
              <th className="text-left px-3 py-2">Gig worker ID</th>
              <th className="text-left px-3 py-2">Hotspot</th>
              <th className="text-left px-3 py-2">GPS</th>
              <th className="text-left px-3 py-2">Flagged</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">No observations match.</td></tr>
            ) : filtered.map((r) => (
              <tr
                key={r.id}
                onClick={() => navigate({ to: "/gigrider-checklist/admin/$id", params: { id: r.id } })}
                className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
              >
                <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">{new Date(r.updated_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "submitted" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2">{r.observer?.name ?? "—"}</td>
                <td className="px-3 py-2">{r.surveyor?.name ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.gig_worker_id ?? "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {r.hotspot ? `${r.hotspot.city} — ${r.hotspot.name}` : "—"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.gps_lat != null && r.gps_lng != null ? (
                    <a
                      href={`https://www.google.com/maps?q=${r.gps_lat},${r.gps_lng}`}
                      target="_blank" rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {r.gps_lat.toFixed(5)}, {r.gps_lng.toFixed(5)}
                    </a>
                  ) : "—"}
                </td>
                <td className="px-3 py-2">
                  {r.flagged ? (
                    <span className="text-xs text-red-700" title={r.flag_reason ?? ""}>Flagged</span>
                  ) : <span className="text-xs text-slate-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ObserversPanel() {
  const list = useServerFn(listObservers);
  const create = useServerFn(createObserver);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["gigrider-observers"],
    queryFn: () => list(),
  });

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (vars: { username: string; name: string; password: string }) =>
      create({ data: vars }),
    onSuccess: (res) => {
      setSuccess(`Observer "${res.username}" created. They can now sign in with that username.`);
      setError(null);
      setUsername(""); setName(""); setPassword("");
      qc.invalidateQueries({ queryKey: ["gigrider-observers"] });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to create observer");
      setSuccess(null);
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    mutation.mutate({ username: username.trim().toLowerCase(), name: name.trim(), password });
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="text-lg font-semibold text-slate-900">Observers</h2>
      <p className="mt-1 text-xs text-slate-500">
        Create observer accounts here. Observers sign in with the username (no email needed).
      </p>

      <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            placeholder="priya01"
            pattern="[a-zA-Z0-9._-]{3,32}"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Display name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            placeholder="Priya Sharma"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Temporary password</label>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            placeholder="min 6 chars"
            minLength={6}
            required
          />
        </div>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="bg-emerald-600 text-white text-sm font-semibold py-2.5 rounded-md hover:bg-emerald-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Creating…" : "Create observer"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-emerald-700">{success}</p>}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-medium text-slate-700 mb-2">Existing observers</h3>
        {isLoading ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : (data?.observers ?? []).length === 0 ? (
          <p className="text-xs text-slate-500">No observers yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {data!.observers.map((o) => (
              <li key={o.id} className="py-2 flex justify-between">
                <span className="font-medium text-slate-900">{o.username ?? "—"}</span>
                <span className="text-slate-500">{o.name}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          Internal email format: <code>username@{USERNAME_EMAIL_DOMAIN}</code>
        </p>
      </div>
    </section>
  );
}
