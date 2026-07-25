import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  getTeamAuthorityEngagement,
  setImplementationStatus,
  addAuthorityUpdate,
  deleteAuthorityUpdate,
} from "@/lib/rakshak-platform/authority.functions";
import { Landmark, Upload, Trash2, ExternalLink, Plus } from "lucide-react";

const IMPL_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "Work in progress",
  completed: "Completed",
  rejected: "Rejected by authority",
};

const MAX_BYTES = 30 * 1024 * 1024;

/**
 * Authority engagement tracking for one team: per report, the implementation
 * status, notes, approval letter and a dated update timeline.
 * Mentors, admins and evaluators pass readOnly.
 */
export function AuthorityEngagement({
  teamId,
  readOnly = false,
  heading = "Authority engagement",
}: {
  teamId: string;
  readOnly?: boolean;
  heading?: string;
}) {
  const listFn = useServerFn(getTeamAuthorityEngagement);
  const statusFn = useServerFn(setImplementationStatus);
  const addFn = useServerFn(addAuthorityUpdate);
  const delFn = useServerFn(deleteAuthorityUpdate);

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { text: string; status: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await listFn({ data: { team_id: teamId } } as any)) as any;
      setReports(res?.reports ?? []);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Could not load authority engagement");
    } finally {
      setLoading(false);
    }
  }, [listFn, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveStatus(reportId: string, patch: Record<string, any>) {
    setBusy(reportId);
    setErr(null);
    try {
      await statusFn({ data: { report_id: reportId, ...patch } } as any);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Could not save");
    } finally {
      setBusy(null);
    }
  }

  async function uploadFile(file: File, kind: "letter" | "update") {
    if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 30 MB.`);
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    // Leading segment must be the team id — the storage rules key on it.
    const path = `${teamId}/authority/${kind}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage
      .from("rp-submissions")
      .upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  }

  async function uploadLetter(reportId: string, files: FileList | null) {
    if (!files?.[0]) return;
    setBusy(reportId);
    setErr(null);
    try {
      const path = await uploadFile(files[0], "letter");
      await statusFn({ data: { report_id: reportId, approval_letter_url: path } } as any);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function postUpdate(reportId: string, files: FileList | null) {
    const d = drafts[reportId];
    if (!d?.text?.trim()) {
      setErr("Write an update before posting it.");
      return;
    }
    setBusy(reportId);
    setErr(null);
    try {
      let filePath: string | null = null;
      if (files?.[0]) filePath = await uploadFile(files[0], "update");
      await addFn({
        data: {
          report_id: reportId,
          update_text: d.text,
          status: d.status || null,
          file_path: filePath,
        },
      } as any);
      setDrafts((s) => ({ ...s, [reportId]: { text: "", status: "" } }));
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Could not post update");
    } finally {
      setBusy(null);
    }
  }

  async function removeUpdate(id: string) {
    if (!confirm("Delete this update?")) return;
    try {
      await delFn({ data: { id } } as any);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Could not delete");
    }
  }

  async function open(path: string) {
    const { data, error } = await supabase.storage
      .from("rp-submissions")
      .createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) {
      setErr("Could not open this file.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rp-card p-5">
      <div className="flex items-center gap-2">
        <Landmark className="size-4 text-brand" aria-hidden />
        <h2 className="font-semibold">{heading}</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        For each letter your team has sent to an authority: where the fix stands on the ground, the
        approval letter if one came back, and a dated record of everything that happened since.
      </p>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {readOnly
            ? "This team has not written to any authority yet."
            : "No authority letters yet. Create one under Authority reports, then track it here."}
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {reports.map((r) => {
            const draft = drafts[r.id] ?? { text: "", status: "" };
            return (
              <article key={r.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium">{r.subject}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {[
                        r.authority_name,
                        r.sent_at ? `Sent ${new Date(r.sent_at).toLocaleDateString("en-IN")}` : null,
                        r.response_status ? `Reply: ${r.response_status}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full border border-border">
                    {IMPL_LABELS[r.implementation_status ?? ""] ?? "Status not set"}
                  </span>
                </div>

                {!readOnly ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium">Where does the fix stand?</span>
                      <select
                        value={r.implementation_status ?? ""}
                        disabled={busy === r.id}
                        onChange={(e) =>
                          void saveStatus(r.id, {
                            implementation_status: e.target.value || null,
                          })
                        }
                        className="rp-input w-full mt-1"
                      >
                        <option value="">Not set</option>
                        {Object.entries(IMPL_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium">Approval letter</span>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        {r.approval_letter_url && (
                          <button
                            type="button"
                            onClick={() => open(r.approval_letter_url)}
                            className="inline-flex items-center gap-1 text-xs underline text-brand"
                          >
                            <ExternalLink className="size-3" /> View
                          </button>
                        )}
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <span className="rp-btn-secondary inline-flex items-center gap-1">
                            <Upload className="size-4" />
                            {r.approval_letter_url ? "Replace" : "Upload"}
                          </span>
                          <input
                            type="file"
                            className="sr-only"
                            disabled={busy === r.id}
                            onChange={(e) => {
                              void uploadLetter(r.id, e.target.files);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-sm font-medium">Implementation notes</span>
                      <textarea
                        defaultValue={r.implementation_notes ?? ""}
                        maxLength={8000}
                        onBlur={(e) =>
                          void saveStatus(r.id, { implementation_notes: e.target.value })
                        }
                        className="rp-input w-full min-h-20 mt-1"
                        placeholder="What has actually changed on the ground…"
                      />
                    </label>
                  </div>
                ) : (
                  <>
                    {r.implementation_notes && (
                      <p className="mt-2 text-sm whitespace-pre-line">{r.implementation_notes}</p>
                    )}
                    {r.approval_letter_url && (
                      <button
                        type="button"
                        onClick={() => open(r.approval_letter_url)}
                        className="mt-2 inline-flex items-center gap-1 text-xs underline text-brand"
                      >
                        <ExternalLink className="size-3" /> Approval letter
                      </button>
                    )}
                  </>
                )}

                <div className="mt-4">
                  <div className="text-xs font-medium text-muted-foreground">
                    Updates ({r.updates.length})
                  </div>
                  {r.updates.length > 0 && (
                    <ol className="mt-2 space-y-2 border-l border-border pl-4">
                      {r.updates.map((u: any) => (
                        <li key={u.id} className="text-sm">
                          <div className="text-xs text-muted-foreground">
                            {new Date(u.created_at).toLocaleString("en-IN")}
                            {u.status ? ` · ${u.status}` : ""}
                          </div>
                          <p className="whitespace-pre-line">{u.update_text}</p>
                          <div className="flex items-center gap-3">
                            {u.file_path && (
                              <button
                                type="button"
                                onClick={() => open(u.file_path)}
                                className="inline-flex items-center gap-1 text-xs underline text-brand"
                              >
                                <ExternalLink className="size-3" /> Attachment
                              </button>
                            )}
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => removeUpdate(u.id)}
                                className="inline-flex items-center gap-1 text-xs underline text-red-600"
                              >
                                <Trash2 className="size-3" /> Delete
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}

                  {!readOnly && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={draft.text}
                        onChange={(e) =>
                          setDrafts((s) => ({ ...s, [r.id]: { ...draft, text: e.target.value } }))
                        }
                        maxLength={8000}
                        className="rp-input w-full min-h-20"
                        placeholder="Add an update — a call, a site visit, a reply received…"
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          value={draft.status}
                          onChange={(e) =>
                            setDrafts((s) => ({
                              ...s,
                              [r.id]: { ...draft, status: e.target.value },
                            }))
                          }
                          maxLength={80}
                          className="rp-input"
                          placeholder="Short label (optional)"
                        />
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <span className="rp-btn-secondary inline-flex items-center gap-1">
                            <Plus className="size-4" /> Post with a file
                          </span>
                          <input
                            type="file"
                            className="sr-only"
                            disabled={busy === r.id}
                            onChange={(e) => {
                              void postUpdate(r.id, e.target.files);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={busy === r.id}
                          onClick={() => void postUpdate(r.id, null)}
                          className="rp-btn-primary inline-flex items-center gap-1"
                        >
                          {busy === r.id ? "Saving…" : "Post update"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
