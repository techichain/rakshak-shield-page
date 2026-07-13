import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, signOut } from "@/lib/gigrider/auth";
import { useRole } from "@/lib/gigrider/useRole";

export const Route = createFileRoute("/gigrider-checklist/")({
  component: RoleRouter,
});

function RoleRouter() {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!user) { navigate({ to: "/gigrider-checklist/login" }); return; }
    // Only route into a gig-rider dashboard if the signed-in user actually
    // has a gig-rider role. Without this check, any user with a session on
    // this Supabase project (e.g. a Rakshak admin) would be dropped into the
    // observer dashboard because `role === null` fell through to the else.
    if (role === "admin") navigate({ to: "/gigrider-checklist/admin" });
    else if (role === "observer") navigate({ to: "/gigrider-checklist/observer" });
    // else: role is null → not a gig-rider account. Render the access screen
    // below so the user can sign out and use the right login.
  }, [user, role, authLoading, roleLoading, navigate]);

  const noAccess = !authLoading && !roleLoading && !!user && role === null;

  if (noAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">No gig-rider access</h1>
          <p className="mt-2 text-sm text-slate-600">
            You're signed in as <span className="font-mono">{user?.email}</span>, but this account
            isn't registered as a Gig Rider Checklist observer or admin.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            If you meant to access Project Rakshak, go to the Rakshak portal instead. Otherwise
            sign out and sign in with your gig-rider credentials.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={async () => { await signOut(); navigate({ to: "/gigrider-checklist/login" }); }}
              className="w-full bg-slate-900 text-white text-sm font-medium py-2 rounded-md hover:bg-slate-800"
            >
              Sign out and use Gig Rider login
            </button>
            <a
              href="/rakshak-platform"
              className="w-full text-sm text-slate-600 hover:text-slate-900 py-2 rounded-md border border-slate-200"
            >
              Go to Rakshak portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-500">Loading…</p>
    </div>
  );
}
