import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, signOut } from "@/lib/gigrider/auth";
import { useRole } from "@/lib/gigrider/useRole";
import { createObserver, listObservers, USERNAME_EMAIL_DOMAIN } from "@/lib/gigrider/admin.functions";

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
        <ObserversPanel />

        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Phase 2 dashboard</h2>
          <p className="mt-1 text-sm text-slate-600">
            Tables (observations, flagged, hotspots, surveyors), CSV export, and the Leaflet map ship in Phase 2.
          </p>
        </section>

        <p className="text-xs text-slate-400 text-center">
          <Link to="/" className="underline">← Back to Rakshak home</Link>
        </p>
      </main>
    </div>
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
            type="text"
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
