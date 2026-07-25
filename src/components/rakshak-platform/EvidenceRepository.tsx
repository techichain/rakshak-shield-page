import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  listEvidenceRecords,
  upsertEvidenceRecord,
  deleteEvidenceRecord,
  attachEvidenceFile,
  removeEvidenceFile,
  EVIDENCE_TYPES,
  EVIDENCE_STATUSES,
} from "@/lib/rakshak-platform/evidence.functions";
import { FolderOpen, Plus, Upload, Trash2, Download, FileText, X } from "lucide-react";

export const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  crash_data: "Crash data",
  rti: "RTI request",
  fir: "FIR",
  police_complaint: "Police complaint",
  media_report: "Media report",
  other: "Other document",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Being prepared",
  filed: "Filed",
  acknowledged: "Acknowledged",
  responded: "Reply received",
  closed: "Closed",
};

const MAX_BYTES = 30 * 1024 * 1024;

function emptyForm() {
  return {
    id: undefined as string | undefined,
    record_type: "crash_data" as (typeof EVIDENCE_TYPES)[number],
    title: "",
    reference_no: "",
    filed_on: "",
    authority: "",
    status: "draft" as (typeof EVIDENCE_STATUSES)[number],
    description: "",
    phase_number: "" as string,
  };
}

function prettySize(n?: number | null) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Evidence & records repository for one team.
 * Teams manage their own records; mentors, admins and evaluators pass
 * readOnly so they only see what has been filed.
 */
export function EvidenceRepository({
  teamId,
  readOnly = false,
  heading = "Evidence & records repository",
}: {
  teamId: string;
  readOnly?: boolean;
  heading?: string;
}) {
  const listFn = useServerFn(listEvidenceRecords);
  const saveFn = useServerFn(upsertEvidenceRecord);
  const delFn = useServerFn(deleteEvidenceRecord);
  const attachFn = useServerFn(attachEvidenceFile);
  const rmFileFn = useServerFn(removeEvidenceFile);

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await listFn({ data: { team_id: teamId } } as any)) as any;
      setRecords(res?.records ?? []);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Could not load records");
    } finally {
      setLoading(false);
    }
  }, [listFn, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!form.title.trim()) {
      setErr("Please give this record a title.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await saveFn({
        data: {
          id: form.id,
          team_id: teamId,
          record_type: form.record_type,
          title: form.title,
          reference_no: form.reference_no || null,
          filed_on: form.filed_on || null,
          authority: form.authority || null,
          status: form.status,
          description: form.description || null,
          phase_number: form.phase_number === "" ? null : Number(form.phase_number),
        },
      } as any);
      setForm(emptyForm());
      setShowForm(false);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Could not save this record");
    } finally {
      setSaving(false);
    }
  }

  async function removeRecord(id: string) {
    if (!confirm("Delete this record and all of its files?")) return;
    try {
      await delFn({ data: { id } } as any);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Could not delete");
    }
  }

  async function upload(recordId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingFor(recordId);
    setErr(null);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          setErr(`${file.name} is larger than 30 MB and was skipped.`);
          continue;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        // Leading segment must be the team id — the storage rules key on it.
        const path = `${teamId}/evidence/${recordId}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("rp-submissions")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        await attachFn({
          data: {
            record_id: recordId,
            team_id: teamId,
            file_name: file.name,
            storage_path: path,
            mime_type: file.type || null,
            file_size: file.size,
          },
        } as any);
      }
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
    } finally {
      setUploadingFor(null);
    }
  }

  async function removeFile(fileId: string) {
    if (!confirm("Remove this file?")) return;
    try {
      await rmFileFn({ data: { file_id: fileId } } as any);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Could not remove file");
    }
  }

  async function openFile(storagePath: string) {
    const { data, error } = await supabase.storage
      .from("rp-submissions")
      .createSignedUrl(storagePath, 60 * 60);
    if (error || !data?.signedUrl) {
      setErr("Could not open this file.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const grouped = EVIDENCE_TYPES.map((t) => ({
    type: t,
    rows: records.filter((r) => r.record_type === t),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="rp-card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FolderOpen className="size-4 text-brand" aria-hidden />
          <h2 className="font-semibold">{heading}</h2>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => {
              setForm(emptyForm());
              setShowForm((v) => !v);
            }}
            className="rp-btn-secondary inline-flex items-center gap-1"
          >
            {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showForm ? "Cancel" : "Add a record"}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Everything your team has collected or filed — crash data, RTI requests, FIRs, police
        complaints and media coverage — with the supporting documents for each.
      </p>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      {showForm && !readOnly && (
        <div className="mt-4 rounded-xl border border-border p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">What kind of record is this?</span>
              <select
                value={form.record_type}
                onChange={(e) => setForm({ ...form, record_type: e.target.value as any })}
                className="rp-input w-full mt-1"
              >
                {EVIDENCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EVIDENCE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Where does it stand?</span>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                className="rp-input w-full mt-1"
              >
                {EVIDENCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium">Title</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={400}
              className="rp-input w-full mt-1"
              placeholder="e.g. RTI to Traffic Police on 2025 crash figures"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium">Reference number</span>
              <input
                value={form.reference_no}
                onChange={(e) => setForm({ ...form, reference_no: e.target.value })}
                maxLength={200}
                className="rp-input w-full mt-1"
                placeholder="Optional"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Date filed</span>
              <input
                type="date"
                value={form.filed_on}
                onChange={(e) => setForm({ ...form, filed_on: e.target.value })}
                className="rp-input w-full mt-1"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Phase</span>
              <select
                value={form.phase_number}
                onChange={(e) => setForm({ ...form, phase_number: e.target.value })}
                className="rp-input w-full mt-1"
              >
                <option value="">Not linked to a phase</option>
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n} value={String(n)}>
                    Phase {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium">Authority or office involved</span>
            <input
              value={form.authority}
              onChange={(e) => setForm({ ...form, authority: e.target.value })}
              maxLength={300}
              className="rp-input w-full mt-1"
              placeholder="e.g. District Traffic Police, Gurgaon"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Notes</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={8000}
              className="rp-input w-full min-h-24 mt-1"
              placeholder="What this record contains and why it matters…"
            />
          </label>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rp-btn-primary inline-flex items-center gap-1"
          >
            {saving ? "Saving…" : form.id ? "Save changes" : "Add record"}
          </button>
          <p className="text-xs text-muted-foreground">
            Save the record first, then attach as many files as you need to it.
          </p>
        </div>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading records…</p>
      ) : records.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {readOnly
            ? "This team has not added any records yet."
            : "No records yet. Add your first one above."}
        </p>
      ) : (
        <div className="mt-5 space-y-6">
          {grouped.map((g) => (
            <section key={g.type}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {EVIDENCE_TYPE_LABELS[g.type]} ({g.rows.length})
              </h3>
              <div className="mt-2 space-y-3">
                {g.rows.map((r) => (
                  <article key={r.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-medium">{r.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {[
                            r.reference_no ? `Ref ${r.reference_no}` : null,
                            r.authority,
                            r.filed_on ? `Filed ${r.filed_on}` : null,
                            r.phase_number != null ? `Phase ${r.phase_number}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "No reference details"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full border border-border">
                          {STATUS_LABELS[r.status ?? "draft"] ?? r.status}
                        </span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => removeRecord(r.id)}
                            aria-label={`Delete record ${r.title}`}
                            className="rp-btn-ghost inline-flex items-center gap-1 text-red-600"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {r.description && (
                      <p className="mt-2 text-sm whitespace-pre-line">{r.description}</p>
                    )}

                    <div className="mt-3">
                      <div className="text-xs font-medium text-muted-foreground">
                        Documents ({r.files.length})
                      </div>
                      {r.files.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {r.files.map((f: any) => (
                            <li key={f.id} className="flex items-center gap-2 text-sm flex-wrap">
                              <FileText className="size-4 text-muted-foreground" aria-hidden />
                              <span>{f.file_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {prettySize(f.file_size)}
                              </span>
                              <button
                                type="button"
                                onClick={() => openFile(f.storage_path)}
                                className="rp-btn-ghost inline-flex items-center gap-1 text-xs"
                              >
                                <Download className="size-3" /> Open
                              </button>
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => removeFile(f.id)}
                                  aria-label={`Remove ${f.file_name}`}
                                  className="rp-btn-ghost inline-flex items-center gap-1 text-xs text-red-600"
                                >
                                  <X className="size-3" /> Remove
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {!readOnly && (
                        <label className="mt-2 inline-flex items-center gap-2 text-sm cursor-pointer">
                          <span className="rp-btn-secondary inline-flex items-center gap-1">
                            <Upload className="size-4" />
                            {uploadingFor === r.id ? "Uploading…" : "Add files"}
                          </span>
                          <input
                            type="file"
                            multiple
                            className="sr-only"
                            disabled={uploadingFor === r.id}
                            onChange={(e) => {
                              void upload(r.id, e.target.files);
                              e.target.value = "";
                            }}
                          />
                          <span className="text-xs text-muted-foreground">Up to 30 MB each</span>
                        </label>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
