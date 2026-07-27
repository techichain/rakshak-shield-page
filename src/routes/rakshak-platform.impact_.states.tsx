import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { getPublicImpactStats } from "@/lib/rakshak-platform/stats.functions";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/impact_/states")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["rp-impact"],
      queryFn: () => getPublicImpactStats(),
    }),
  component: StatesPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p>Could not load: {String(error)}</p></Section></PlatformShell>
  ),
  head: () => ({
    meta: [
      { title: "States — Project Rakshak Impact" },
      { name: "description", content: "States where Project Rakshak teams are running road-safety audits, with team counts." },
      { property: "og:title", content: "States — Project Rakshak Impact" },
      { property: "og:description", content: "States covered by active Project Rakshak teams." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function StatesPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["rp-impact"],
    queryFn: () => getPublicImpactStats(),
  });
  const list = data.statesList ?? [];

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
          <h1 className="mt-3 font-heading text-4xl md:text-5xl tracking-tight">States</h1>
          <p className="mt-3 text-muted-foreground">
            {list.length} state{list.length === 1 ? "" : "s"} with active Rakshak teams.
          </p>
        </div>

        {list.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">No states yet.</p>
        ) : (
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <div
                key={s.name}
                className="flex items-baseline justify-between rounded-2xl border border-border bg-background p-5"
              >
                <div className="font-heading text-base">{s.name}</div>
                <div className="text-sm text-muted-foreground">
                  {s.count} team{s.count === 1 ? "" : "s"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
