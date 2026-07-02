import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { getPublicImpactStats } from "@/lib/rakshak-platform/stats.functions";
import { Building2, ClipboardList, MapPin, Map } from "lucide-react";

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

function Stat({ icon: Icon, label, value, tone = "default" }: any) {
  return (
    <div className={`rounded-2xl border p-6 ${tone === "brand" ? "border-brand/40 bg-brand-lite" : "border-border bg-background"}`}>
      <Icon className="h-5 w-5 text-brand" />
      <div className="mt-4 font-heading text-4xl tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function ImpactPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["rp-impact"],
    queryFn: () => getPublicImpactStats(),
  });


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

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Building2} label="Institutions" value={data.institutions} tone="brand" />
          <Stat icon={ClipboardList} label="Stakeholder surveys" value={data.stakeholderSurveys} />
          <Stat icon={MapPin} label="Cities" value={data.cities} />
          <Stat icon={Map} label="States" value={data.states} />
        </div>
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
