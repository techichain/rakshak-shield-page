import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { Share2, Users, Star, Clock, Award, Building2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useRPAuth } from "@/lib/rakshak-platform/auth";

const getPublicMentor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: mentor, error } = await supabaseAdmin
      .from("rp_mentors")
      .select(
        "id, expertise, organization, max_teams, current_team_count, rating, avg_response_time_hours, status, created_at, profile_id"
      )
      .eq("id", data.id)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;
    if (!mentor) return { mentor: null, profile: null, teams: [] as any[] };

    const { data: profile } = await supabaseAdmin
      .from("rp_profiles")
      .select("full_name, city, state, organization, avatar_url")
      .eq("id", mentor.profile_id)
      .maybeSingle();

    const { data: teams } = await supabaseAdmin
      .from("rp_teams")
      .select("id, team_name, college, city, state, current_phase, final_score, status")
      .eq("assigned_mentor_id", mentor.id)
      .in("status", ["active", "completed"])
      .order("final_score", { ascending: false })
      .limit(12);

    return { mentor, profile, teams: teams ?? [] };
  });

export const Route = createFileRoute("/rakshak-platform/m/$id")({
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["rp-public-mentor", params.id],
      queryFn: () => getPublicMentor({ data: { id: params.id } }),
    }),
  component: PublicMentorPage,
  errorComponent: ({ error }) => (
    <PlatformShell>
      <Section>
        <p className="text-sm text-muted-foreground">
          Couldn't load this mentor. {String((error as any)?.message ?? "")}
        </p>
      </Section>
    </PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell>
      <Section>
        <h1 className="font-heading text-3xl">Mentor not found</h1>
        <p className="mt-2 text-muted-foreground">
          The link may be outdated or the mentor profile is no longer public.
        </p>
        <Link
          to="/rakshak-platform"
          className="mt-6 inline-flex h-10 items-center rounded-full border border-border px-5 text-sm"
        >
          Back to Project Rakshak
        </Link>
      </Section>
    </PlatformShell>
  ),
  head: ({ loaderData, params }) => {
    const m = (loaderData as any)?.mentor;
    const p = (loaderData as any)?.profile;
    const name = p?.full_name ?? "Mentor";
    const org = m?.organization ?? p?.organization ?? "";
    const title = m
      ? `${name} — Mentor on Project Rakshak`
      : "Project Rakshak — Mentor profile";
    const desc = m
      ? `${name}${org ? ` of ${org}` : ""} mentors student teams auditing India's deadliest roads through Project Rakshak.${m.rating ? ` Rated ${Number(m.rating).toFixed(1)}/5.` : ""}`
      : "Mentor on Project Rakshak — guiding student road-safety teams across India.";
    const url = `https://rakshak-shield-page.lovable.app/rakshak-platform/m/${params.id}`;
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

function PublicMentorPage() {
  const params = Route.useParams();
  const { isTeamLeader, isTeam } = useRPAuth();
  const { data } = useSuspenseQuery({
    queryKey: ["rp-public-mentor", params.id],
    queryFn: () => getPublicMentor({ data: { id: params.id } }),
  });

  const m = data.mentor as any;
  const p = data.profile as any;
  if (!m) throw notFound();

  const teams = data.teams as any[];
  const initials = (p?.full_name ?? "?")
    .split(/\s+/)
    .map((s: string) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function copyLink() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  async function nativeShare() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const title = `${p?.full_name ?? "Mentor"} on Project Rakshak`;
    const text = `Meet ${p?.full_name ?? "this mentor"} — guiding student teams auditing India's deadliest roads.`;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text, url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    copyLink();
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Mentor profile</Eyebrow>

        <div className="mt-6 flex flex-wrap items-start gap-6">
          <div className="h-24 w-24 shrink-0 rounded-2xl bg-brand-lite text-brand flex items-center justify-center font-heading text-3xl overflow-hidden">
            {p?.avatar_url ? (
              <img
                src={p.avatar_url}
                alt={p?.full_name ?? "Mentor avatar"}
                className="h-full w-full object-cover"
              />
            ) : (
              initials || "M"
            )}
          </div>

          <div className="flex-1 min-w-[260px]">
            <h1 className="font-heading text-4xl md:text-5xl tracking-tight">
              {p?.full_name ?? "Mentor"}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {(m.organization || p?.organization) && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {m.organization || p?.organization}
                </span>
              )}
              {(p?.city || p?.state) && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {[p?.city, p?.state].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
            {m.expertise && (
              <p className="mt-4 max-w-2xl text-sm text-foreground/90">{m.expertise}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/rakshak-platform/book/$mentorId"
              params={{ mentorId: m.id }}
              className="h-10 px-4 rounded-full bg-brand text-brand-foreground inline-flex items-center gap-2 text-sm font-medium hover:opacity-90"
            >
              Book a 1:1 session
            </Link>
            <button
              onClick={nativeShare}
              className="h-10 px-4 rounded-full border border-border inline-flex items-center gap-2 text-sm hover:border-brand/40"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
            <button
              onClick={copyLink}
              className="h-10 px-4 rounded-full border border-border inline-flex items-center gap-2 text-sm hover:border-brand/40"
            >
              Copy link
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-4">
          <Stat
            icon={<Users className="h-4 w-4" />}
            label="Teams mentored"
            value={String(m.current_team_count ?? 0)}
            hint={`of ${m.max_teams ?? 0} capacity`}
          />
          <Stat
            icon={<Star className="h-4 w-4" />}
            label="Rating"
            value={m.rating ? Number(m.rating).toFixed(1) : "—"}
            hint={m.rating ? "out of 5.0" : "Not yet rated"}
          />
          <Stat
            icon={<Clock className="h-4 w-4" />}
            label="Avg. response"
            value={
              m.avg_response_time_hours
                ? `${Number(m.avg_response_time_hours).toFixed(1)}h`
                : "—"
            }
            hint="across submissions"
          />
          <Stat
            icon={<Award className="h-4 w-4" />}
            label="Status"
            value={m.status === "active" ? "Active" : m.status}
          />
        </div>
      </Section>

      <Section tone="brand-lite">
        <Eyebrow>Teams under guidance</Eyebrow>
        <h2 className="mt-3 font-heading text-3xl tracking-tight">
          Who they're<br /><span className="text-brand">mentoring.</span>
        </h2>

        {teams.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No active teams yet — new cohort starting soon.
          </p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-border bg-background p-5"
              >
                <div className="text-xs uppercase tracking-wide text-brand">
                  Phase {t.current_phase}/4 · {t.status}
                </div>
                <div className="mt-2 font-heading text-lg">{t.team_name}</div>
                <div className="text-sm text-muted-foreground">
                  {[t.college, t.city, t.state].filter(Boolean).join(" · ")}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Score:{" "}
                  <span className="text-foreground font-semibold">
                    {Number(t.final_score ?? 0).toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section>
        <div className="rounded-3xl border border-border bg-brand text-brand-foreground p-10 text-center">
          <h2 className="font-heading text-3xl tracking-tight">
            Want a mentor like this for your team?
          </h2>
          <p className="mt-3 max-w-xl mx-auto text-sm opacity-90">
            Project Rakshak pairs every student team with an industry mentor. Apply now or
            nominate someone you respect.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <Link
              to="/rakshak-platform/auth"
              className="h-11 px-6 rounded-full bg-background text-foreground text-sm inline-flex items-center font-semibold"
            >
              Register a team
            </Link>
            <Link
              to="/rakshak-platform/mentor-apply"
              className="h-11 px-6 rounded-full border border-brand-foreground/40 text-sm inline-flex items-center font-semibold"
            >
              Apply to mentor
            </Link>
          </div>
        </div>
      </Section>
    </PlatformShell>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-heading text-3xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
