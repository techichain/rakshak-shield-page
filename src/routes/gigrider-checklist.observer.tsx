import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, signOut } from "@/lib/gigrider/auth";
import { useRole } from "@/lib/gigrider/useRole";

export const Route = createFileRoute("/gigrider-checklist/observer")({
  component: ObserverLayout,
});

function ObserverLayout() {
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
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-slate-900 truncate">Gig Rider Safety</h1>
          <p className="text-xs text-slate-500 truncate">{user.email}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md border border-slate-200 shrink-0"
        >
          Sign out
        </button>
      </header>
      <Outlet />
    </div>
  );
}
