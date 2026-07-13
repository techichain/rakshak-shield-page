import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/mentor/auth";

export const Route = createFileRoute("/rakshak-mentor/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, isAdmin, userId } = useIsAdmin();
  const isLoginRoute = location.pathname === "/rakshak-mentor/admin/login";

  useEffect(() => {
    if (loading || isLoginRoute) return;
    if (!userId || !isAdmin) {
      navigate({ to: "/rakshak-mentor/admin/login" });
    }
  }, [loading, isAdmin, userId, navigate, isLoginRoute]);

  if (isLoginRoute) {
    return <Outlet />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/rakshak-mentor/admin" className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-sm bg-[#4A35FF]" />
              <span className="text-sm font-bold">Rakshak Admin</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                to="/rakshak-mentor/admin"
                activeOptions={{ exact: true }}
                activeProps={{ className: "text-[#4A35FF] font-semibold" }}
                className="text-slate-700 hover:text-[#4A35FF]"
              >
                Applications
              </Link>
              <Link
                to="/rakshak-mentor/admin/analytics"
                activeProps={{ className: "text-[#4A35FF] font-semibold" }}
                className="text-slate-700 hover:text-[#4A35FF]"
              >
                Analytics
              </Link>
            </nav>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/rakshak-mentor/admin/login" });
            }}
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
