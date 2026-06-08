import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { getPublicHotspots } from "@/lib/rakshak-platform/locations.functions";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { LocationMap, type MapMarker } from "@/components/rakshak-platform/LocationMap";

export const Route = createFileRoute("/rakshak-platform/map")({
  head: () => ({
    meta: [
      { title: "Hotspots map · Project Rakshak" },
      { name: "description", content: "Unsafe road locations identified by student teams across India through Project Rakshak audits." },
      { property: "og:title", content: "Project Rakshak — India road safety hotspots" },
      { property: "og:description", content: "Final-selected unsafe locations identified by youth road safety auditors across Indian cities." },
    ],
  }),
  component: PublicMap,
});

function PublicMap() {
  const fetchHotspots = useServerFn(getPublicHotspots);
  const [hotspots, setHotspots] = useState<any[]>([]);
  const [city, setCity] = useState("all");

  useEffect(() => {
    fetchHotspots({}).then((r) => setHotspots(r.hotspots ?? [])).catch(() => setHotspots([]));
  }, [fetchHotspots]);

  const cities = useMemo(() => {
    const s = new Set<string>();
    hotspots.forEach((l) => l.city && s.add(l.city));
    return ["all", ...Array.from(s).sort()];
  }, [hotspots]);

  const filtered = city === "all" ? hotspots : hotspots.filter((l) => l.city === city);
  const markers: MapMarker[] = filtered.map((l) => ({
    id: l.id,
    lat: Number(l.latitude),
    lng: Number(l.longitude),
    title: l.location_name,
    subtitle: `${l.issue_type ?? ""} · ${l.city ?? ""}`,
    severity: l.severity,
    isFinal: true,
  }));

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Public hotspot map</Eyebrow>
        <h1 className="mt-6 font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
          Unsafe road locations<br />
          <span className="text-brand">audited by India's youth.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Every pin below is a road location identified, surveyed, and final-selected
          by a Project Rakshak team. Hover for the issue type and city.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <select className="rp-input" value={city} onChange={(e) => setCity(e.target.value)}>
            {cities.map((c) => <option key={c} value={c}>{c === "all" ? "All cities" : c}</option>)}
          </select>
          <div className="inline-flex items-center text-sm text-muted-foreground h-12 px-4">
            {filtered.length} hotspot{filtered.length === 1 ? "" : "s"} shown
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-3">
          <LocationMap markers={markers} height="640px" />
        </div>
      </Section>
    </PlatformShell>
  );
}
