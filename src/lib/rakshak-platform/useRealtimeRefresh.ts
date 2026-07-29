import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to postgres_changes (INSERT/UPDATE/DELETE) on the given public
 * tables and invokes `onChange` — debounced — whenever anything changes.
 * The channel is removed on unmount.
 */
export function useRealtimeRefresh(
  channelName: string,
  tables: string[],
  onChange: () => void,
  options?: { enabled?: boolean; debounceMs?: number },
) {
  const enabled = options?.enabled ?? true;
  const debounceMs = options?.debounceMs ?? 500;
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  const tableKey = tables.join(",");

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase.channel(channelName);
    for (const table of tableKey.split(",")) {
      channel.on(
        // @ts-expect-error - supabase-js overload narrowing for postgres_changes
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => cbRef.current(), debounceMs);
        },
      );
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [channelName, tableKey, enabled, debounceMs]);
}
