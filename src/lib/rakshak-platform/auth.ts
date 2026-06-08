import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RPRole } from "./constants";

export interface RPAuthState {
  loading: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  roles: RPRole[];
  isAdmin: boolean;
  isMentor: boolean;
  isTeam: boolean;
  isEvaluator: boolean;
  isAuthority: boolean;
}

const empty: RPAuthState = {
  loading: true,
  userId: null,
  email: null,
  fullName: null,
  roles: [],
  isAdmin: false,
  isMentor: false,
  isTeam: false,
  isEvaluator: false,
};

export function useRPAuth(): RPAuthState {
  const [state, setState] = useState<RPAuthState>(empty);

  useEffect(() => {
    let cancelled = false;

    const load = async (userId: string | null, email: string | null) => {
      if (!userId) {
        if (!cancelled) setState({ ...empty, loading: false });
        return;
      }
      const [{ data: roleRows }, { data: profile }] = await Promise.all([
        supabase.from("rp_user_roles").select("role").eq("user_id", userId),
        supabase.from("rp_profiles").select("full_name").eq("id", userId).maybeSingle(),
      ]);
      const roles = (roleRows ?? []).map((r) => r.role as RPRole);
      if (cancelled) return;
      setState({
        loading: false,
        userId,
        email,
        fullName: profile?.full_name ?? email,
        roles,
        isAdmin: roles.includes("cfi_admin") || roles.includes("super_admin"),
        isMentor: roles.includes("mentor"),
        isTeam: roles.includes("team_leader") || roles.includes("team_member"),
        isEvaluator: roles.includes("evaluator"),
      });
    };

    supabase.auth.getSession().then(({ data }) => {
      load(data.session?.user?.id ?? null, data.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      load(session?.user?.id ?? null, session?.user?.email ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function rpSignOut() {
  await supabase.auth.signOut();
}
