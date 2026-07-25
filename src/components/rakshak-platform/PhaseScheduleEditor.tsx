import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CalendarClock, CheckCircle2 } from "lucide-react";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import {
  getCohortPhaseSchedule,
  saveCohortPhaseSchedule,
} from "@/lib/rakshak-platform/phase-schedule.functions";

type Row = { phase_number: number; starts_on: string | null; deadline: string | null };

/** timestamptz -> value for <input type="datetime-local"> (local time) */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PhaseScheduleEditor({ cohortId }: { cohortId: string }) {
  const load = useServerFn(getCohortPhaseSchedule);
  const save = useServerFn(saveCohortPhaseSchedule);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!cohortId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setMsg(null);
    setErr(null);
    load({ data: { cohort_id: cohortId } } as any)
      .then((res: any) => {
        setRows(
          (res?.rows ?? []).map((r: any) => ({
            phase_number: r.phase_number,
            starts_on: r.starts_on ?? "",
            deadline: toLocalInput(r.deadline),
          })),
        );
      })
      .catch((e: any) => setErr(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [cohortId, load]);

  const update = (phase: number, key: "starts_on" | "deadline", value: string) => {
    setRows((prev) => prev.map((r) => (r.phase_number === phase ? { ...r, [key]: value } : r)));
  };

  const onSave = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res: any = await save({
        data: {
          cohort_id: cohortId,
          rows: rows.map((r) => ({
            phase_number: r.phase_number,
            starts_on: r.starts_on || null,
            deadline: r.deadline || null,
          })),
        },
      } as any);
      setMsg(`Saved. ${res?.teams_updated ?? 0} team(s) in this cohort now use these deadlines.`);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  if (!cohortId) {
    return <p className="text-sm text-muted-foreground">Select a cohort to set its phase dates.</p>;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-brand" />
        <h2 className="font-heading text-lg font-semibold">Phase schedule</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Set when each phase starts and when it is due. Saving updates the deadline shown to every
        team in this cohort.
      </p>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading schedule…
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {rows.map((r) => (
            <div key={r.phase_number} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div className="text-sm font-medium">
                Phase {r.phase_number} · {PHASE_TITLES[r.phase_number]}
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Start date
                </span>
                <input
                  type="date"
                  value={r.starts_on ?? ""}
                  onChange={(e) => update(r.phase_number, "starts_on", e.target.value)}
                  className="mt-1 h-11 w-full sm:w-48 rounded-md border border-border bg-background px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Deadline
                </span>
                <input
                  type="datetime-local"
                  value={r.deadline ?? ""}
                  onChange={(e) => update(r.phase_number, "deadline", e.target.value)}
                  className="mt-1 h-11 w-full sm:w-60 rounded-md border border-border bg-background px-3 text-sm"
                />
              </label>
            </div>
          ))}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onSave}
              disabled={busy}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-brand text-brand-foreground text-sm font-medium disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save schedule
            </button>
            {msg && (
              <span className="text-sm text-emerald-700 inline-flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> {msg}
              </span>
            )}
            {err && <span className="text-sm text-red-600">{err}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
