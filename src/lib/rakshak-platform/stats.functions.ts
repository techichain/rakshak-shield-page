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

    // Distinct colleges / cities / states from active teams, with team counts.
    type Tally = Map<string, { label: string; count: number }>;
    const institutionsTally: Tally = new Map();
    const citiesTally: Tally = new Map();
    const statesTally: Tally = new Map();
    const bump = (t: Tally, raw: any) => {
      const key = norm(raw);
      if (!key) return;
      const label = String(raw).trim();
      const prev = t.get(key);
      if (prev) prev.count += 1;
      else t.set(key, { label, count: 1 });
    };
    (teamsMetaQ.data ?? []).forEach((r: any) => {
      bump(institutionsTally, r.college);
      bump(citiesTally, r.city);
      bump(statesTally, r.state);
    });
    const toList = (t: Tally) =>
      [...t.values()]
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .map((v) => ({ name: v.label, count: v.count }));

    const institutionsList = toList(institutionsTally);
    const citiesList = toList(citiesTally);
    const statesList = toList(statesTally);

    // Location rows for the coordinates table (live).
    const { data: locationRows } = await supabaseAdmin
      .from("rp_locations")
      .select("id, location_name, city, state, latitude, longitude, authority_jurisdiction, severity")
      .limit(2000);

    const locations = (locationRows ?? []).map((r: any) => ({
      id: String(r.id),
      name: r.location_name ?? "",
      city: (r.city ?? "").trim(),
      state: (r.state ?? "").trim(),
      latitude: r.latitude == null ? null : Number(r.latitude),
      longitude: r.longitude == null ? null : Number(r.longitude),
      authority: r.authority_jurisdiction ?? null,
      risk: r.severity ?? null,
    }));

    // Top cities by # of mapped locations
    const cityCounts: Record<string, number> = {};
    locations.forEach((r) => {
      if (r.city) cityCounts[r.city] = (cityCounts[r.city] || 0) + 1;
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
      institutions: institutionsList.length,
      cities: citiesList.length,
      states: statesList.length,
      stakeholderSurveys: surveysQ.count ?? 0,
      topCities,
      institutionsList,
      citiesList,
      statesList,
      locationRows: locations,
    };

    return { ...real, using_dummy: false as const };
  });

