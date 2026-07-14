import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import {
  getSubmissionDetail,
  upsertSubmission,
  submitForReview,
  attachSubmissionFile,
  removeSubmissionFile,
} from "@/lib/rakshak-platform/submissions.functions";
import {
  listQuestionnairesForTeam,
  submitQuestionnaireResponse,
} from "@/lib/rakshak-platform/questionnaires.functions";
import { PHASE_TITLES, STATUS_META, type PhaseStatus } from "@/lib/rakshak-platform/constants";
import { ArrowLeft, Upload, Save, Send, X, FileText, MessageSquare, ClipboardList } from "lucide-react";
import { SubmissionTimeline } from "@/components/rakshak-platform/SubmissionTimeline";
import { rpRequireRole } from "@/lib/rakshak-platform/auth";
import { useRPAuth } from "@/lib/rakshak-platform/auth";

const SearchSchema = z.object({ team: z.string().uuid() });

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

  const detailFn = useServerFn(getSubmissionDetail);
  const saveFn = useServerFn(upsertSubmission);
  const submitFn = useServerFn(submitForReview);
  const attachFn = useServerFn(attachSubmissionFile);
  const removeFn = useServerFn(removeSubmissionFile);
  const qListFn = useServerFn(listQuestionnairesForTeam);
  const qSubmitFn = useServerFn(submitQuestionnaireResponse);
  const { userId } = useRPAuth();

  const { data } = useSuspenseQuery({
    queryKey: ["rp-submission", team, phaseNum],
    queryFn: () => detailFn({ data: { team_id: team, phase_number: phaseNum } }),
  });

  const qQuery = useQuery({
    queryKey: ["rp-questionnaires", team, phaseNum],
    queryFn: () => qListFn({ data: { team_id: team, phase_number: phaseNum } }),
  });
  const teamQuestionnaires = (qQuery.data as any)?.questionnaires ?? [];

  const [title, setTitle] = useState(data.submission?.title ?? "");
  const [summary, setSummary] = useState(data.submission?.summary ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
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

  const status = (data.submission?.status ?? data.progress?.status ?? "not_started") as PhaseStatus;
  const meta = STATUS_META[status];
  const editable =
    !data.submission ||
    status === "draft" ||
    status === "changes_requested" ||
    status === "rejected";

  async function save() {
    if (!title.trim()) { setErr("Title required"); return; }
    setBusy(true); setErr(null); setMsg(null);
    try {
      await saveFn({ data: { team_id: team, phase_number: phaseNum, title, summary } });
      qc.invalidateQueries({ queryKey: ["rp-submission", team, phaseNum] });
      setMsg("Saved");
    } catch (e: any) { setErr(e?.message ?? "Could not save"); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!data.submission) { setErr("Save a draft first."); return; }
    if (!confirm("Submit this phase for mentor review? You will not be able to edit until they reply.")) return;
    setBusy(true); setErr(null);
    try {
      await submitFn({ data: { submission_id: data.submission.id } });
      qc.invalidateQueries({ queryKey: ["rp-submission", team, phaseNum] });
      qc.invalidateQueries({ queryKey: ["rp-team-phases", team] });
      setMsg("Submitted for review!");
    } catch (e: any) { setErr(e?.message ?? "Could not submit"); }
    finally { setBusy(false); }
  }

  async function uploadFile(file: File) {
    if (!data.submission) { setErr("Save a draft first to upload files."); return; }
    if (file.size > 30 * 1024 * 1024) { setErr("Max 30 MB."); return; }
    setUploading(true); setErr(null);
    try {
      const path = `${team}/${data.submission.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("rp-submissions").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("rp-submissions").createSignedUrl(path, 60 * 60 * 24 * 7);
      await attachFn({
        data: {
          submission_id: data.submission.id,
          file_name: file.name,
          file_type: file.type,
          file_url: signed?.signedUrl ?? path,
          storage_path: path,
          file_size: file.size,
          caption: caption || undefined,
        },
      });
      setCaption("");
      qc.invalidateQueries({ queryKey: ["rp-submission", team, phaseNum] });
    } catch (e: any) { setErr(e?.message ?? "Upload failed"); }
    finally { setUploading(false); }
  }

  async function removeFile(id: string) {
    if (!confirm("Remove this file?")) return;
    await removeFn({ data: { file_id: id } });
    qc.invalidateQueries({ queryKey: ["rp-submission", team, phaseNum] });
  }

  return (
    <PlatformShell>
      <Section>
        <button onClick={() => navigate({ to: "/rakshak-platform/team/phases" })} className="text-sm text-muted-foreground hover:text-brand mb-4 inline-flex items-center gap-1">
          <ArrowLeft className="size-4" /> Back to board
        </button>
        <Eyebrow>Phase {phaseNum}</Eyebrow>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-3xl font-extrabold">{PHASE_TITLES[phaseNum]}</h1>
          <span className={`text-xs px-3 py-1 rounded-full border ${meta.tone}`}>{meta.label}</span>
        </div>

        {err && <p className="mt-4 text-red-600 text-sm">{err}</p>}
        {msg && <p className="mt-4 text-emerald-700 text-sm">{msg}</p>}

        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rp-card p-5">
              <label className="block">
                <span className="text-sm font-medium">Title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!editable} maxLength={400} className="rp-input w-full mt-1" placeholder="Give your submission a clear title" />
              </label>
              <label className="block mt-4">
                <span className="text-sm font-medium">Summary / Body</span>
                <textarea value={summary} onChange={(e) => setSummary(e.target.value)} disabled={!editable} maxLength={8000} className="rp-input w-full min-h-56 mt-1" placeholder="Describe what you did this phase. Evidence, findings, next steps…" />
              </label>
              {editable && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={save} disabled={busy} className="rp-btn-secondary inline-flex items-center gap-1">
                    <Save className="size-4" /> Save draft
                  </button>
                  <button onClick={submit} disabled={busy || !data.submission} className="rp-btn-primary inline-flex items-center gap-1">
                    <Send className="size-4" /> Submit for review
                  </button>
                </div>
              )}
            </div>

            <div className="rp-card p-5">
              <h3 className="font-semibold mb-3">Evidence files</h3>
              {data.submission ? (
                <div className="space-y-3">
                  {editable && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Optional caption for next upload" className="rp-input flex-1" maxLength={500} />
                      <label className="rp-btn-secondary inline-flex items-center gap-1 cursor-pointer">
                        <Upload className="size-4" /> {uploading ? "Uploading…" : "Upload file"}
                        <input type="file" hidden disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.currentTarget.value = ""; }} />
                      </label>
                    </div>
                  )}
                  {data.files.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No files yet.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {data.files.map((f: any) => (
                        <li key={f.id} className="py-2 flex items-center gap-2">
                          <FileText className="size-4 text-muted-foreground" />
                          <a href={f.file_url} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline truncate flex-1">{f.file_name}</a>
                          {f.caption && <span className="text-xs text-muted-foreground truncate max-w-[40%]">{f.caption}</span>}
                          {editable && (
                            <button onClick={() => removeFile(f.id)} className="text-muted-foreground hover:text-red-600">
                              <X className="size-4" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Save a draft first to attach evidence files.</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rp-card p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-3"><MessageSquare className="size-4" /> Mentor & evaluator feedback</h3>
              {data.feedback.length === 0 ? (
                <p className="text-sm text-muted-foreground">No feedback yet.</p>
              ) : (
                <ul className="space-y-3">
                  {data.feedback.map((fb: any) => (
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

            {data.submission?.id && (
              <SubmissionTimeline submissionId={data.submission.id} />
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
