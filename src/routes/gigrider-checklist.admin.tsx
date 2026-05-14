import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, signOut } from "@/lib/gigrider/auth";
import { useRole } from "@/lib/gigrider/useRole";

export const Route = createFileRoute("/gigrider-checklist/admin")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!user) navigate({ to: "/gigrider-checklist/login" });
    else if (role !== "admin") navigate({ to: "/gigrider-checklist/observer" });
  }, [user, role, authLoading, roleLoading, navigate]);

  if (authLoading || roleLoading || !user || role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  const cards = [
    { label: "Observations", value: "—", hint: "All field submissions" },
    { label: "Flagged", value: "—", hint: "Needs admin review" },
    { label: "Hotspots", value: "12", hint: "Active locations" },
    { label: "Surveyors", value: "—", hint: "Tracked surveyors" },
  ];

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

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{c.label}</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{c.value}</p>
              <p className="text-[11px] text-slate-400 mt-1">{c.hint}</p>
            </div>
          ))}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Phase 2 dashboard</h2>
          <p className="mt-1 text-sm text-slate-600">
            Tables (observations, flagged, hotspots, surveyors, users), CSV export, and the Leaflet map ship in Phase 2.
          </p>
        </section>

        <p className="text-xs text-slate-400 text-center">
          <Link to="/" className="underline">← Back to Rakshak home</Link>
        </p>
      </main>
    </div>
  );
}
