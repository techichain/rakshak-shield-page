import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { PlatformShell, Section } from "@/components/rakshak-platform/Shell";
import { getImpactCard } from "@/lib/rakshak-platform/impact-card.functions";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import { Award, MapPin, Building2, CheckCircle2, Share2, Download, Copy } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/share/$teamId")({
  component: SharePage,
  head: ({ params }) => ({
    meta: [
      { title: "Project Rakshak — Team impact" },
      { name: "description", content: "A student team's road-safety impact under Project Rakshak." },
      { property: "og:title", content: "Project Rakshak team impact" },
      { property: "og:description", content: "Road-safety problem identified, audited, and pitched to authorities." },
      { property: "og:url", content: `/rakshak-platform/share/${params.teamId}` },
    ],
  }),
  notFoundComponent: () => (
    <PlatformShell>
      <Section><p>Team not found.</p></Section>
    </PlatformShell>
  ),
});

function SharePage() {
  const { teamId } = Route.useParams();
  const fetchCard = useServerFn(getImpactCard);
  const { data } = useSuspenseQuery({
    queryKey: ["rp-impact-card", teamId],
    queryFn: () => fetchCard({ data: { teamId } }),
  });

  if (!data.team) throw notFound();
  const { team, location, authority, badges } = data;

  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function downloadPng() {
    const node = cardRef.current;
    if (!node) return;
    const mod = await import("html-to-image");
    const dataUrl = await mod.toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `rakshak-${team.team_name.replace(/\W+/g, "-").toLowerCase()}.png`;
    a.click();
  }

  async function shareNative() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${team.team_name} — Project Rakshak`,
          text: location
            ? `${team.team_name} is tackling ${location.issue_type} at ${location.location_name}.`
            : `${team.team_name} on Project Rakshak.`,
          url: window.location.href,
        });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  }

  return (
    <PlatformShell>
      <Section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl tracking-tight">Shareable impact card</h1>
          <div className="flex gap-2">
            <button onClick={copyLink} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
              <Copy className="h-4 w-4" aria-hidden /> {copied ? "Copied!" : "Copy link"}
            </button>
            <button onClick={shareNative} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
              <Share2 className="h-4 w-4" aria-hidden /> Share
            </button>
            <button onClick={downloadPng} className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground">
              <Download className="h-4 w-4" aria-hidden /> Download PNG
            </button>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <div
            ref={cardRef}
            className="w-full max-w-[640px] overflow-hidden rounded-3xl border border-border bg-white shadow-lg"
          >
            {/* Header */}
            <div className="bg-brand px-8 py-6 text-brand-foreground">
              <div className="text-xs uppercase tracking-[0.2em] opacity-80">Project Rakshak · Crashfree India</div>
              <div className="mt-2 font-heading text-3xl font-bold leading-tight">{team.team_name}</div>
              <div className="mt-1 text-sm opacity-90">
                {[team.college, team.city, team.state].filter(Boolean).join(" · ")}
              </div>
            </div>

            {/* Body */}
            <div className="space-y-6 px-8 py-7">
              {location ? (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Road-safety problem</div>
                  <div className="mt-1 flex items-start gap-2 text-lg font-semibold">
                    <MapPin className="mt-1 h-5 w-5 shrink-0 text-brand" aria-hidden />
                    <span>{location.location_name}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {[location.city, location.state].filter(Boolean).join(", ")} ·{" "}
                    <span className="capitalize">{location.issue_type?.replace(/_/g, " ")}</span> ·{" "}
                    <span className="capitalize">{location.severity}</span> severity
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No final problem location selected yet.</p>
              )}

              <div className="grid grid-cols-3 gap-3 text-center">
                <Stat label="Phase" value={`${team.current_phase}/4`} sub={PHASE_TITLES[team.current_phase] ?? ""} />
                <Stat label="Phases evaluated" value={String(team.evaluated_phases ?? 0)} sub="of 5" />
                <Stat label="Score" value={Number(team.final_score ?? 0).toFixed(1)} sub="weighted total" />
              </div>

              {authority && (
                <div className="rounded-2xl border border-border bg-muted/40 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <Building2 className="h-4 w-4" aria-hidden /> Authority engagement
                  </div>
                  <div className="mt-1 font-medium">{authority.authority_name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Status: <span className="capitalize">{(authority.response_status ?? authority.status ?? "submitted").replace(/_/g, " ")}</span>
                    {authority.response_at && (
                      <> · responded {new Date(authority.response_at).toLocaleDateString()}</>
                    )}
                  </div>
                </div>
              )}

              {badges.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Recognition</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {badges.map((b: any) => (
                      <span
                        key={b.badge_code}
                        className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand-lite px-3 py-1 text-xs font-medium text-brand"
                      >
                        <Award className="h-3.5 w-3.5" aria-hidden />
                        {b.rp_badges?.name ?? b.badge_code}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                  Verified by Crashfree India
                </div>
                {team.rp_cohorts?.name && (
                  <div>{team.rp_cohorts.name} · {team.rp_cohorts.year}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Share this page or download the card to celebrate the team's impact.
        </p>
      </Section>
    </PlatformShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-heading text-2xl font-bold text-brand">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
