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

const ALLOWED_SEVERITY = new Set(["low", "medium", "high", "critical"]);

/**
 * Admin-only: correct hazard classification (state, severity) on a location
 * after reviewing the team's evidence (GPS + photos/videos).
 */
export const updateLocationHazardParams = createServerFn({ method: "POST" })
  .inputValidator((data: { location_id: string; state?: string | null; severity?: string | null }) => {
    if (!data?.location_id || typeof data.location_id !== "string") {
      throw new Error("location_id required");
    }
    const state = data.state == null ? null : String(data.state).trim().slice(0, 120) || null;
    const severity = data.severity == null || data.severity === "" ? null : String(data.severity).toLowerCase();
    if (severity && !ALLOWED_SEVERITY.has(severity)) {
      throw new Error("severity must be one of low, medium, high, critical");
    }
    return { location_id: data.location_id, state, severity };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const authHeader = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Unauthorized");
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userRes.user) throw new Error("Unauthorized");
    const { data: isAdmin, error: roleErr } = await supabaseAdmin.rpc("rp_is_admin", { _user: userRes.user.id });
    if (roleErr) throw roleErr;
    if (!isAdmin) throw new Error("Forbidden");

    const patch: Record<string, any> = {};
    if (data.state !== undefined) patch.state = data.state;
    if (data.severity !== undefined) patch.severity = data.severity;
    const { error } = await supabaseAdmin
      .from("rp_locations")
      .update(patch)
      .eq("id", data.location_id);
    if (error) throw error;
    return { ok: true };
  });

