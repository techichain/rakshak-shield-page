import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import {
  listBadges,
  listTeamBadges,
  listTeamsForBadges,
  awardBadge,
  revokeBadge,
} from "@/lib/rakshak-platform/badges.functions";

export const Route = createFileRoute("/rakshak-platform/admin/badges")({
  component: AdminBadges,
  errorComponent: ({ error }) => {
    if (String(error).includes("Forbidden") || String(error).includes("Unauthorized")) {
      throw redirect({ to: "/rakshak-platform/auth" });
    }
    return <PlatformShell><Section><p>{String(error)}</p></Section></PlatformShell>;
  },
  notFoundComponent: () => <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>,
});

function AdminBadges() {
  const qc = useQueryClient();
  const fetchBadges = useServerFn(listBadges);
  const fetchTeams = useServerFn(listTeamsForBadges);
  const fetchAwards = useServerFn(listTeamBadges);
  const grant = useServerFn(awardBadge);
  const revoke = useServerFn(revokeBadge);

  const { data: badgesData } = useSuspenseQuery({
    queryKey: ["rp-badges"],
    queryFn: () => fetchBadges(),
  });
  const { data: teamsData } = useSuspenseQuery({
    queryKey: ["rp-badges-teams"],
    queryFn: () => fetchTeams(),
  });
  const { data: awardsData } = useQuery({
    queryKey: ["rp-team-badges-all"],
    queryFn: () => fetchAwards(),
  });

  const [teamId, setTeamId] = useState("");
  const [badgeCode, setBadgeCode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAward(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId || !badgeCode) return;
    setBusy(true);
    try {
      await grant({ data: { teamId, badgeCode, note: note || undefined } });
      setNote("");
      qc.invalidateQueries({ queryKey: ["rp-team-badges-all"] });
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(t: string, b: string) {
    if (!confirm("Revoke this badge?")) return;
    await revoke({ data: { teamId: t, badgeCode: b } });
    qc.invalidateQueries({ queryKey: ["rp-team-badges-all"] });
  }

  const badges = badgesData.badges;
  const teams = teamsData.teams;
  const awards = awardsData?.awards ?? [];

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Recognition</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Award badges to
          <br /><span className="text-brand">standout teams.</span>
        </h1>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          {/* Catalog */}
          <div>
            <h2 className="font-heading text-2xl font-semibold">Badge catalog</h2>
            <div className="mt-4 grid gap-3">
              {badges.map((b: any) => (
                <div key={b.code} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{b.name}</div>
                      <div className="text-xs text-muted-foreground">{b.description}</div>
                    </div>
                    <code className="rounded bg-muted px-2 py-1 text-xs">{b.code}</code>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-semibold">Criteria:</span> {b.criteria}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Award form */}
          <div>
            <h2 className="font-heading text-2xl font-semibold">Award a badge</h2>
            <form onSubmit={handleAward} className="mt-4 space-y-4 rounded-xl border border-border p-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Team</span>
                <select
                  required
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="">Select team…</option>
                  {teams.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.team_name}
                      {t.rp_cohorts?.name ? ` — ${t.rp_cohorts.name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Badge</span>
                <select
                  required
                  value={badgeCode}
                  onChange={(e) => setBadgeCode(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="">Select badge…</option>
                  {badges.map((b: any) => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Note (optional)</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="rounded-md border border-border bg-background px-3 py-2"
                />
              </label>
              <button
                type="submit"
                disabled={busy || !teamId || !badgeCode}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50"
              >
                {busy ? "Awarding…" : "Award badge"}
              </button>
            </form>
          </div>
        </div>

        <h2 className="mt-12 font-heading text-2xl font-semibold">Recent awards</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">All badge awards</caption>
            <thead className="bg-brand-lite text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">Team</th>
                <th scope="col" className="px-4 py-3">Badge</th>
                <th scope="col" className="px-4 py-3">Note</th>
                <th scope="col" className="px-4 py-3">Awarded</th>
                <th scope="col" className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {awards.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No badges awarded yet.</td></tr>
              )}
              {awards.map((a: any) => {
                const team = teams.find((t: any) => t.id === a.team_id);
                return (
                  <tr key={a.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">{team?.team_name ?? a.team_id.slice(0, 8)}</td>
                    <td className="px-4 py-3">{a.rp_badges?.name ?? a.badge_code}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.note ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(a.awarded_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRevoke(a.team_id, a.badge_code)}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </PlatformShell>
  );
}
