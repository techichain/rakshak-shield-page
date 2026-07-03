import { redirect } from "@tanstack/react-router";
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
  isTeamLeader: boolean;
  isTeamMember: boolean;
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
  isTeamLeader: false,
  isTeamMember: false,
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
      if (!cancelled) {
        setState((current) => ({
          ...current,
          loading: true,
          userId,
          email,
          fullName: current.fullName ?? email,
        }));
      }
      try {
        const [rolesRes, profileRes] = await Promise.all([
          supabase.from("rp_user_roles").select("role").eq("user_id", userId),
          supabase.from("rp_profiles").select("full_name, timezone").eq("id", userId).maybeSingle(),
        ]);
        if (rolesRes.error) console.error("[rp-auth] roles query failed", rolesRes.error);
        if (profileRes.error) console.error("[rp-auth] profile query failed", profileRes.error);
        const roles = (rolesRes.data ?? []).map((r) => r.role as RPRole);

        // Detect & persist browser timezone if missing or changed.
        try {
          const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const storedTz = (profileRes.data as any)?.timezone ?? null;
          if (browserTz && browserTz !== storedTz) {
            await supabase
              .from("rp_profiles")
              .update({ timezone: browserTz })
              .eq("id", userId);
          }
        } catch (err) {
          console.warn("[rp-auth] timezone sync failed", err);
        }

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
          isTeamLeader: roles.includes("team_leader"),
          isTeamMember: roles.includes("team_member"),
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

    supabase.auth.getSession().then(({ data }) => {
      load(data.session?.user?.id ?? null, data.session?.user?.email ?? null);
    }).catch((err) => {
      console.error("[rp-auth] get session failed", err);
      if (!cancelled) setState({ ...empty, loading: false });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
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

/** Server-side (beforeLoad) role guard. Requires ssr:false on the route. */
export async function rpRequireRole(
  allowedRoles: string[],
  opts: { redirectTo?: string; blockAdmin?: boolean; attemptedPath?: string } = {}
) {
  const {
    redirectTo = "/rakshak-platform/unauthorized",
    blockAdmin = true,
    attemptedPath,
  } = opts;

  const path =
    attemptedPath ??
    (typeof window !== "undefined" ? window.location.pathname : "");

  // 1. Session check — handle missing/expired sessions safely.
  let userId: string | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) console.warn("[rp-guard] auth.getUser failed", error);
    userId = data?.user?.id ?? null;
  } catch (err) {
    console.error("[rp-guard] auth.getUser threw", err);
  }

  if (!userId) {
    throw redirect({
      to: "/rakshak-platform/auth",
      search: { redirect: path } as never,
    });
  }

  // 2. Role lookup — tolerate query errors.
  let roles: string[] = [];
  try {
    const { data: rolesData, error } = await supabase
      .from("rp_user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) console.warn("[rp-guard] roles query failed", error);
    roles = (rolesData ?? []).map((r) => r.role);
  } catch (err) {
    console.error("[rp-guard] roles query threw", err);
  }

  const isAdmin = roles.includes("cfi_admin") || roles.includes("super_admin");
  const hasRole = roles.some((role) => allowedRoles.includes(role));
  // Never block admins from a route that explicitly allows an admin role.
  const routeAllowsAdmin =
    allowedRoles.includes("cfi_admin") || allowedRoles.includes("super_admin");

  const deny = (reason: string): never => {
    // Fire-and-forget server-side log (doesn't block redirect).
    void import("./access-log.functions")
      .then((m) =>
        m.logAccessDenied({
          data: {
            attempted_path: path,
            reason,
            required_roles: allowedRoles,
            user_roles: roles,
          },
        }),
      )
      .catch((err) => console.warn("[rp-guard] log failed", err));

    throw redirect({
      to: redirectTo,
      search: {
        attempted: path,
        reason,
        required: allowedRoles.join(","),
      } as never,
    });
  };

  if (blockAdmin && isAdmin && !routeAllowsAdmin) deny("admin_blocked_from_role_route");
  if (!hasRole) deny("missing_required_role");
}

