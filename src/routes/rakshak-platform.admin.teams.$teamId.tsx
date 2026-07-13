import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { rpRequireRole } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { getAdminTeamDetail, addAdminRemark } from "@/lib/rakshak-platform/admin-teams.functions";
import { adminReviewSubmission } from "@/lib/rakshak-platform/submissions.functions";
import { MentorResourcesList } from "@/components/rakshak-platform/MentorResourcesList";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import {
  Loader2,
  UsersRound,
  CalendarDays,
  FileText,
  MessageSquare,
  Sparkles,
  BookOpen,
  Check,
  X,
  Plus,
  MapPin,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/teams/$teamId")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["cfi_admin", "super_admin"]);
  },
  component: AdminTeamDetail,
});

type Tab = "overview" | "submissions" | "resources" | "meetings" | "members";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function AdminTeamDetail() {
  const { teamId } = Route.useParams();
  const fetchDetail = useServerFn(getAdminTeamDetail);
  const adminReview = useServerFn(adminReviewSubmission);
  const postRemark = useServerFn(addAdminRemark);
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [remarkOpen, setRemarkOpen] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState("");
  const [remarkBusy, setRemarkBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const res = (await fetchDetail({ data: { team_id: teamId } } as any)) as any;
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, fetchDetail, reloadKey]);

  async function decide(submissionId: string, decision: "approve" | "request_changes") {
    const comment = prompt(
      decision === "approve" ? "Approval comment (optional)" : "What changes are required?",
    );
    if (decision === "request_changes" && !comment?.trim()) return;
    setReviewing(submissionId);
    try {
      await adminReview({
        data: { submission_id: submissionId, decision, comment: comment ?? undefined },
      } as any);
      setReloadKey((k) => k + 1);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setReviewing(null);
    }
  }

  async function submitRemark(submissionId: string, teamIdArg: string, phase: number) {
    const text = remarkText.trim();
    if (!text) return;
    setRemarkBusy(true);
    try {
      await postRemark({
        data: { submission_id: submissionId, team_id: teamIdArg, phase_number: phase, remark: text },
      } as any);
      setRemarkOpen(null);
      setRemarkText("");
      setReloadKey((k) => k + 1);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setRemarkBusy(false);
    }
  }

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

  if (err || !data?.team) {
    return (
      <PlatformShell>
        <Section>
          <p className="text-red-600">{err ?? "Team not found"}</p>
          <Link to="/rakshak-platform/admin/teams" className="text-brand hover:underline text-sm">
            ← Back to teams
          </Link>
        </Section>
      </PlatformShell>
    );
  }

  const t = data.team;
  const mentor = t.rp_mentors?.rp_profiles;
  const leader = t.leader;
  const evaluator = t.evaluator;
  const filesBySubmission = new Map<string, any[]>();
  for (const f of data.files) {
    const arr = filesBySubmission.get(f.submission_id) ?? [];
    arr.push(f);
    filesBySubmission.set(f.submission_id, arr);
  }
  const feedbackBySubmission = new Map<string, any[]>();
  for (const fb of data.feedback) {
    if (!fb.submission_id) continue;
    const arr = feedbackBySubmission.get(fb.submission_id) ?? [];
    arr.push(fb);
    feedbackBySubmission.set(fb.submission_id, arr);
  }
  const evalsByPhase = new Map<number, any[]>();
  for (const e of data.evaluations ?? []) {
    const arr = evalsByPhase.get(e.phase_number) ?? [];
    arr.push(e);
    evalsByPhase.set(e.phase_number, arr);
  }
  const completion = Math.max(0, Math.min(100, Number(t.completion_percentage ?? 0)));


  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: Sparkles },
    { id: "submissions", label: "Submissions & feedback", icon: MessageSquare },
    { id: "resources", label: "Mentor resources", icon: BookOpen },
    { id: "meetings", label: "Meetings", icon: CalendarDays },
    { id: "members", label: "Members", icon: UsersRound },
  ];

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Team</Eyebrow>
        <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold">{t.team_name}</h1>
            <p className="mt-1 text-muted-foreground">
              {t.college}
              {t.city ? ` · ${t.city}` : ""}
              {t.state ? `, ${t.state}` : ""}
            </p>
          </div>
          <Link
            to="/rakshak-platform/admin/teams"
            className="text-sm text-brand hover:underline"
          >
            ← All teams
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                tab === id
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "overview" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold uppercase tracking-wide text-muted-foreground">Overall completion</span>
                  <span className="font-semibold">{completion}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-brand" style={{ width: `${completion}%` }} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card label="Rank" value={t.rank ? `#${t.rank}` : "—"} />
                <Card label="Current phase" value={`Phase ${t.current_phase} — ${PHASE_TITLES[t.current_phase] ?? ""}`} />
                <Card label="Status" value={t.status ?? "—"} />
                <Card label="Risk" value={t.risk_status ?? "—"} />
                <Card label="Final score" value={t.final_score ?? "—"} />
                <Card label="Evaluated phases" value={`${t.evaluated_phases ?? 0} / 5`} />
                <Card label="Team leader" value={leader?.full_name ?? "—"} sub={leader?.email} />
                <Card label="Mentor" value={mentor?.full_name ?? "Unassigned"} sub={mentor?.email} />
                <Card label="Evaluator" value={evaluator?.full_name ?? "Unassigned"} sub={evaluator?.email} />
                <Card label="Members" value={data.members.length} />
                <Card label="College" value={t.college ?? "—"} sub={[t.city, t.state].filter(Boolean).join(", ")} />
                <Card label="Created" value={fmtDate(t.created_at)} />
              </div>
            </div>
          )}


          {tab === "submissions" && (
            <div className="space-y-4">
              {[0, 1, 2, 3, 4].map((p) => {
                const sub = data.submissions.find((s: any) => s.phase_number === p);
                const phaseEvals = evalsByPhase.get(p) ?? [];
                return (
                  <div key={p} className="rounded-2xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <div className="text-xs text-muted-foreground">Phase {p}</div>
                        <div className="font-heading text-lg font-semibold">
                          {sub?.title ?? PHASE_TITLES[p] ?? "—"}
                        </div>
                      </div>
                      <span className="text-xs rounded-full border border-border px-2 py-0.5">
                        {sub?.status ?? "not submitted"}
                      </span>
                    </div>
                    {sub ? (

                      <>
                        {sub.summary && (
                          <p className="mt-3 text-sm whitespace-pre-line">{sub.summary}</p>
                        )}
                        {(filesBySubmission.get(sub.id) ?? []).length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Files
                            </div>
                            <ul className="mt-1 space-y-1 text-sm">
                              {(filesBySubmission.get(sub.id) ?? []).map((f: any) => (
                                <li key={f.id}>
                                  <a
                                    href={f.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-brand hover:underline inline-flex items-center gap-1"
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                    {f.file_name}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(feedbackBySubmission.get(sub.id) ?? []).length > 0 && (
                          <div className="mt-4 border-t border-border pt-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Feedback thread
                            </div>
                            <ul className="mt-2 space-y-2">
                              {(feedbackBySubmission.get(sub.id) ?? []).map((fb: any) => (
                                <li key={fb.id} className="rounded-lg border border-border p-2 text-sm">
                                  <div className="text-[11px] text-muted-foreground">
                                    <span className="font-semibold text-foreground">
                                      {fb.rp_profiles?.full_name ?? "Reviewer"}
                                    </span>{" "}
                                    · {fb.reviewer_role} · {new Date(fb.created_at).toLocaleString()}
                                  </div>
                                  <p className="mt-1 whitespace-pre-line">{fb.feedback_text}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {phaseEvals.length > 0 && (
                          <div className="mt-4 border-t border-border pt-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Evaluator scoring
                            </div>
                            <ul className="mt-2 space-y-2">
                              {phaseEvals.map((e: any) => (
                                <li key={e.id} className="rounded-lg border border-border p-2 text-sm">
                                  <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-muted-foreground">
                                    <span>
                                      <span className="font-semibold text-foreground">{e.evaluator?.full_name ?? "Evaluator"}</span>
                                      {e.evaluator?.email ? ` · ${e.evaluator.email}` : ""}
                                    </span>
                                    <span>
                                      Score: <span className="font-semibold text-foreground">{e.weighted_score ?? e.total_score ?? "—"}</span> · {e.status}
                                    </span>
                                  </div>
                                  {e.comments && (
                                    <p className="mt-1 whitespace-pre-line">{e.comments}</p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(sub.status === "mentor_approved" || sub.status === "resubmitted" || sub.status === "submitted") && (
                          <div className="mt-4 flex gap-2">
                            <button
                              disabled={reviewing === sub.id}
                              onClick={() => decide(sub.id, "approve")}
                              className="text-xs inline-flex items-center gap-1 rounded-full bg-green-600 text-white px-3 py-1 disabled:opacity-50"
                            >
                              <Check className="h-3 w-3" /> Admin approve
                            </button>
                            <button
                              disabled={reviewing === sub.id}
                              onClick={() => decide(sub.id, "request_changes")}
                              className="text-xs inline-flex items-center gap-1 rounded-full bg-red-600 text-white px-3 py-1 disabled:opacity-50"
                            >
                              <X className="h-3 w-3" /> Request changes
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">Not submitted yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "resources" && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <MentorResourcesList mode="admin" teamId={teamId} canDelete />
            </div>
          )}

          {tab === "meetings" && (
            <div className="space-y-3">
              {data.meetings.length === 0 && (
                <p className="text-sm text-muted-foreground">No meetings for this team.</p>
              )}
              {data.meetings.map((m: any) => (
                <div key={m.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="font-semibold">{m.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDate(m.scheduled_start)} — {fmtDate(m.scheduled_end)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs rounded-full border border-border px-2 py-0.5">
                        {m.status}
                      </span>
                      {m.mentor_decision && m.mentor_decision !== "not_required" && (
                        <span
                          className={`text-xs rounded-full px-2 py-0.5 border ${
                            m.mentor_decision === "approved"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : m.mentor_decision === "declined"
                              ? "border-red-300 bg-red-50 text-red-700"
                              : "border-amber-300 bg-amber-50 text-amber-700"
                          }`}
                        >
                          mentor: {m.mentor_decision}
                        </span>
                      )}
                    </div>
                  </div>
                  {m.agenda && (
                    <p className="mt-2 text-sm whitespace-pre-line">{m.agenda}</p>
                  )}
                  {m.meeting_link && (
                    <a
                      href={m.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-xs text-brand hover:underline inline-flex items-center gap-1 break-all"
                    >
                      {m.meeting_link}
                    </a>
                  )}
                  {m.mentor_decision_reason && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Mentor note: {m.mentor_decision_reason}
                    </p>
                  )}
                  {(m.rp_meeting_attendees ?? []).length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Attendees:{" "}
                      {(m.rp_meeting_attendees ?? [])
                        .map((a: any) => `${a.rp_profiles?.full_name ?? "—"} (${a.rsvp ?? "no-rsvp"})`)
                        .join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "members" && (
            <div className="rounded-2xl border border-border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Name</th>
                    <th className="text-left px-4 py-2 font-semibold">Role</th>
                    <th className="text-left px-4 py-2 font-semibold">Email</th>
                    <th className="text-left px-4 py-2 font-semibold">Phone</th>
                    <th className="text-left px-4 py-2 font-semibold">Signed in</th>
                  </tr>
                </thead>
                <tbody>
                  {leader && (
                    <tr className="border-t border-border bg-brand-lite/40">
                      <td className="px-4 py-2 font-semibold">{leader.full_name}</td>
                      <td className="px-4 py-2">Team leader</td>
                      <td className="px-4 py-2">{leader.email ?? "—"}</td>
                      <td className="px-4 py-2">{leader.phone ?? "—"}</td>
                      <td className="px-4 py-2">Yes</td>
                    </tr>
                  )}
                  {data.members.map((m: any) => (
                    <tr key={m.id} className="border-t border-border">
                      <td className="px-4 py-2">{m.full_name}</td>
                      <td className="px-4 py-2">{m.role_in_team ?? "member"}</td>
                      <td className="px-4 py-2">{m.email ?? "—"}</td>
                      <td className="px-4 py-2">{m.phone ?? "—"}</td>
                      <td className="px-4 py-2">{m.profile_id ? "Yes" : "Invited"}</td>
                    </tr>
                  ))}
                  {data.members.length === 0 && !leader && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No members yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>
    </PlatformShell>
  );
}

function Card({ label, value, sub }: { label: string; value: any; sub?: string | null }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value ?? "—"}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
