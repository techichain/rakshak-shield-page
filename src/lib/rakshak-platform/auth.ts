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
  isFinance: boolean;
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
  isAuthority: false,
  isFinance: false,
};

export function useRPAuth(): RPAuthState {
  const [state, setState] = useState<RPAuthState>(empty);

  useEffect(() => {
    let cancelled = false;
    let requestId = 0;

    const load = async (userId: string | null, email: string | null) => {
      const currentRequest = ++requestId;
      if (!userId) {
        if (!cancelled) setState({ ...empty, loading: false });
        return;
      }
      try {
        const [rolesRes, profileRes] = await Promise.all([
          supabase.from("rp_user_roles").select("role").eq("user_id", userId),
          supabase.from("rp_profiles").select("full_name").eq("id", userId).maybeSingle(),
        ]);
        if (rolesRes.error) console.error("[rp-auth] roles query failed", rolesRes.error);
        if (profileRes.error) console.error("[rp-auth] profile query failed", profileRes.error);
        const roles = (rolesRes.data ?? []).map((r) => r.role as RPRole);
        if (cancelled || currentRequest !== requestId) return;
        setState({
          loading: false,
          userId,
          email,
          fullName: profileRes.data?.full_name ?? email,
          roles,
          isAdmin: roles.includes("cfi_admin") || roles.includes("super_admin"),
          isMentor: roles.includes("mentor"),
          isTeam: roles.includes("team_leader") || roles.includes("team_member"),
          isEvaluator: roles.includes("evaluator"),
          isAuthority: roles.includes("authority"),
          isFinance: roles.includes("finance"),
        });
      } catch (err) {
        console.error("[rp-auth] load failed", err);
        if (!cancelled && currentRequest === requestId) setState({ ...empty, loading: false, userId, email });
      }
    };

    const timeout = window.setTimeout(() => {
      if (!cancelled) setState((current) => ({ ...current, loading: false }));
    }, 6000);

    supabase.auth.getUser().then(({ data }) => {
      load(data.user?.id ?? null, data.user?.email ?? null);
    }).catch((err) => {
      console.error("[rp-auth] get user failed", err);
      if (!cancelled) setState({ ...empty, loading: false });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      load(session?.user?.id ?? null, session?.user?.email ?? null);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function rpSignOut() {
  await supabase.auth.signOut();
}
