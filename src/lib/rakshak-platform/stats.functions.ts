import { createServerFn } from "@tanstack/react-start";

export const getPublicImpactStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [
      teamsQ,
      locationsQ,
      finalLocationsQ,
      authorityQ,
      certsQ,
      teamsMetaQ,
      surveysQ,
    ] = await Promise.all([
      supabaseAdmin.from("rp_teams").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("rp_locations").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("rp_locations").select("id", { count: "exact", head: true }).eq("is_final_selected", true),
      supabaseAdmin.from("rp_authority_reports").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("rp_certificates").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("rp_teams").select("college, city, state").eq("status", "active").limit(5000),
      supabaseAdmin.from("rp_submissions").select("id", { count: "exact", head: true }).eq("phase_number", 2),
    ]);

    const norm = (s: any) => (s == null ? "" : String(s).trim().toLowerCase());
    const institutions = new Set<string>();
    const cities = new Set<string>();
    const states = new Set<string>();
    (teamsMetaQ.data ?? []).forEach((r: any) => {
      const c = norm(r.college); if (c) institutions.add(c);
      const ci = norm(r.city); if (ci) cities.add(ci);
      const st = norm(r.state); if (st) states.add(st);
    });

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

    const real = {
      teams: teamsQ.count ?? 0,
      locations: locationsQ.count ?? 0,
      finalLocations: finalLocationsQ.count ?? 0,
      authorityReports: authorityQ.count ?? 0,
      certificates: certsQ.count ?? 0,
      institutions: institutions.size,
      cities: cities.size,
      states: states.size,
      stakeholderSurveys: surveysQ.count ?? 0,
      topCities,
    };

    const isAllEmpty =
      real.teams === 0 &&
      real.locations === 0 &&
      real.finalLocations === 0 &&
      real.authorityReports === 0 &&
      real.certificates === 0 &&
      real.institutions === 0 &&
      real.cities === 0 &&
      real.states === 0 &&
      real.stakeholderSurveys === 0 &&
      real.topCities.length === 0;

    if (isAllEmpty) {
      return {
        teams: 45,
        locations: 320,
        finalLocations: 180,
        authorityReports: 90,
        certificates: 60,
        institutions: 38,
        cities: 22,
        states: 14,
        stakeholderSurveys: 52,
        topCities: [
          { city: "Bengaluru", count: 42 },
          { city: "Mumbai", count: 36 },
          { city: "Delhi", count: 31 },
          { city: "Pune", count: 24 },
          { city: "Hyderabad", count: 19 },
          { city: "Chennai", count: 16 },
        ],
        using_dummy: true as const,
      };
    }

    return { ...real, using_dummy: false as const };
  });

