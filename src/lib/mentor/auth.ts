import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const [state, setState] = useState<{
    loading: boolean;
    isAdmin: boolean;
    userId: string | null;
  }>({ loading: true, isAdmin: false, userId: null });

  useEffect(() => {
    let cancelled = false;
    const check = async (userId: string | null) => {
      if (!userId) {
        if (!cancelled) setState({ loading: false, isAdmin: false, userId: null });
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled)
        setState({ loading: false, isAdmin: !!data, userId });
    };

    supabase.auth.getSession().then(({ data }) => {
      check(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      check(session?.user?.id ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function logEvent(
  event_type: string,
  path: string,
  track: string | null = "mentor",
) {
  try {
    await supabase.from("page_events").insert({
      event_type,
      path,
      track,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      session_id: typeof window !== "undefined" ? (
        sessionStorage.getItem("rk_sid") ||
        (() => { const s = crypto.randomUUID(); sessionStorage.setItem("rk_sid", s); return s; })()
      ) : null,
    });
  } catch {
    // analytics never blocks UX
  }
}
