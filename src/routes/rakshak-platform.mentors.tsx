import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { Users, Star, ArrowUpRight } from "lucide-react";

const listPublicMentors = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: mentors, error } = await supabaseAdmin
    .from("rp_mentors")
    .select(
      "id, expertise, organization, current_team_count, max_teams, rating, profile_id"
    )
    .eq("status", "active")
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(60);
  if (error) throw error;

  const profileIds = (mentors ?? []).map((m) => m.profile_id);
  let profiles: any[] = [];
  if (profileIds.length) {
    const { data: profs } = await supabaseAdmin
      .from("rp_profiles")
      .select("id, full_name, city, state, organization, avatar_url")
      .in("id", profileIds);
    profiles = profs ?? [];
  }
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  return {
    mentors: (mentors ?? []).map((m) => ({
      ...m,
      profile: profileById.get(m.profile_id) ?? null,
    })),
  };
});

export const Route = createFileRoute("/rakshak-platform/mentors")({
  ssr: false,
  // Oversight-only directory: admins and evaluators. Teams book their own
  // assigned mentor via /rakshak-platform/team/book-mentor.
  beforeLoad: async () => {
    await rpRequireRole(["super_admin", "cfi_admin", "evaluator"]);
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["rp-public-mentors"],
      queryFn: () => listPublicMentors(),
    }),
  component: MentorsDirectory,
  errorComponent: ({ error }) => (
    <PlatformShell>
      <Section>
        <p className="text-sm text-muted-foreground">
          Couldn't load mentors. {String((error as any)?.message ?? "")}
        </p>
      </Section>
    </PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell>
      <Section>
        <h1 className="font-heading text-3xl">Not found</h1>
      </Section>
    </PlatformShell>
  ),
  head: () => {
    const title = "Mentors — Project Rakshak";
    const desc =
      "Industry mentors guiding student teams to audit and fix India's deadliest roads through Project Rakshak.";
    const url = "https://rakshak-shield-page.lovable.app/rakshak-platform/mentors";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});

function MentorsDirectory() {
  const { data } = useSuspenseQuery({
    queryKey: ["rp-public-mentors"],
    queryFn: () => listPublicMentors(),
  });
  const mentors = data.mentors;

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Mentor network</Eyebrow>
        <h1 className="mt-6 font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
          The people steering<br /><span className="text-brand">student teams.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-muted-foreground">
          Practitioners from road-safety, civil engineering, traffic, and public-policy
          backgrounds — each guiding teams through five evaluation phases.
        </p>

        {mentors.length === 0 ? (
          <p className="mt-12 text-sm text-muted-foreground">
            No public mentors yet. Check back as the cohort grows.
          </p>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mentors.map((m: any) => {
              const p = m.profile;
              const initials = (p?.full_name ?? "?")
                .split(/\s+/)
                .map((s: string) => s[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <Link
                  key={m.id}
                  to="/rakshak-platform/m/$id"
                  params={{ id: m.id }}
                  className="group rounded-2xl border border-border bg-background p-5 hover:border-brand/40 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-14 w-14 shrink-0 rounded-xl bg-brand-lite text-brand flex items-center justify-center font-heading text-xl overflow-hidden">
                      {p?.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt={p?.full_name ?? "Mentor"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials || "M"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-heading text-lg leading-tight truncate">
                        {p?.full_name ?? "Mentor"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {m.organization || p?.organization || ""}
                      </div>
                      {(p?.city || p?.state) && (
                        <div className="text-xs text-muted-foreground truncate">
                          {[p?.city, p?.state].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-brand" />
                  </div>

                  {m.expertise && (
                    <p className="mt-3 text-sm text-foreground/80 line-clamp-2">
                      {m.expertise}
                    </p>
                  )}

                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {m.current_team_count ?? 0}/{m.max_teams ?? 0} teams
                    </span>
                    {m.rating && (
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5" />
                        {Number(m.rating).toFixed(1)}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
