import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { rpRequireRole } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { listTeamsAdminOverview } from "@/lib/rakshak-platform/admin-teams.functions";
import { Loader2, Search, UsersRound } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/teams/")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["cfi_admin", "super_admin"]);
  },
  component: AdminTeamsIndex,
});

function AdminTeamsIndex() {
  const fetchTeams = useServerFn(listTeamsAdminOverview);
  const [teams, setTeams] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await fetchTeams({ data: {} } as any)) as any;
        if (!cancelled) setTeams(res?.teams ?? []);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchTeams]);

  const filtered = useMemo(() => {
    if (!q.trim()) return teams;
    const s = q.toLowerCase();
    return teams.filter(
      (t) =>
        t.team_name?.toLowerCase().includes(s) ||
        t.college?.toLowerCase().includes(s) ||
        t.city?.toLowerCase().includes(s) ||
        t.leader?.full_name?.toLowerCase().includes(s) ||
        t.rp_mentors?.rp_profiles?.full_name?.toLowerCase().includes(s),
    );
  }, [teams, q]);

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Teams</Eyebrow>
        <div className="mt-4 flex items-center justify-between gap-4">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold">All teams</h1>
          <Link to="/rakshak-platform/admin" className="text-sm text-brand hover:underline">
            ← Back to admin
          </Link>
        </div>
        <p className="mt-2 text-muted-foreground">
          Open a team to see submissions, mentor feedback, shared resources, meetings and members in one place.
        </p>

        <div className="mt-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search team, college, leader, mentor…"
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm"
          />
        </div>

        {busy ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading teams…
          </div>
        ) : err ? (
          <p className="mt-8 text-sm text-red-600">{err}</p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Team</th>
                  <th className="text-left px-4 py-2 font-semibold">Leader</th>
                  <th className="text-left px-4 py-2 font-semibold">Mentor</th>
                  <th className="text-left px-4 py-2 font-semibold">Phase</th>
                  <th className="text-left px-4 py-2 font-semibold">Status</th>
                  <th className="text-right px-4 py-2 font-semibold">Members</th>
                  <th className="text-right px-4 py-2 font-semibold">Score</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{t.team_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.college}
                        {t.city ? ` · ${t.city}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{t.leader?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{t.leader?.email ?? ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{t.rp_mentors?.rp_profiles?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.rp_mentors?.rp_profiles?.email ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">{t.current_phase}</td>
                    <td className="px-4 py-3 text-xs">{t.status}</td>
                    <td className="px-4 py-3 text-right inline-flex items-center gap-1 justify-end">
                      <UsersRound className="h-3.5 w-3.5 text-muted-foreground" />
                      {t.member_count}
                    </td>
                    <td className="px-4 py-3 text-right">{t.final_score ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/rakshak-platform/admin/teams/$teamId"
                        params={{ teamId: t.id }}
                        className="text-brand text-sm hover:underline"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No teams match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
