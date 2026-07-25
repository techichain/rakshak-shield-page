import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { getPublicImpactStats } from "@/lib/rakshak-platform/stats.functions";
import { Building2, ClipboardList, MapPin, Map, ChevronDown } from "lucide-react";
import { UNIS, uniLogoUrl, AUTH_CATS, LOC } from "@/components/rakshak/data";

export const Route = createFileRoute("/rakshak-platform/impact")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["rp-impact"],
      queryFn: () => getPublicImpactStats(),
    }),
  component: ImpactPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p>Could not load: {String(error)}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
  head: () => ({
    meta: [
      { title: "Impact — Project Rakshak" },
      { name: "description", content: "Live numbers from the Project Rakshak programme: teams, hazards mapped, authority pitches, funds raised." },
      { property: "og:title", content: "Project Rakshak — Live Impact Dashboard" },
      { property: "og:description", content: "Youth-led road safety audits, in numbers." },
    ],
  }),
});

function Stat({
  icon: Icon,
  label,
  value,
  tone = "default",
  expandable = false,
  expanded = false,
  onToggle,
  panelId,
}: {
  icon: any;
  label: string;
  value: number | string;
  tone?: string;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  panelId?: string;
}) {
  const base = `w-full text-left rounded-2xl border p-6 transition-colors ${
    tone === "brand" ? "border-brand/40 bg-brand-lite" : "border-border bg-background"
  }`;
  const body = (
    <>
      <div className="flex items-start justify-between">
        <Icon className="h-5 w-5 text-brand" />
        {expandable && (
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="mt-4 font-heading text-4xl tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </>
  );

  if (!expandable) return <div className={base}>{body}</div>;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={panelId}
      className={`${base} hover:border-brand/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50`}
    >
      {body}
    </button>
  );
}

function authLabel(key: string) {
  return AUTH_CATS.find((a) => a.k === key)?.l ?? key;
}

function countBy(field: "ci" | "st") {
  const m = new Map<string, number>();
  LOC.forEach((l) => {
    const v = (l[field] || "").trim();
    if (v) m.set(v, (m.get(v) ?? 0) + 1);
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function Panel({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div id={id} className="mt-4 rounded-2xl border border-border bg-background p-6">
      {children}
    </div>
  );
}

function ImpactPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["rp-impact"],
    queryFn: () => getPublicImpactStats(),
  });

  const [open, setOpen] = useState<null | "institutions" | "cities" | "states">(null);
  const toggle = (k: "institutions" | "cities" | "states") => setOpen((p) => (p === k ? null : k));

  const cityCounts = countBy("ci");
  const stateCounts = countBy("st");
  const byCity = cityCounts.map(([city]) => ({
    city,
    rows: LOC.filter((l) => (l.ci || "").trim() === city),
  }));

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Programme impact</Eyebrow>
        <h1 className="mt-3 font-heading text-5xl md:text-6xl tracking-tight">
          What Project Rakshak has<br /><span className="text-brand">put on the map.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Every number on this page comes straight from the field — student teams documenting hazards, mentors signing off, authorities receiving formal pitches.
        </p>
        {(data as any).using_dummy && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Showing sample data — live numbers will appear as the programme progresses.
          </div>
        )}

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={Building2}
            label="Institutions"
            value={UNIS.length}
            tone="brand"
            expandable
            expanded={open === "institutions"}
            onToggle={() => toggle("institutions")}
            panelId="impact-panel-institutions"
          />
          <Stat icon={ClipboardList} label="Stakeholder surveys" value={data.stakeholderSurveys} />
          <Stat
            icon={MapPin}
            label="Cities"
            value={cityCounts.length}
            expandable
            expanded={open === "cities"}
            onToggle={() => toggle("cities")}
            panelId="impact-panel-cities"
          />
          <Stat
            icon={Map}
            label="States"
            value={stateCounts.length}
            expandable
            expanded={open === "states"}
            onToggle={() => toggle("states")}
            panelId="impact-panel-states"
          />
        </div>

        {open === "institutions" && (
          <Panel id="impact-panel-institutions">
            <h3 className="font-heading text-xl tracking-tight">Academic partner institutions</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {UNIS.length} partner institutions supporting Project Rakshak audits.
            </p>
            <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {UNIS.map((u) => {
                const url = u.file ? uniLogoUrl(u.file) : undefined;
                return (
                  <div
                    key={u.name}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-background px-3 py-3"
                  >
                    {url ? (
                      <img src={url} alt={u.name} className="h-8 w-8 shrink-0 object-contain" />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand/40 bg-brand-lite text-[10px] font-medium text-brand">
                        {u.name.split(" ").map((w) => w[0]).join("").slice(0, 4)}
                      </div>
                    )}
                    <span className="truncate text-sm">{u.name}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {open === "states" && (
          <Panel id="impact-panel-states">
            <h3 className="font-heading text-xl tracking-tight">States covered</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Audit locations per state, from the Rakshak hazard map.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stateCounts.map(([state, count]) => (
                <div
                  key={state}
                  className="flex items-baseline justify-between rounded-2xl border border-border bg-background p-4"
                >
                  <div className="font-heading text-base">{state}</div>
                  <div className="text-sm text-muted-foreground">
                    {count} location{count === 1 ? "" : "s"}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {open === "cities" && (
          <Panel id="impact-panel-cities">
            <h3 className="font-heading text-xl tracking-tight">Cities covered</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Audit locations per city, from the Rakshak hazard map.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cityCounts.map(([city, count]) => (
                <div
                  key={city}
                  className="flex items-baseline justify-between rounded-2xl border border-border bg-background p-4"
                >
                  <div className="font-heading text-base">{city}</div>
                  <div className="text-sm text-muted-foreground">
                    {count} location{count === 1 ? "" : "s"}
                  </div>
                </div>
              ))}
            </div>

            <h4 className="mt-10 font-heading text-lg tracking-tight">All audit locations by city</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Geo-coordinates, owning authority and risk level for every mapped location.
            </p>
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
                    <>
                      <tr key={`h-${city}`} className="bg-brand-lite/60">
                        <td colSpan={6} className="py-2 pr-4 font-heading text-sm">
                          {city} · {rows.length} location{rows.length === 1 ? "" : "s"}
                        </td>
                      </tr>
                      {rows.map((l) => (
                        <tr key={l.id} className="border-b border-border/60">
                          <td className="py-2 pr-4">{l.n}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{l.st}</td>
                          <td className="py-2 pr-4 tabular-nums text-muted-foreground">{l.lat.toFixed(4)}</td>
                          <td className="py-2 pr-4 tabular-nums text-muted-foreground">{l.lng.toFixed(4)}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{authLabel(l.auth)}</td>
                          <td className="py-2 capitalize text-muted-foreground">{l.risk}</td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </Section>

      <Section tone="brand-lite">
        <Eyebrow>Where teams are working</Eyebrow>
        <h2 className="mt-3 font-heading text-3xl tracking-tight">Top cities by hazards mapped</h2>
        {data.topCities.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No city data yet.</p>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.topCities.map((c) => (
              <div key={c.city} className="flex items-baseline justify-between rounded-2xl border border-border bg-background p-5">
                <div className="font-heading text-lg">{c.city}</div>
                <div className="text-sm text-muted-foreground">{c.count} mapped</div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
