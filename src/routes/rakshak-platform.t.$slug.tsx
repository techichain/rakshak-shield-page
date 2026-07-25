import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import { MapPin, Trophy, Share2 } from "lucide-react";

const getPublicTeam = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: team, error } = await (supabaseAdmin as any)
      .rpc("rp_public_team", { _slug: data.slug });
    if (error) throw error;
    const t = Array.isArray(team) ? team[0] : team;
    if (!t) return { team: null, locations: [] };
    const { data: locs } = await supabaseAdmin
      .rpc("rp_public_team_locations", { _team_id: t.id });
    return { team: t, locations: locs ?? [] };
  });

export const Route = createFileRoute("/rakshak-platform/t/$slug")({
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["rp-public-team", params.slug],
      queryFn: () => getPublicTeam({ data: { slug: params.slug } }),
    }),
  component: PublicTeamPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p>Could not load: {String(error)}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><h1 className="font-heading text-3xl">Team not found</h1></Section></PlatformShell>
  ),
  head: ({ loaderData, params }) => {
    const t = (loaderData as any)?.team;
    const title = t
      ? `${t.team_name} — Project Rakshak team in ${t.city}`
      : "Project Rakshak — Team profile";
    const desc = t
      ? `${t.team_name} from ${t.college}, ${t.city} is auditing high-fatality roads through Project Rakshak. Phase ${t.current_phase}/4 · ${t.completion_percentage}% complete.`
      : "Student team auditing India's deadliest roads via Project Rakshak.";
    const url = `https://rakshak-shield-page.lovable.app/rakshak-platform/t/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});

function PublicTeamPage() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery({
    queryKey: ["rp-public-team", params.slug],
    queryFn: () => getPublicTeam({ data: { slug: params.slug } }),
  });
  const t = data.team as any;
  if (!t) throw notFound();
  const locs = data.locations as any[];

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  async function copyLink() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      // Clipboard access can be denied by the browser; failing silently is acceptable here.
      try { await navigator.clipboard.writeText(shareUrl); } catch { /* ignore */ }
    }
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Team profile</Eyebrow>
        <div className="mt-3 flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-heading text-4xl md:text-5xl tracking-tight">
              {t.team_name}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {t.college} · {t.city}, {t.state}
            </p>
          </div>
          <button
            onClick={copyLink}
            className="h-10 px-4 rounded-full border border-border inline-flex items-center gap-2 text-sm hover:border-brand/40"
          >
            <Share2 className="h-4 w-4" /> Copy share link
          </button>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-4">
          <Stat label="Phase" value={`${t.current_phase}/4`} hint={PHASE_TITLES[t.current_phase as 0|1|2|3|4] ?? ""} />
          <Stat label="Completion" value={`${t.completion_percentage ?? 0}%`} />
          <Stat label="Final score" value={Number(t.final_score ?? 0).toFixed(1)} />
          <Stat label="Phases evaluated" value={String(t.evaluated_phases ?? 0)} />
        </div>
      </Section>

      <Section tone="brand-lite">
        <Eyebrow>Hazard locations audited</Eyebrow>
        <h2 className="mt-3 font-heading text-3xl tracking-tight">
          What this team is<br /><span className="text-brand">working on.</span>
        </h2>
        {locs.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No public locations yet.</p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locs.map((l) => (
              <div key={l.id} className="rounded-2xl border border-border bg-background p-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-brand">
                  <MapPin className="h-3.5 w-3.5" /> {l.severity ?? "—"}
                </div>
                <div className="mt-2 font-heading text-lg">{l.location_name}</div>
                <div className="text-sm text-muted-foreground">{l.city}, {l.state}</div>
                {l.issue_type && (
                  <div className="mt-3 text-xs inline-block rounded-full bg-muted px-2 py-0.5">{l.issue_type}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section>
        <div className="rounded-3xl border border-border bg-brand text-brand-foreground p-10 text-center">
          <Trophy className="mx-auto h-8 w-8" />
          <h2 className="mt-4 font-heading text-3xl tracking-tight">
            Want your college on this map?
          </h2>
          <p className="mt-3 max-w-xl mx-auto text-sm opacity-90">
            Project Rakshak is open to student teams across India. Apply or sponsor a team today.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <Link to="/rakshak-platform/auth" className="h-11 px-6 rounded-full bg-background text-foreground text-sm inline-flex items-center font-semibold">
              Register a team
            </Link>
            <Link to="/rakshak-platform/sponsor" className="h-11 px-6 rounded-full border border-brand-foreground/40 text-sm inline-flex items-center font-semibold">
              Sponsor this team
            </Link>
          </div>
        </div>
      </Section>
    </PlatformShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-heading text-3xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
