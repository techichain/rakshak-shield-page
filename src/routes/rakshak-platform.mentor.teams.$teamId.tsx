import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { rpRequireRole } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { getMentorTeamDetail } from "@/lib/rakshak-platform/mentor-team-detail.functions";
import { EvidenceRepository } from "@/components/rakshak-platform/EvidenceRepository";
import { MediaGallery } from "@/components/rakshak-platform/MediaGallery";
import { TeamUpdates } from "@/components/rakshak-platform/TeamUpdates";
import { AuthorityEngagement } from "@/components/rakshak-platform/AuthorityEngagement";

import { SubmissionKindBadge } from "@/components/rakshak-platform/SubmissionKindBadge";
import { RubricScoreBreakdown } from "@/components/rakshak-platform/RubricScoreBreakdown";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import { listQuestionnairesForTeam } from "@/lib/rakshak-platform/questionnaires.functions";
import { createDoubt } from "@/lib/rakshak-platform/doubts.functions";
import {
  Loader2,
  UsersRound,
  FileText,
  MessageSquare,
  MapPin,
  ExternalLink,
  CalendarDays,
  ClipboardList,
  HelpCircle,
} from "lucide-react";


export const Route = createFileRoute("/rakshak-platform/mentor/teams/$teamId")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["mentor"]);
  },
  component: MentorTeamDetail,
});

type Tab = "overview" | "submissions" | "meetings";

import { formatMeetingWhen } from "@/lib/rakshak-platform/meeting-time";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function MentorTeamDetail() {
  const { teamId } = Route.useParams();
  const fetchDetail = useServerFn(getMentorTeamDetail);
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      setErr(null);
      try {
        const res = await fetchDetail({ data: { team_id: teamId } } as any);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [teamId, fetchDetail]);

  if (busy) {
    return (
      <PlatformShell>
        <Section className="!py-16">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading team…
          </div>
        </Section>
      </PlatformShell>
    );
  }

  if (err || !data) {
    const isForbidden = (err ?? "").toLowerCase().includes("forbidden");
    return (
      <PlatformShell>
        <Section>
          <div className="rounded-2xl border border-border bg-card p-8">
            <h1 className="font-heading text-2xl font-semibold">
              {isForbidden ? "Not your team" : "Team unavailable"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isForbidden
                ? "This team isn't assigned to you. You can only view detail pages for teams where you are the assigned mentor."
                : (err ?? "Something went wrong loading this team.")}
            </p>
            <div className="mt-6">
              <Link to="/rakshak-platform/mentor" className="text-sm text-brand hover:underline">
                ← Back to mentor workspace
              </Link>
            </div>
          </div>
        </Section>
      </PlatformShell>
    );
  }

  const { team, members, progress, submissions, feedback, files, meetings, evaluations, locations, location_photos } = data;
  const progressByPhase = new Map<number, any>();
  for (const p of progress) progressByPhase.set(p.phase_number, p);
  const subsByPhase = new Map<number, any[]>();
  for (const s of submissions) {
    const arr = subsByPhase.get(s.phase_number) ?? [];
    arr.push(s); subsByPhase.set(s.phase_number, arr);
  }
  const fbBySubmission = new Map<string, any[]>();
  for (const f of feedback) {
    if (!f.submission_id) continue;
    const arr = fbBySubmission.get(f.submission_id) ?? [];
    arr.push(f); fbBySubmission.set(f.submission_id, arr);
  }
  const filesBySubmission = new Map<string, any[]>();
  for (const f of files) {
    if (!f.submission_id) continue;
    const arr = filesBySubmission.get(f.submission_id) ?? [];
    arr.push(f); filesBySubmission.set(f.submission_id, arr);
  }
  const evalsBySubmission = new Map<string, any[]>();
  for (const ev of evaluations) {
    if (!ev.submission_id) continue;
    const arr = evalsBySubmission.get(ev.submission_id) ?? [];
    arr.push(ev); evalsBySubmission.set(ev.submission_id, arr);
  }
  const locsByPhase = new Map<number, any[]>();
  for (const l of locations) {
    const arr = locsByPhase.get(l.phase_number) ?? [];
    arr.push(l); locsByPhase.set(l.phase_number, arr);
  }
  const photosByLocation = new Map<string, any[]>();
  for (const p of location_photos) {
    const arr = photosByLocation.get(p.location_id) ?? [];
    arr.push(p); photosByLocation.set(p.location_id, arr);
  }

  const phaseNumbers = [0, 1, 2, 3, 4];

  return (
    <PlatformShell>
      <Section>
        <div className="mb-2">
          <Link to="/rakshak-platform/mentor" className="text-xs text-muted-foreground hover:text-brand">
            ← Back to mentor workspace
          </Link>
        </div>
        <Eyebrow>Team detail · read-only</Eyebrow>
        <h1 className="mt-4 font-heading text-3xl sm:text-4xl font-bold leading-[1.05]">
          {team.team_name}
        </h1>
        <div className="mt-2 text-sm text-muted-foreground">
          {team.college} · {team.city}, {team.state}
        </div>

        <div className="mt-8 flex flex-wrap gap-2 border-b border-border">
          {(["overview", "submissions", "meetings"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                tab === t ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "overview" ? "Overview" : t === "submissions" ? "Submissions & feedback" : "Meetings"}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-heading text-lg font-semibold">Status</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Current phase</div>
                  <div>Phase {team.current_phase} — {PHASE_TITLES[team.current_phase]}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Completion</div>
                  <div>{team.completion_percentage}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Final score</div>
                  <div>{team.final_score == null ? "—" : Number(team.final_score).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Rank</div>
                  <div>{team.rank ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Risk</div>
                  <div className={team.risk_status === "at_risk" ? "text-red-600" : ""}>
                    {team.risk_status?.replace("_", " ") ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div>{team.status}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
                <UsersRound className="h-4 w-4" /> Team leader
              </h2>
              {team.leader ? (
                <div className="mt-4 text-sm space-y-1">
                  <div className="font-medium">{team.leader.full_name}</div>
                  <div className="text-muted-foreground">{team.leader.email}</div>
                  {team.leader.phone && <div className="text-muted-foreground">{team.leader.phone}</div>}
                </div>
              ) : <div className="mt-4 text-sm text-muted-foreground">No leader assigned.</div>}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
              <h2 className="font-heading text-lg font-semibold">Team members</h2>
              {members.length === 0 ? (
                <div className="mt-4 text-sm text-muted-foreground">No members yet.</div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border">
                        <th className="py-2 pr-4">Name</th>
                        <th className="py-2 pr-4">Role</th>
                        <th className="py-2 pr-4">Email</th>
                        <th className="py-2 pr-4">Phone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m: any) => (
                        <tr key={m.id} className="border-b border-border/50">
                          <td className="py-2 pr-4">{m.full_name}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{m.role_in_team ?? "—"}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{m.email ?? "—"}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{m.phone ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
              <h2 className="font-heading text-lg font-semibold">Phase progress</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {phaseNumbers.map((n) => {
                  const p = progressByPhase.get(n);
                  return (
                    <div key={n} className="rounded-xl border border-border p-3 text-sm">
                      <div className="text-xs text-muted-foreground">Phase {n}</div>
                      <div className="font-medium">{PHASE_TITLES[n]}</div>
                      <div className="mt-2 text-xs">
                        Status: <span className="font-medium">{p?.status ?? "not started"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Deadline: {p?.deadline ? fmtDate(p.deadline) : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "submissions" && (
          <div className="mt-8 space-y-8">
            <MentorRaiseDoubt teamId={team.id} teamName={team.team_name} />
            <TeamQuestionnairesPanel teamId={team.id} />
            <EvidenceRepository teamId={team.id} readOnly heading="Evidence & records filed by this team" />
            <MediaGallery teamId={team.id} readOnly heading="Site media from this team" />
            <AuthorityEngagement teamId={team.id} readOnly heading="Authority engagement by this team" />
            <TeamUpdates teamId={team.id} readOnly heading="Shared by this team (exam schedules, availability)" />


            {phaseNumbers.map((n) => {
              const subs = subsByPhase.get(n) ?? [];
              const locs = locsByPhase.get(n) ?? [];
              const prog = progressByPhase.get(n);
              return (
                <div key={n} className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-xs text-muted-foreground">Phase {n}</div>
                      <h2 className="font-heading text-lg font-semibold">{PHASE_TITLES[n]}</h2>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Deadline: {prog?.deadline ? fmtDate(prog.deadline) : "—"}
                    </div>
                  </div>

                  {subs.length === 0 ? (
                    <div className="mt-4 text-sm text-muted-foreground">No submissions yet for this phase.</div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {subs.map((s: any) => {
                        const fb = fbBySubmission.get(s.id) ?? [];
                        const fs = filesBySubmission.get(s.id) ?? [];
                        const evs = evalsBySubmission.get(s.id) ?? [];
                        return (
                          <div key={s.id} className="rounded-xl border border-border p-4">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="font-medium flex items-center gap-2 flex-wrap">
                                <FileText className="h-4 w-4" />
                                {s.title ?? `Submission ${s.id.slice(0, 6)}`}
                                <SubmissionKindBadge
                                  documentType={s.document_type}
                                  isFinal={s.is_final}
                                />
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded-full border border-border">
                                {s.status}
                              </span>
                            </div>
                            {s.summary && (
                              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{s.summary}</p>
                            )}
                            <div className="mt-2 text-xs text-muted-foreground">
                              Submitted: {fmtDate(s.submitted_at ?? s.created_at)}
                            </div>

                            {fs.length > 0 && (
                              <div className="mt-3">
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Files</div>
                                <ul className="mt-1 text-sm space-y-1">
                                  {fs.map((f: any) => (
                                    <li key={f.id} className="flex items-center gap-2 text-muted-foreground">
                                      <FileText className="h-3.5 w-3.5" />
                                      <span>{f.file_name ?? f.storage_path}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {evs.length > 0 && (
                              <div className="mt-3">
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Evaluator scores
                                </div>
                                <ul className="mt-1 text-sm space-y-2">
                                  {evs.map((ev: any) => (
                                    <li key={ev.id} className="space-y-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <span>
                                          {ev.evaluator?.full_name ?? "Evaluator"}
                                          <span className="text-muted-foreground"> · {ev.status}</span>
                                        </span>
                                        <span className="font-medium">
                                          {ev.weighted_score ?? ev.total_score ?? "—"}
                                        </span>
                                      </div>
                                      {Array.isArray(ev.rubric_scores) && ev.rubric_scores.length > 0 && (
                                        <RubricScoreBreakdown
                                          rubricScores={ev.rubric_scores}
                                          totalScore={ev.total_score}
                                        />
                                      )}
                                    </li>
                                  ))}
                                </ul>
                                {evs.some((ev: any) => ev.comments) && (
                                  <div className="mt-2 space-y-1">
                                    {evs.filter((ev: any) => ev.comments).map((ev: any) => (
                                      <div key={`c-${ev.id}`} className="text-xs text-muted-foreground border-l-2 border-border pl-2">
                                        <span className="font-medium text-foreground">{ev.evaluator?.full_name ?? "Evaluator"}:</span> {ev.comments}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {fb.length > 0 && (
                              <div className="mt-3">
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                  <MessageSquare className="h-3.5 w-3.5" /> Feedback
                                </div>
                                <ul className="mt-1 space-y-2">
                                  {fb.map((f: any) => (
                                    <li key={f.id} className="text-sm border-l-2 border-border pl-3">
                                      <div className="text-xs text-muted-foreground">
                                        {f.rp_profiles?.full_name ?? f.reviewer_role} · {f.reviewer_role} · {fmtDate(f.created_at)}
                                      </div>
                                      <div className="whitespace-pre-wrap">{f.feedback_text}</div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {locs.length > 0 && (
                    <div className="mt-6">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> Site evidence
                      </div>
                      <div className="mt-2 grid gap-3 md:grid-cols-2">
                        {locs.map((l: any) => {
                          const ph = photosByLocation.get(l.id) ?? [];
                          return (
                            <div key={l.id} className="rounded-xl border border-border p-3 text-sm">
                              <div className="font-medium">{l.location_name ?? l.address ?? "Site"}</div>
                              <div className="text-xs text-muted-foreground">
                                {l.address && <>{l.address} · </>}{l.city}, {l.state}
                              </div>
                              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <div className="text-muted-foreground">GPS</div>
                                  <div>{l.latitude != null ? Number(l.latitude).toFixed(5) : "—"}, {l.longitude != null ? Number(l.longitude).toFixed(5) : "—"}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Severity</div>
                                  <div className="font-medium">{l.severity ?? "—"}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Issue</div>
                                  <div>{l.issue_type ?? "—"}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Priority</div>
                                  <div>{l.priority_rank ?? "—"}</div>
                                </div>
                              </div>
                              {l.description && (
                                <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{l.description}</p>
                              )}
                              {l.drive_link && (
                                <a
                                  href={l.drive_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-flex items-center gap-1 text-xs text-brand hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" /> Photos / videos folder
                                </a>
                              )}
                              {ph.length > 0 && (
                                <div className="mt-2 grid grid-cols-3 gap-1">
                                  {ph.slice(0, 6).map((p: any) => (
                                    p.signed_url ? (
                                      <a key={p.id} href={p.signed_url} target="_blank" rel="noreferrer" className="block">
                                        <img
                                          src={p.signed_url}
                                          alt={p.caption ?? p.file_name}
                                          className="h-16 w-full object-cover rounded"
                                          loading="lazy"
                                        />
                                      </a>
                                    ) : null
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "meetings" && (
          <div className="mt-8 space-y-3">
            {meetings.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                No meetings scheduled for this team.
              </div>
            ) : (
              meetings.map((m: any) => (
                <div key={m.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="font-medium flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      {m.title ?? "Meeting"}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatMeetingWhen(m.scheduled_start, m.scheduled_end)}</span>
                  </div>
                  {m.agenda && (
                    <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{m.agenda}</p>
                  )}
                  {m.notes && (
                    <div className="mt-2 text-sm border-l-2 border-border pl-3 whitespace-pre-wrap">
                      {m.notes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}

/** Read-only view of the questionnaires this team has answered. */
function TeamQuestionnairesPanel({ teamId }: { teamId: string }) {
  const listQ = useServerFn(listQuestionnairesForTeam);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const res = (await listQ({ data: { team_id: teamId } } as any)) as any;
        if (!cancelled) setRows(res?.questionnaires ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [teamId, listQ]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
        <ClipboardList className="h-4 w-4" /> Questionnaires shared by this team
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Admin checklists and the answers this team submitted. Read-only.
      </p>
      {busy ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading questionnaires…
        </div>
      ) : error ? (
        <div className="mt-4 text-sm text-muted-foreground">{error}</div>
      ) : rows.length === 0 ? (
        <div className="mt-4 text-sm text-muted-foreground">No questionnaires for this team yet.</div>
      ) : (
        <div className="mt-4 space-y-4">
          {rows.map((q: any) => (
            <div key={q.id} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="font-medium">{q.title}</div>
                <span className="text-xs text-muted-foreground">
                  {q.phase_number != null ? `Phase ${q.phase_number}` : "All phases"}
                </span>
              </div>
              {(q.responses ?? []).length === 0 ? (
                <div className="mt-2 text-xs text-muted-foreground">No responses submitted yet.</div>
              ) : (
                <div className="mt-3 space-y-3">
                  {(q.responses ?? []).map((r: any) => (
                    <div key={r.id} className="rounded-lg border border-border/60 p-3">
                      <div className="text-xs text-muted-foreground">
                        {r.rp_profiles?.full_name ?? "Team member"} · {fmtDate(r.submitted_at)}
                      </div>
                      <ul className="mt-2 space-y-2 text-sm">
                        {((q.questions ?? []) as string[]).map((question: string, i: number) => (
                          <li key={i}>
                            <div className="text-xs text-muted-foreground">{question}</div>
                            <div className="whitespace-pre-wrap">
                              {(r.answers ?? [])[i] || "—"}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Lets the assigned mentor raise a question to admins in this team's context. */
function MentorRaiseDoubt({ teamId, teamName }: { teamId: string; teamName: string }) {
  const ask = useServerFn(createDoubt);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (question.trim().length < 3) return;
    setSaving(true); setError(null);
    try {
      await ask({ data: { team_id: teamId, question: question.trim() } } as any);
      setQuestion(""); setOpen(false); setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
        <HelpCircle className="h-4 w-4" /> Raise a doubt with the programme office
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Your question goes to the CFI admins, flagged as raised by you (the mentor) in the context of {teamName}.
      </p>
      {done && !open && (
        <div className="mt-3 text-sm text-emerald-700">Sent — admins have been notified.</div>
      )}
      {!open ? (
        <button
          onClick={() => { setOpen(true); setDone(false); }}
          className="mt-4 h-9 rounded-full bg-brand px-4 text-xs text-brand-foreground hover:bg-brand/90"
        >
          Ask a question
        </button>
      ) : (
        <div className="mt-4 space-y-2">
          <textarea
            rows={3}
            maxLength={2000}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What do you need clarified?"
            className="rp-input w-full"
          />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex gap-2">
            <button
              disabled={saving || question.trim().length < 3}
              onClick={() => void submit()}
              className="h-9 rounded-full bg-brand px-4 text-xs text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
            >
              {saving ? "Sending…" : "Send to admin"}
            </button>
            <button
              onClick={() => { setOpen(false); setError(null); }}
              className="h-9 rounded-full border border-border px-4 text-xs hover:border-brand/40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

