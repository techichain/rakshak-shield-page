import { createServerFn } from "@tanstack/react-start";

/**
 * Public, sanitized hotspot list for the public map at /rakshak-platform/map.
 * Returns only final-selected locations across all teams, with no PII.
 */
export const getPublicHotspots = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("rp_locations")
    .select("id, location_name, city, state, latitude, longitude, issue_type, severity, is_final_selected, submitted_to_authority_at")
    .eq("is_final_selected", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .limit(500);
  if (error) throw error;
  return { hotspots: data ?? [] };
});
