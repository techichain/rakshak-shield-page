import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import Papa from "papaparse";
import {
  BULK_COLUMNS,
  BULK_REQUIRED_COLUMNS,
  TEAM_LEVEL_COLUMNS,
  type BulkKind,
} from "./bulk-onboarding.constants";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type BulkValidationError = { row: number; message: string };

export type BulkPreviewRow = {
  row: number;
  action: "create" | "skip";
  team_name?: string;
  cohort_name?: string;
  college?: string;
  city?: string;
  state?: string;
  role?: string;
  full_name: string;
  email: string;
  phone?: string;
};

export type BulkValidationResult = {
  import_id: string | null;
  kind: BulkKind;
  rows_total: number;
  will_create: number;
  will_skip: number;
  errors: BulkValidationError[];
  preview: BulkPreviewRow[];
  ok: boolean;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("rp_is_admin", { _user_id: userId });
  if (!data) throw new Error("Admin only");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const KIND_ENUM = z.enum(["teams", "mentors", "evaluators"]);

const validateSchema = z.object({
  kind: KIND_ENUM,
  csv_text: z.string().min(1, "CSV is empty").max(2_000_000, "CSV is too large"),
});

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

/* ------------------------------------------------------------------ */
/* parseAndValidateBulkCsv — pure validation, no writes to app tables  */
/* ------------------------------------------------------------------ */

export const parseAndValidateBulkCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => validateSchema.parse(d))
  .handler(async ({ data, context }): Promise<BulkValidationResult> => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const kind = data.kind as BulkKind;
    const errors: BulkValidationError[] = [];

    // Log the attempt (no passwords, no row payloads with credentials).
    let importId: string | null = null;
    const { data: importRow } = await supabase
      .from("rp_bulk_imports")
      .insert({ kind, uploaded_by: userId, status: "validating" })
      .select("id")
      .maybeSingle();
    importId = importRow?.id ?? null;

    const fail = async (message: string): Promise<BulkValidationResult> => {
      const result: BulkValidationResult = {
        import_id: importId,
        kind,
        rows_total: 0,
        will_create: 0,
        will_skip: 0,
        errors: [{ row: 0, message }],
        preview: [],
        ok: false,
      };
      if (importId) {
        await supabase
          .from("rp_bulk_imports")
          .update({
            status: "failed",
            rows_total: 0,
            rows_failed: 1,
            errors_json: result.errors,
            completed_at: new Date().toISOString(),
          })
          .eq("id", importId);
      }
      return result;
    };

    /* ---- parse ---- */
    const parsed = Papa.parse<Record<string, string>>(data.csv_text.trim(), {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    if (parsed.errors.length > 0) {
      const first = parsed.errors[0];
      return fail(`Could not read the CSV: ${first.message}`);
    }

    const headers = (parsed.meta.fields ?? []).map((h) => h.trim().toLowerCase());
    const missing = BULK_COLUMNS[kind].filter((c) => !headers.includes(c));
    if (missing.length > 0) {
      return fail(`Missing required column(s): ${missing.join(", ")}. Use the template.`);
    }

    const raw = parsed.data ?? [];
    if (raw.length === 0) return fail("The file has headers but no data rows.");

    type Norm = BulkPreviewRow & { emailLower: string };
    const rows: Norm[] = raw.map((r, i) => {
      const rowNo = i + 2; // header is line 1
      const base: Norm = {
        row: rowNo,
        action: "create",
        full_name: clean(r.full_name),
        email: clean(r.email),
        emailLower: clean(r.email).toLowerCase(),
        phone: clean(r.phone) || undefined,
      };
      if (kind === "teams") {
        base.team_name = clean(r.team_name);
        base.cohort_name = clean(r.cohort_name);
        base.college = clean(r.college) || undefined;
        base.city = clean(r.city) || undefined;
        base.state = clean(r.state) || undefined;
        base.role = clean(r.role).toLowerCase();
      }
      return base;
    });

    /* ---- required fields + email format ---- */
    for (const r of rows) {
      for (const col of BULK_REQUIRED_COLUMNS[kind]) {
        const value = (r as any)[col];
        if (!value) errors.push({ row: r.row, message: `"${col}" is required.` });
      }
      if (r.email && !EMAIL_RE.test(r.email)) {
        errors.push({ row: r.row, message: `"${r.email}" is not a valid email address.` });
      }
      if (kind === "teams" && r.role && r.role !== "leader" && r.role !== "member") {
        errors.push({ row: r.row, message: `role must be "leader" or "member" (got "${r.role}").` });
      }
    }

    /* ---- in-file duplicate emails ---- */
    const byEmail = new Map<string, number[]>();
    for (const r of rows) {
      if (!r.emailLower) continue;
      const list = byEmail.get(r.emailLower) ?? [];
      list.push(r.row);
      byEmail.set(r.emailLower, list);
    }
    for (const [email, rowNos] of byEmail) {
      if (rowNos.length > 1) {
        errors.push({
          row: rowNos[0],
          message: `Duplicate email "${email}" appears on rows ${rowNos.join(", ")}.`,
        });
      }
    }

    /* ---- teams-specific rules ---- */
    if (kind === "teams") {
      const teams = new Map<string, Norm[]>();
      for (const r of rows) {
        if (!r.team_name) continue;
        const key = r.team_name.toLowerCase();
        teams.set(key, [...(teams.get(key) ?? []), r]);
      }

      // cohort names must exist (case-insensitive)
      const { data: cohorts } = await supabase.from("rp_cohorts").select("id, name");
      const cohortNames = new Set(
        (cohorts ?? []).map((c: any) => String(c.name).trim().toLowerCase()),
      );

      for (const [, teamRows] of teams) {
        const first = teamRows[0];
        // team-level fields consistent
        for (const col of TEAM_LEVEL_COLUMNS) {
          const expected = (first as any)[col] ?? "";
          for (const r of teamRows.slice(1)) {
            const got = (r as any)[col] ?? "";
            if (String(got).toLowerCase() !== String(expected).toLowerCase()) {
              errors.push({
                row: r.row,
                message: `"${col}" for team "${first.team_name}" is "${got || "(empty)"}" but row ${first.row} says "${expected || "(empty)"}". Team-level fields must match on every row of a team.`,
              });
            }
          }
        }
        // exactly one leader
        const leaders = teamRows.filter((r) => r.role === "leader");
        if (leaders.length === 0) {
          errors.push({
            row: first.row,
            message: `Team "${first.team_name}" has no row with role=leader. Exactly one leader is required.`,
          });
        } else if (leaders.length > 1) {
          errors.push({
            row: leaders[0].row,
            message: `Team "${first.team_name}" has ${leaders.length} leaders (rows ${leaders.map((l) => l.row).join(", ")}). Exactly one leader is required.`,
          });
        }
        // cohort must exist
        const cohort = (first.cohort_name ?? "").toLowerCase();
        if (cohort && !cohortNames.has(cohort)) {
          errors.push({
            row: first.row,
            message: `Cohort "${first.cohort_name}" does not exist. Create it first or fix the spelling.`,
          });
        }
      }
    }

    /* ---- emails already registered → skip (never an error) ---- */
    const uniqueEmails = [...byEmail.keys()].filter(Boolean);
    let existing = new Set<string>();
    if (uniqueEmails.length > 0) {
      const { data: taken, error: takenErr } = await supabase.rpc("rp_existing_auth_emails", {
        _emails: uniqueEmails,
      });
      if (takenErr) {
        return fail(`Could not check existing accounts: ${takenErr.message}`);
      }
      existing = new Set((taken ?? []).map((t: any) => String(t.email).toLowerCase()));
    }

    const preview: BulkPreviewRow[] = rows.map(({ emailLower, ...r }) => ({
      ...r,
      action: existing.has(emailLower) ? "skip" : "create",
    }));

    const willSkip = preview.filter((p) => p.action === "skip").length;
    const willCreate = preview.length - willSkip;

    const result: BulkValidationResult = {
      import_id: importId,
      kind,
      rows_total: rows.length,
      will_create: willCreate,
      will_skip: willSkip,
      errors,
      preview,
      ok: errors.length === 0,
    };

    if (importId) {
      await supabase
        .from("rp_bulk_imports")
        .update({
          status: errors.length === 0 ? "ready" : "failed",
          rows_total: rows.length,
          rows_skipped: willSkip,
          rows_failed: errors.length,
          errors_json: errors,
          results_summary_json: {
            will_create: willCreate,
            will_skip: willSkip,
            preview,
          },
          completed_at: errors.length === 0 ? null : new Date().toISOString(),
        })
        .eq("id", importId);
    }

    return result;
  });

/* ------------------------------------------------------------------ */
/* Listing                                                             */
/* ------------------------------------------------------------------ */

export const listRecentBulkImports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("rp_bulk_imports")
      .select("id, kind, status, rows_total, rows_created, rows_skipped, rows_failed, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    return data ?? [];
  });

export const getBulkImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: row, error } = await supabase
      .from("rp_bulk_imports")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */

export const getBulkImportProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ import_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: row, error } = await supabase
      .from("rp_bulk_imports")
      .select("status, rows_total, rows_created, rows_skipped, rows_failed, completed_at, errors_json")
      .eq("id", data.import_id)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

/**
 * Creates the accounts described by a validated import.
 * Temp passwords are returned ONCE inside `results_csv_base64` and are never
 * written to the database.
 */
export const executeBulkOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ import_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runBulkOnboarding, buildResultsCsv, toBase64 } = await import(
      "./bulk-onboarding-exec.server"
    );

    const { data: job, error: jobErr } = await supabaseAdmin
      .from("rp_bulk_imports")
      .select("id, kind, status, results_summary_json")
      .eq("id", data.import_id)
      .maybeSingle();
    if (jobErr) throw jobErr;
    if (!job) throw new Error("Import not found.");
    if (job.status !== "ready") {
      throw new Error(`This import is "${job.status}" — only a validated (ready) import can be run.`);
    }

    const preview = ((job.results_summary_json as any)?.preview ?? []) as BulkPreviewRow[];
    if (!Array.isArray(preview) || preview.length === 0) {
      throw new Error("This import has no stored preview. Re-upload the CSV and try again.");
    }

    await supabaseAdmin
      .from("rp_bulk_imports")
      .update({ status: "processing", rows_created: 0, rows_failed: 0, errors_json: [] })
      .eq("id", data.import_id);

    let outcome;
    try {
      outcome = await runBulkOnboarding(
        supabaseAdmin,
        data.import_id,
        job.kind as BulkKind,
        preview,
      );
    } catch (e: any) {
      // Leave the job in "processing" on an unexpected abort so an admin can
      // inspect what was created rather than us guessing.
      await supabaseAdmin
        .from("rp_bulk_imports")
        .update({ errors_json: [{ row: 0, message: `Run aborted: ${String(e?.message ?? e)}` }] })
        .eq("id", data.import_id);
      throw e;
    }

    await supabaseAdmin
      .from("rp_bulk_imports")
      .update({
        status: "done",
        rows_created: outcome.rows_created,
        rows_skipped: outcome.rows_skipped,
        rows_failed: outcome.rows_failed,
        errors_json: outcome.errors,
        completed_at: new Date().toISOString(),
      })
      .eq("id", data.import_id);

    return {
      results_csv_base64: toBase64(buildResultsCsv(outcome.results)),
      rows_created: outcome.rows_created,
      rows_skipped: outcome.rows_skipped,
      rows_failed: outcome.rows_failed,
      errors: outcome.errors,
    };
  });
