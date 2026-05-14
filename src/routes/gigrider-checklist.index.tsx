import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/gigrider/auth";
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
    if (role === "admin") navigate({ to: "/gigrider-checklist/admin" });
    else navigate({ to: "/gigrider-checklist/observer" });
  }, [user, role, authLoading, roleLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-500">Loading…</p>
    </div>
  );
}
