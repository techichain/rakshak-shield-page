import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  listTeamUpdates,
  upsertTeamUpdate,
  deleteTeamUpdate,
  TEAM_UPDATE_TYPES,
} from "@/lib/rakshak-platform/team-updates.functions";
import { CalendarDays, Plus, Trash2, Download, X } from "lucide-react";

export const TEAM_UPDATE_LABELS: Record<string, string> = {
  exam_schedule: "Exam schedule",
  availability: "Availability",
  note: "Note",
  other: "Other",
};

const MAX_BYTES = 30 * 1024 * 1024;

function emptyForm() {
  return {
    update_type: "exam_schedule" as (typeof TEAM_UPDATE_TYPES)[number],
    title: "",
    details: "",
    start_date: "",
    end_date: "",
  };
}

function fmtDate(d?: string | null) {
  if (!d) return "";
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

/**
 * "Share with us" — a team posts exam schedules, availability windows and
 * other notes. Mentors, admins and evaluators pass readOnly to just read them.
 */
export function TeamUpdates({
  teamId,
  readOnly = false,
  heading = "Share with us",
}: {
  teamId: string;
  readOnly?: boolean;
  heading?: string;
}) {
  const listFn = useServerFn(listTeamUpdates);
  const saveFn = useServerFn(upsertTeamUpdate);
  const delFn = useServerFn(deleteTeamUpdate);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await listFn({ data: { team_id: teamId } } as any)) as any;
      setRows(res?.updates ?? []);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Could not load updates");
    } finally {
      setLoading(false);
    }
  }, [listFn, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!form.title.trim()) {
      setErr("Please give this update a title.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      let filePath: string | null = null;
      if (file) {
        if (file.size > MAX_BYTES) {
          throw new Error(`${file.name} is larger than 30 MB.`);
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        // Leading segment must be the team id — the storage rules key on it.
        const path = `${teamId}/updates/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("rp-submissions")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        filePath = path;
      }

      await saveFn({
        data: {
          team_id: teamId,
          update_type: form.update_type,
          title: form.title,
          details: form.details || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          file_path: filePath,
        },
      } as any);
      setForm(emptyForm());
      setFile(null);
      setShowForm(false);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Could not save this update");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this update?")) return;
    try {
      await delFn({ data: { id } } as any);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Could not delete");
    }
  }

  async function openFile(path: string) {
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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-brand" aria-hidden />
          <h2 className="font-semibold">{heading}</h2>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => {
              setForm(emptyForm());
              setFile(null);
              setShowForm((v) => !v);
            }}
            className="rp-btn-secondary inline-flex items-center gap-1"
          >
            {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showForm ? "Cancel" : "Add update"}
          </button>
        )}
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        Exam weeks, travel, availability and anything else the programme team should know about.
      </p>

      {err && <div className="mt-3 text-sm text-red-600">{err}</div>}

      {showForm && !readOnly && (
        <div className="mt-4 space-y-3 rounded-xl border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Type</span>
              <select
                className="rp-input w-full"
                value={form.update_type}
                onChange={(e) =>
                  setForm({ ...form, update_type: e.target.value as any })
                }
              >
                {TEAM_UPDATE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TEAM_UPDATE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Title</span>
              <input
                className="rp-input w-full"
                maxLength={400}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="End-semester exams"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Starts (optional)</span>
              <input
                type="date"
                className="rp-input w-full"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Ends (optional)</span>
              <input
                type="date"
                className="rp-input w-full"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Details (optional)</span>
            <textarea
              rows={3}
              maxLength={8000}
              className="rp-input w-full"
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              placeholder="Anything the mentor or programme team should plan around."
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              Attach a file (optional, max 30 MB)
            </span>
            <input
              type="file"
              className="block w-full text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rp-btn-primary disabled:opacity-60"
          >
            {saving ? "Saving…" : "Share update"}
          </button>
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {readOnly
              ? "This team has not shared anything yet."
              : "Nothing shared yet. Add your exam schedule so we can plan deadlines around it."}
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((u) => (
              <li key={u.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {TEAM_UPDATE_LABELS[u.update_type] ?? u.update_type}
                    </div>
                    <div className="font-medium">{u.title}</div>
                    {(u.start_date || u.end_date) && (
                      <div className="text-xs text-muted-foreground">
                        {fmtDate(u.start_date)}
                        {u.end_date ? ` → ${fmtDate(u.end_date)}` : ""}
                      </div>
                    )}
                    {u.details && (
                      <p className="mt-1 whitespace-pre-wrap text-sm">{u.details}</p>
                    )}
                    {u.file_path && (
                      <button
                        type="button"
                        onClick={() => void openFile(u.file_path)}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-brand hover:underline"
                      >
                        <Download className="size-3.5" /> Open attachment
                      </button>
                    )}
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => void remove(u.id)}
                      aria-label="Delete update"
                      className="rounded-full border border-border p-1.5 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
