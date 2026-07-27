import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { getPhaseSubmissionSlots } from "@/lib/rakshak-platform/submissions.functions";
import {
  listQuestionnairesForTeam,
  submitQuestionnaireResponse,
} from "@/lib/rakshak-platform/questionnaires.functions";
import { PHASE_TITLES, STATUS_META, type PhaseStatus } from "@/lib/rakshak-platform/constants";
import { ArrowLeft, Send, MessageSquare, ClipboardList, CalendarClock } from "lucide-react";
import {
  PhaseSubmissionSlot,
  type SubmissionSlot,
} from "@/components/rakshak-platform/PhaseSubmissionSlot";
import { rpRequireRole } from "@/lib/rakshak-platform/auth";
import { useRPAuth } from "@/lib/rakshak-platform/auth";


const SearchSchema = z.object({ team: z.string().uuid() });

const SLOT_LABELS: Record<string, string> = {
  draft_questionnaire: "Draft questionnaire",
  draft_report: "Draft report",
  final: "Final submission",
};

export const Route = createFileRoute("/rakshak-platform/team/phases/$phase")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["team_leader", "team_member"]);
  },
  validateSearch: (s) => SearchSchema.parse(s),
  component: PhaseDetail,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p className="text-red-600">{String(error)}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
});

function PhaseDetail() {
  const { phase } = Route.useParams();
  const { team } = Route.useSearch();
  const phaseNum = Math.max(0, Math.min(4, Number(phase) || 0));
  const navigate = useNavigate();
  const qc = useQueryClient();

  const slotsFn = useServerFn(getPhaseSubmissionSlots);
  const qListFn = useServerFn(listQuestionnairesForTeam);
  const qSubmitFn = useServerFn(submitQuestionnaireResponse);
  const { userId } = useRPAuth();

  const slotsQueryKey = ["rp-phase-slots", team, phaseNum];
  const { data } = useSuspenseQuery({
    queryKey: slotsQueryKey,
    queryFn: () => slotsFn({ data: { team_id: team, phase_number: phaseNum } }),
  });
  const slots = ((data as any)?.slots ?? []) as SubmissionSlot[];
  const allFeedback = slots.flatMap((s) => s.feedback ?? []);
  const finalSlot = slots.find((s) => s.key === "final");

  const qQuery = useQuery({
    queryKey: ["rp-questionnaires", team, phaseNum],
    queryFn: () => qListFn({ data: { team_id: team, phase_number: phaseNum } }),
  });
  const teamQuestionnaires = (qQuery.data as any)?.questionnaires ?? [];

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [qAnswers, setQAnswers] = useState<Record<string, string[]>>({});
  const [qBusy, setQBusy] = useState<string | null>(null);

  // Hydrate answers when questionnaires load / user's response arrives.
  useEffect(() => {
    if (!teamQuestionnaires.length) return;
    setQAnswers((prev) => {
      const next = { ...prev };
      for (const q of teamQuestionnaires) {
        if (next[q.id]) continue;
        const mine = (q.responses ?? []).find((r: any) => r.respondent_id === userId);
        const answers: string[] = Array.isArray(mine?.answers)
          ? mine.answers.map((a: any) => (a == null ? "" : String(a)))
          : [];
        const filled = (q.questions ?? []).map((_: string, i: number) => answers[i] ?? "");
        next[q.id] = filled;
      }
      return next;
    });
  }, [teamQuestionnaires, userId]);

  async function submitAnswers(qId: string) {
    setQBusy(qId);
    try {
      await qSubmitFn({
        data: {
          questionnaire_id: qId,
          team_id: team,
          answers: qAnswers[qId] ?? [],
        },
      });
      qc.invalidateQueries({ queryKey: ["rp-questionnaires", team, phaseNum] });
      setMsg("Answers saved");
    } catch (e: any) {
      setErr(e?.message ?? "Could not save answers");
    } finally {
      setQBusy(null);
    }
  }

  const progressRow = (data as any)?.progress ?? null;
  const completion = Math.max(
    0,
    Math.min(100, Number(progressRow?.completion_percentage ?? 0)),
  );

  const status = ((finalSlot?.submission?.status ??
    (data as any)?.progress?.status ??
    "not_started") as PhaseStatus);
  const meta = STATUS_META[status];

  return (
    <PlatformShell>
      <Section>
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <Link
            to="/rakshak-platform/team"
            className="text-sm text-muted-foreground hover:text-brand inline-flex items-center gap-1"
          >
            <ArrowLeft className="size-4" /> Back to dashboard
          </Link>
          <button
            onClick={() => navigate({ to: "/rakshak-platform/team/phases" })}
            className="text-sm text-muted-foreground hover:text-brand"
          >
            Back to board
          </button>
        </div>
        <Eyebrow>Phase {phaseNum} · {PHASE_TITLES[phaseNum]}</Eyebrow>
        <div className="mt-3 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
            {PHASE_TITLES[phaseNum]}
          </h1>
          <span className={`text-xs px-3 py-1 rounded-full border ${meta.tone}`}>{meta.label}</span>
        </div>

        {err && <p className="mt-4 text-red-600 text-sm">{err}</p>}
        {msg && <p className="mt-4 text-emerald-700 text-sm">{msg}</p>}

        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 space-y-6">
            <p className="text-sm text-muted-foreground">
              This phase has three slots. Drafts are for your own work-in-progress; only the
              final submission goes to your mentor for review.
            </p>
            {slots.map((slot, i) => (
              <div key={slot.key} id={`slot-${slot.key}`} className="scroll-mt-24">
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-lite text-[11px] font-semibold text-brand">
                    {i + 1}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {SLOT_LABELS[slot.key] ?? slot.key}
                  </span>
                </div>
                <PhaseSubmissionSlot
                  slot={slot}
                  teamId={team}
                  phaseNumber={phaseNum}
                  queryKey={slotsQueryKey}
                />
              </div>
            ))}
          </div>

          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="rp-card p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <CalendarClock className="size-4" /> Phase summary
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Deadline</dt>
                  <dd className="font-medium">
                    {progressRow?.deadline
                      ? new Date(progressRow.deadline).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Not set"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Progress</dt>
                  <dd className="font-medium">{completion}%</dd>
                </div>
              </dl>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand" style={{ width: `${completion}%` }} />
              </div>
              <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What to submit here
              </h4>
              <ul className="mt-2 space-y-1.5 text-sm">
                {slots.map((slot) => (
                  <li key={slot.key}>
                    <a
                      href={`#slot-${slot.key}`}
                      className="inline-flex items-center gap-2 text-brand hover:underline"
                    >
                      {SLOT_LABELS[slot.key] ?? slot.key}
                      <span className="text-[11px] text-muted-foreground">
                        {slot.submission ? "started" : "not started"}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rp-card p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-3"><MessageSquare className="size-4" /> Mentor & evaluator feedback</h3>
              {allFeedback.length === 0 ? (
                <p className="text-sm text-muted-foreground">No feedback yet.</p>
              ) : (
                <ul className="space-y-3">
                  {allFeedback.map((fb: any) => (
                    <li key={fb.id} className="text-sm border-l-2 border-brand pl-3">
                      <div className="text-xs text-muted-foreground">{fb.rp_profiles?.full_name ?? "Reviewer"} · {new Date(fb.created_at).toLocaleString()}</div>
                      <div className="whitespace-pre-line mt-1">{fb.content ?? fb.message}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {teamQuestionnaires.length > 0 && (
              <div className="rp-card p-5 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <ClipboardList className="size-4" /> Admin questionnaires
                </h3>
                {teamQuestionnaires.map((q: any) => {
                  const mine = (q.responses ?? []).find((r: any) => r.respondent_id === userId);
                  const answers = qAnswers[q.id] ?? (q.questions ?? []).map(() => "");
                  return (
                    <div key={q.id} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="font-semibold text-sm">{q.title}</div>
                      {mine && (
                        <div className="text-[11px] text-muted-foreground">
                          Submitted {new Date(mine.submitted_at).toLocaleString()} — you can edit and resubmit.
                        </div>
                      )}
                      <div className="space-y-3">
                        {(q.questions ?? []).map((qq: string, i: number) => (
                          <label key={i} className="block">
                            <span className="text-xs font-medium text-muted-foreground">
                              {i + 1}. {qq}
                            </span>
                            <textarea
                              value={answers[i] ?? ""}
                              maxLength={4000}
                              rows={2}
                              onChange={(e) => {
                                const next = { ...qAnswers };
                                const arr = (next[q.id] ?? (q.questions ?? []).map(() => "")).slice();
                                arr[i] = e.target.value;
                                next[q.id] = arr;
                                setQAnswers(next);
                              }}
                              className="rp-input w-full mt-1"
                              placeholder="Your answer"
                            />
                          </label>
                        ))}
                      </div>
                      <button
                        disabled={qBusy === q.id}
                        onClick={() => submitAnswers(q.id)}
                        className="rp-btn-primary text-xs inline-flex items-center gap-1"
                      >
                        <Send className="size-3" />
                        {qBusy === q.id ? "Saving…" : mine ? "Update answers" : "Submit answers"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="rp-card p-5 text-sm space-y-2">
              <h3 className="font-semibold">Tips for this phase</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Be specific — cite numbers, dates, places.</li>
                <li>Attach geo-tagged photos when possible.</li>
                <li>Get authority response receipts where relevant.</li>
                <li>If blocked, request a 1:1 with your mentor.</li>
              </ul>
              <Link to="/rakshak-platform/mentors" className="text-brand text-sm font-medium inline-block mt-2">Find a mentor →</Link>
            </div>
          </div>
        </div>
      </Section>
    </PlatformShell>
  );
}
