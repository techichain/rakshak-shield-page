import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { getPublicImpactStats } from "@/lib/rakshak-platform/stats.functions";
import { UNIS, uniLogoUrl } from "@/components/rakshak/data";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/impact_/institutions")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["rp-impact"],
      queryFn: () => getPublicImpactStats(),
    }),
  component: InstitutionsPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p>Could not load: {String(error)}</p></Section></PlatformShell>
  ),
  head: () => ({
    meta: [
      { title: "Institutions — Project Rakshak Impact" },
      { name: "description", content: "Every institution running an active Project Rakshak road-safety audit team." },
      { property: "og:title", content: "Institutions — Project Rakshak Impact" },
      { property: "og:description", content: "Every institution running an active Project Rakshak team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function partnerLogo(name: string) {
  const n = name.trim().toLowerCase();
  const match = UNIS.find((u) => u.name.trim().toLowerCase() === n);
  return match?.file ? uniLogoUrl(match.file) : undefined;
}

function BackLink() {
  return (
    <Link
      to="/rakshak-platform/impact"
      className="inline-flex items-center gap-2 text-sm text-brand hover:underline"
    >
      <ArrowLeft className="h-4 w-4" /> Back to programme impact
    </Link>
  );
}

function InstitutionsPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["rp-impact"],
    queryFn: () => getPublicImpactStats(),
  });
  const list = data.institutionsList ?? [];

  return (
    <PlatformShell>
      <Section>
        <BackLink />
        <div className="mt-6">
          <Eyebrow>Programme impact</Eyebrow>
          <h1 className="mt-3 font-heading text-4xl md:text-5xl tracking-tight">Institutions</h1>
          <p className="mt-3 text-muted-foreground">
            {list.length} institution{list.length === 1 ? "" : "s"} with active Rakshak teams.
          </p>
        </div>

        {list.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">No institutions yet.</p>
        ) : (
          <div className="mt-10 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((u) => {
              const url = partnerLogo(u.name);
              return (
                <div
                  key={u.name}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-background p-5"
                >
                  {url ? (
                    <img src={url} alt={u.name} className="h-10 w-10 shrink-0 object-contain" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand/40 bg-brand-lite text-[11px] font-medium text-brand">
                      {u.name.split(" ").map((w) => w[0]).join("").slice(0, 4)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-heading text-base">{u.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {u.count} team{u.count === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
