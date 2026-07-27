import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { getPublicImpactStats } from "@/lib/rakshak-platform/stats.functions";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/impact_/cities")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["rp-impact"],
      queryFn: () => getPublicImpactStats(),
    }),
  component: CitiesPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p>Could not load: {String(error)}</p></Section></PlatformShell>
  ),
  head: () => ({
    meta: [
      { title: "Cities — Project Rakshak Impact" },
      { name: "description", content: "Cities covered by Project Rakshak teams, plus every mapped audit location with coordinates, authority and risk." },
      { property: "og:title", content: "Cities — Project Rakshak Impact" },
      { property: "og:description", content: "Cities covered by Project Rakshak teams and all mapped audit locations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CitiesPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["rp-impact"],
    queryFn: () => getPublicImpactStats(),
  });
  const citiesList = data.citiesList ?? [];
  const locationRows = data.locationRows ?? [];

  const locationCityOrder = [...new Set(locationRows.map((l) => l.city).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
  const byCity = locationCityOrder.map((city) => ({
    city,
    rows: locationRows.filter((l) => l.city === city),
  }));

  return (
    <PlatformShell>
      <Section>
        <Link
          to="/rakshak-platform/impact"
          className="inline-flex items-center gap-2 text-sm text-brand hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to programme impact
        </Link>
        <div className="mt-6">
          <Eyebrow>Programme impact</Eyebrow>
          <h1 className="mt-3 font-heading text-4xl md:text-5xl tracking-tight">Cities</h1>
          <p className="mt-3 text-muted-foreground">
            {citiesList.length} cit{citiesList.length === 1 ? "y" : "ies"} with active Rakshak teams.
          </p>
        </div>

        {citiesList.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">No cities yet.</p>
        ) : (
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {citiesList.map((c) => (
              <div
                key={c.name}
                className="flex items-baseline justify-between rounded-2xl border border-border bg-background p-5"
              >
                <div className="font-heading text-base">{c.name}</div>
                <div className="text-sm text-muted-foreground">
                  {c.count} team{c.count === 1 ? "" : "s"}
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="mt-14 font-heading text-2xl tracking-tight">All audit locations by city</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Geo-coordinates, owning authority and risk level for every mapped location.
        </p>
        {byCity.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No mapped locations yet.</p>
        ) : (
          <div className="mt-4 -mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Location</th>
                  <th className="py-2 pr-4 font-medium">State</th>
                  <th className="py-2 pr-4 font-medium">Latitude</th>
                  <th className="py-2 pr-4 font-medium">Longitude</th>
                  <th className="py-2 pr-4 font-medium">Authority</th>
                  <th className="py-2 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {byCity.map(({ city, rows }) => (
                  <React.Fragment key={city}>
                    <tr className="bg-brand-lite/60">
                      <td colSpan={6} className="py-2 pr-4 font-heading text-sm">
                        {city} · {rows.length} location{rows.length === 1 ? "" : "s"}
                      </td>
                    </tr>
                    {rows.map((l) => (
                      <tr key={l.id} className="border-b border-border/60">
                        <td className="py-2 pr-4">{l.name}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{l.state || "—"}</td>
                        <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                          {l.latitude == null ? "—" : l.latitude.toFixed(4)}
                        </td>
                        <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                          {l.longitude == null ? "—" : l.longitude.toFixed(4)}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">{l.authority || "—"}</td>
                        <td className="py-2 capitalize text-muted-foreground">{l.risk || "—"}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
