import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { getMyTeams, listTeamPhases } from "@/lib/rakshak-platform/submissions.functions";
import { PHASE_TITLES, STATUS_META, type PhaseStatus } from "@/lib/rakshak-platform/constants";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { ArrowRight, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/team/phases")({
  component: TeamPhasesPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p className="text-red-600">{String(error)}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
});

type Column = { id: string; title: string; match: (s: PhaseStatus) => boolean };

const COLUMNS: Column[] = [
  { id: "todo", title: "To do", match: (s) => s === "not_started" },
  { id: "doing", title: "In progress", match: (s) => s === "draft" || s === "changes_requested" },
  {
    id: "review",
    title: "In review",
    match: (s) =>
      s === "submitted" ||
      s === "resubmitted" ||
      s === "under_mentor_review" ||
      s === "mentor_approved" ||
      s === "under_admin_review",
  },
  {
    id: "done",
    title: "Done",
    match: (s) => s === "admin_approved" || s === "completed",
  },
];

function TeamPhasesPage() {
  const { loading, userId } = useRPAuth();
  const navigate = useNavigate();
  const teamsFn = useServerFn(getMyTeams);
  const phasesFn = useServerFn(listTeamPhases);

  useEffect(() => {
    if (!loading && !userId) navigate({ to: "/rakshak-platform/auth" });
  }, [loading, userId, navigate]);

  const { data: tData } = useSuspenseQuery({
    queryKey: ["rp-my-teams"],
    queryFn: () => teamsFn(),
  });
  const teams = tData.teams;
  const [teamId, setTeamId] = useState<string | null>(null);
  useEffect(() => {
    if (!teamId && teams[0]) setTeamId(teams[0].id);
  }, [teams, teamId]);

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Team workspace</Eyebrow>
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <h1 className="text-3xl font-extrabold">Phase Kanban</h1>
          {teams.length > 1 && (
            <select
              value={teamId ?? ""}
              onChange={(e) => setTeamId(e.target.value)}
              className="rp-input"
            >
              {teams.map((t: any) => (
                <option key={t.id} value={t.id}>{t.team_name}</option>
              ))}
            </select>
          )}
        </div>
        {teams.length === 0 ? (
          <p className="text-muted-foreground">You aren't on a team yet. Ask your admin to add you.</p>
        ) : teamId ? (
          <Board teamId={teamId} phasesFn={phasesFn} />
        ) : null}
      </Section>
    </PlatformShell>
  );
}

function Board({ teamId, phasesFn }: { teamId: string; phasesFn: any }) {
  const { data } = useSuspenseQuery({
    queryKey: ["rp-team-phases", teamId],
    queryFn: () => phasesFn({ data: { team_id: teamId } }),
  });

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = { todo: [], doing: [], review: [], done: [] };
    for (const p of data.phases) {
      const status = (p.submission?.status ?? p.progress.status) as PhaseStatus;
      const col = COLUMNS.find((c) => c.match(status)) ?? COLUMNS[0];
      map[col.id].push({ ...p, _status: status });
    }
    return map;
  }, [data]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {COLUMNS.map((col) => (
        <div key={col.id} className="bg-muted/40 rounded-xl p-3 min-h-[420px]">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-3 flex items-center justify-between">
            <span>{col.title}</span>
            <span className="bg-background rounded-full px-2 py-0.5">{grouped[col.id].length}</span>
          </div>
          <div className="space-y-3">
            {grouped[col.id].map((p) => (
              <PhaseCard key={p.phase_number} teamId={teamId} phase={p} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PhaseCard({ teamId, phase }: { teamId: string; phase: any }) {
  const meta = STATUS_META[phase._status as PhaseStatus] ?? STATUS_META.not_started;
  const deadline = phase.progress.deadline ? new Date(phase.progress.deadline) : null;
  const overdue = deadline && deadline.getTime() < Date.now() && phase._status !== "completed" && phase._status !== "admin_approved";
  return (
    <Link
      to="/rakshak-platform/team/phases/$phase"
      params={{ phase: String(phase.phase_number) }}
      search={{ team: teamId }}
      className="block bg-background rounded-lg border border-border p-4 hover:border-brand transition shadow-sm"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Phase {phase.phase_number}</div>
          <div className="font-semibold leading-tight">{PHASE_TITLES[phase.phase_number]}</div>
        </div>
        {phase.progress.is_at_risk && <AlertTriangle className="size-4 text-red-500 shrink-0" />}
      </div>
      <div className={`text-xs inline-block px-2 py-0.5 rounded-full border ${meta.tone}`}>{meta.label}</div>
      <div className="mt-3 text-xs text-muted-foreground flex items-center gap-3">
        <span>{phase.progress.completion_percentage}% complete</span>
        {phase.submission && <span>· rev {phase.submission.revision_number}</span>}
      </div>
      {deadline && (
        <div className={`mt-2 text-xs flex items-center gap-1 ${overdue ? "text-red-600" : "text-muted-foreground"}`}>
          <Clock className="size-3" />
          Due {deadline.toLocaleDateString()}
          {overdue && " · overdue"}
        </div>
      )}
      {(phase._status === "admin_approved" || phase._status === "completed") && (
        <div className="mt-2 text-xs text-emerald-700 flex items-center gap-1">
          <CheckCircle2 className="size-3" /> Approved
        </div>
      )}
      <div className="mt-3 text-xs text-brand flex items-center gap-1 font-medium">
        Open <ArrowRight className="size-3" />
      </div>
    </Link>
  );
}
