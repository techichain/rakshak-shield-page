import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export type Role = "admin" | "observer" | null;

export function useRole(): { role: Role; loading: boolean } {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRole(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const roles = (data ?? []).map((r) => r.role as string);
        setRole(roles.includes("admin") ? "admin" : roles.includes("observer") ? "observer" : null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { role, loading: loading || authLoading };
}
