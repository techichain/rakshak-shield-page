import { createServerFn } from "@tanstack/react-start";

export const getPublicImpactStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [
      teamsQ,
      locationsQ,
      finalLocationsQ,
      authorityQ,
      sponsorsQ,
      certsQ,
    ] = await Promise.all([
      supabaseAdmin.from("rp_teams").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("rp_locations").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("rp_locations").select("id", { count: "exact", head: true }).eq("is_final_selected", true),
      supabaseAdmin.from("rp_authority_reports").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("rp_sponsorships").select("amount_inr").eq("status", "paid"),
      supabaseAdmin.from("rp_certificates").select("id", { count: "exact", head: true }),
    ]);

    const totalFundsInr =
      (sponsorsQ.data ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_inr || 0), 0);

    // Top cities by # of mapped locations (light query)
    const { data: cityRows } = await supabaseAdmin
      .from("rp_locations")
      .select("city")
      .not("city", "is", null)
      .limit(2000);
    const cityCounts: Record<string, number> = {};
    (cityRows ?? []).forEach((r: any) => {
      const c = (r.city || "").trim();
      if (c) cityCounts[c] = (cityCounts[c] || 0) + 1;
    });
    const topCities = Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([city, count]) => ({ city, count }));

    return {
      teams: teamsQ.count ?? 0,
      locations: locationsQ.count ?? 0,
      finalLocations: finalLocationsQ.count ?? 0,
      authorityReports: authorityQ.count ?? 0,
      certificates: certsQ.count ?? 0,
      totalFundsInr,
      topCities,
    };
  });
