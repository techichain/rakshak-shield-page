import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { LocationMap, type MapMarker } from "@/components/rakshak-platform/LocationMap";

export const Route = createFileRoute("/rakshak-platform/admin/map")({
  component: AdminMap,
});

const SEV = ["all", "low", "medium", "high", "critical"] as const;

function AdminMap() {
  const navigate = useNavigate();
  const { loading, userId, isAdmin } = useRPAuth();
  const [locs, setLocs] = useState<any[]>([]);
  const [city, setCity] = useState("all");
  const [severity, setSeverity] = useState<(typeof SEV)[number]>("all");
  const [onlyFinal, setOnlyFinal] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isAdmin) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    (async () => {
      const { data } = await supabase
        .from("rp_locations")
        .select("id, team_id, location_name, city, state, latitude, longitude, issue_type, severity, is_final_selected, rp_teams(team_name)")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(1000);
      setLocs(data ?? []);
    })();
  }, [loading, userId, isAdmin, navigate]);

  const cities = useMemo(() => {
    const s = new Set<string>();
    locs.forEach((l) => l.city && s.add(l.city));
    return ["all", ...Array.from(s).sort()];
  }, [locs]);

  const filtered = useMemo(() => locs.filter((l) =>
    (city === "all" || l.city === city) &&
    (severity === "all" || l.severity === severity) &&
    (!onlyFinal || l.is_final_selected),
  ), [locs, city, severity, onlyFinal]);

  const markers: MapMarker[] = filtered.map((l) => ({
    id: l.id,
    lat: Number(l.latitude),
    lng: Number(l.longitude),
    title: l.location_name,
    subtitle: `${(l as any).rp_teams?.team_name ?? "Team"} · ${l.city ?? ""}`,
    severity: l.severity,
    isFinal: l.is_final_selected,
  }));

  return (
    <PlatformShell>
      <Section>
        <Link to="/rakshak-platform/admin" className="text-sm text-muted-foreground hover:text-brand">← Back to admin</Link>
        <Eyebrow>Programme overview</Eyebrow>
        <h1 className="mt-6 font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
          Every unsafe location<br />
          <span className="text-brand">mapped by every team.</span>
        </h1>
        <p className="mt-4 text-muted-foreground">{filtered.length} of {locs.length} locations shown.</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <select className="rp-input" value={city} onChange={(e) => setCity(e.target.value)}>
            {cities.map((c) => <option key={c} value={c}>{c === "all" ? "All cities" : c}</option>)}
          </select>
          <select className="rp-input" value={severity} onChange={(e) => setSeverity(e.target.value as any)}>
            {SEV.map((s) => <option key={s} value={s}>{s === "all" ? "All severities" : s}</option>)}
          </select>
          <label className="inline-flex items-center gap-2 text-sm h-12 px-4 rounded-full border border-border">
            <input type="checkbox" checked={onlyFinal} onChange={(e) => setOnlyFinal(e.target.checked)} />
            Final selections only
          </label>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-3">
          <LocationMap markers={markers} height="640px" />
        </div>
      </Section>
    </PlatformShell>
  );
}
