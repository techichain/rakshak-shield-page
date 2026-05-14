import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, signOut } from "@/lib/gigrider/auth";
import { useRole } from "@/lib/gigrider/useRole";

export const Route = createFileRoute("/gigrider-checklist/observer")({
  component: ObserverDashboard,
});

function ObserverDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!user) navigate({ to: "/gigrider-checklist/login" });
    else if (role === "admin") navigate({ to: "/gigrider-checklist/admin" });
  }, [user, role, authLoading, roleLoading, navigate]);

  if (authLoading || roleLoading || !user) {
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
          <h1 className="text-base font-semibold text-slate-900">Observer Dashboard</h1>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md border border-slate-200"
        >
          Sign out
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Welcome</h2>
          <p className="mt-1 text-sm text-slate-600">
            The 6-section observation form ships in Phase 1.
          </p>
          <button
            disabled
            className="mt-4 inline-flex items-center justify-center rounded-md bg-emerald-600 text-white px-4 py-2 text-sm font-medium opacity-60 cursor-not-allowed"
          >
            + New Observation (Phase 1)
          </button>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900">Your observations</h3>
          <p className="mt-1 text-sm text-slate-500">No observations yet.</p>
        </section>

        <p className="text-xs text-slate-400 text-center">
          <Link to="/" className="underline">← Back to Rakshak home</Link>
        </p>
      </main>
    </div>
  );
}
