import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  upsertSubmission,
  submitForReview,
  attachSubmissionFile,
  removeSubmissionFile,
} from "@/lib/rakshak-platform/submissions.functions";
import { STATUS_META, type PhaseStatus } from "@/lib/rakshak-platform/constants";
import { SubmissionTimeline } from "@/components/rakshak-platform/SubmissionTimeline";
import {
  Upload, Save, Send, X, FileText, ClipboardList, FileCheck2, BadgeCheck, History,
} from "lucide-react";

export type SlotKey = "draft_questionnaire" | "draft_report" | "final";

export type SubmissionSlot = {
  key: SlotKey;
  document_type: "questionnaire" | "report";
  is_final: boolean;
  submission: any | null;
  files: any[];
  feedback: any[];
};

const SLOT_META: Record<
  SlotKey,
  { label: string; hint: string; icon: typeof FileText; cta: string }
> = {
  draft_questionnaire: {
    label: "Draft questionnaire",
    hint: "Your working questionnaire for this phase. Saves as a draft — not sent for review.",
    icon: ClipboardList,
    cta: "Save draft questionnaire",
  },
  draft_report: {
    label: "Draft report",
    hint: "Your working report for this phase. Saves as a draft — not sent for review.",
    icon: FileText,
    cta: "Save draft report",
  },
  final: {
    label: "Final submission",
    hint: "The version your mentor reviews. Submit only when the phase is complete.",
    icon: FileCheck2,
    cta: "Save final draft",
  },
};

function statusOf(sub: any | null): PhaseStatus {
  return (sub?.status ?? "not_started") as PhaseStatus;
}

export function PhaseSubmissionSlot({
  slot,
  teamId,
  phaseNumber,
  queryKey,
}: {
  slot: SubmissionSlot;
  teamId: string;
  phaseNumber: number;
  queryKey: unknown[];
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(upsertSubmission);
  const submitFn = useServerFn(submitForReview);
  const attachFn = useServerFn(attachSubmissionFile);
  const removeFn = useServerFn(removeSubmissionFile);

  const meta = SLOT_META[slot.key];
  const Icon = meta.icon;
  const sub = slot.submission;
  const status = statusOf(sub);
  const statusMeta = STATUS_META[status];

  const [title, setTitle] = useState(sub?.title ?? "");
  const [summary, setSummary] = useState(sub?.summary ?? "");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);

  // Keep fields in sync when the server data refreshes.
  useEffect(() => {
    setTitle(sub?.title ?? "");
    setSummary(sub?.summary ?? "");
  }, [sub?.id, sub?.title, sub?.summary]);

  const editable =
    !sub || status === "draft" || status === "changes_requested" || status === "rejected";

  const refresh = () => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["rp-team-phases", teamId] });
  };

  async function save() {
    if (!title.trim()) { setErr("Title required"); return; }
    setBusy(true); setErr(null); setMsg(null);
    try {
      await saveFn({
        data: {
          team_id: teamId,
          phase_number: phaseNumber,
          title,
          summary,
          document_type: slot.document_type,
          is_final: slot.is_final,
        },
      });
      refresh();
      setMsg("Saved");
    } catch (e: any) { setErr(e?.message ?? "Could not save"); }
    finally { setBusy(false); }
  }

  async function submitFinal() {
    if (!sub) { setErr("Save the final draft first."); return; }
    if (!confirm("Submit this as your FINAL submission for mentor review? You will not be able to edit until they reply.")) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      await submitFn({ data: { submission_id: sub.id, is_final: true } });
      refresh();
      setMsg("Submitted as final!");
    } catch (e: any) { setErr(e?.message ?? "Could not submit"); }
    finally { setBusy(false); }
  }

  async function uploadFile(file: File) {
    if (!sub) { setErr("Save this slot first to upload files."); return; }
    if (file.size > 30 * 1024 * 1024) { setErr("Max 30 MB."); return; }
    setUploading(true); setErr(null);
    try {
      const path = `${teamId}/${sub.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("rp-submissions").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("rp-submissions").createSignedUrl(path, 60 * 60);
      await attachFn({
        data: {
          submission_id: sub.id,
          file_name: file.name,
          file_type: file.type,
          file_url: signed?.signedUrl ?? path,
          storage_path: path,
          file_size: file.size,
          caption: caption || undefined,
        },
      });
      setCaption("");
      refresh();
    } catch (e: any) { setErr(e?.message ?? "Upload failed"); }
    finally { setUploading(false); }
  }

  async function removeFile(id: string) {
    if (!confirm("Remove this file?")) return;
    await removeFn({ data: { file_id: id } });
    refresh();
  }

  return (
    <div className={`rp-card p-5 ${slot.is_final ? "border-brand/50" : ""}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-brand" />
          <h3 className="font-semibold">{meta.label}</h3>
          {slot.is_final && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-brand-lite text-brand border border-brand/25 font-semibold">
              <BadgeCheck className="size-3" /> Final
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {sub && (
            <span className="text-[11px] text-muted-foreground">rev {sub.revision_number ?? 1}</span>
          )}
          <span className={`text-xs px-3 py-1 rounded-full border ${statusMeta.tone}`}>
            {sub ? statusMeta.label : "Not started"}
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{meta.hint}</p>

      {err && <p className="mt-3 text-red-600 text-sm">{err}</p>}
      {msg && <p className="mt-3 text-emerald-700 text-sm">{msg}</p>}

      <label className="block mt-4">
        <span className="text-sm font-medium">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={!editable}
          maxLength={400}
          className="rp-input w-full mt-1"
          placeholder={`Title for your ${meta.label.toLowerCase()}`}
        />
      </label>
      <label className="block mt-3">
        <span className="text-sm font-medium">Summary / Body</span>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          disabled={!editable}
          maxLength={8000}
          className="rp-input w-full min-h-40 mt-1"
          placeholder="Describe what this document covers…"
        />
      </label>

      {editable && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={save} disabled={busy} className="rp-btn-secondary inline-flex items-center gap-1">
            <Save className="size-4" /> {meta.cta}
          </button>
          {slot.is_final && (
            <button
              onClick={submitFinal}
              disabled={busy || !sub}
              className="rp-btn-primary inline-flex items-center gap-1"
            >
              <Send className="size-4" /> Submit as final
            </button>
          )}
        </div>
      )}

      {/* Files */}
      <div className="mt-5 border-t border-border pt-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Files</div>
        {sub ? (
          <div className="mt-2 space-y-3">
            {editable && (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Optional caption for next upload"
                  className="rp-input flex-1"
                  maxLength={500}
                />
                <label className="rp-btn-secondary inline-flex items-center gap-1 cursor-pointer">
                  <Upload className="size-4" /> {uploading ? "Uploading…" : "Upload file"}
                  <input
                    type="file"
                    hidden
                    disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.currentTarget.value = ""; }}
                  />
                </label>
              </div>
            )}
            {slot.files.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {slot.files.map((f: any) => (
                  <li key={f.id} className="py-2 flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    <a href={f.file_url} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline truncate flex-1">{f.file_name}</a>
                    {f.caption && <span className="text-xs text-muted-foreground truncate max-w-[40%]">{f.caption}</span>}
                    {editable && (
                      <button onClick={() => removeFile(f.id)} className="text-muted-foreground hover:text-red-600" aria-label={`Remove ${f.file_name}`}>
                        <X className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Save this slot first to attach files.</p>
        )}
      </div>

      {/* Revision history */}
      {sub && (
        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowTimeline((v) => !v)}
            aria-expanded={showTimeline}
            className="text-xs text-brand inline-flex items-center gap-1 hover:underline"
          >
            <History className="size-3.5" />
            {showTimeline ? "Hide revision history" : `Revision history (rev ${sub.revision_number ?? 1})`}
          </button>
          {showTimeline && (
            <div className="mt-3">
              <SubmissionTimeline submissionId={sub.id} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
