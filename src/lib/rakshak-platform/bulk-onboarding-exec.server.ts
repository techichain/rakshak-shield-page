/**
 * Bulk onboarding — execution engine (server-only).
 *
 * SECURITY / DESIGN INVARIANTS
 *  1. Temp passwords are NEVER written to any table. They live in memory here
 *     and are returned exactly once inside the results CSV.
 *  2. Per user, the order is: auth user -> rp_profiles -> domain row(s) ->
 *     rp_user_roles. If any step after auth-user creation fails, the auth user
 *     is deleted again so we never leave orphans. If that cleanup itself
 *     fails, the auth user id is recorded in errors_json for manual review.
 *  3. Race safety: an email that was "create" at preview time but exists now is
 *     counted as a SKIP, never a failure.
 */

import type { BulkPreviewRow } from "./bulk-onboarding.functions";

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 100;
const PORTAL_BASE = "https://rakshak.crashfreeindia.org";


export type ExecResultRow = {
  email: string;
  temp_password: string;
  login_id: string;
  full_name: string;
  team_name: string;
  role: string;
  status: string;
};

export type ExecOutcome = {
  rows_created: number;
  rows_skipped: number;
  rows_failed: number;
  errors: Array<{ row: number; message: string }>;
  results: ExecResultRow[];
};

/* ---------------------------------------------------------------- */
/* Helpers                                                           */
/* ---------------------------------------------------------------- */

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGIT = "23456789";
const SYMBOL = "!@#$%^&*?";

function pick(set: string, n: number): string {
  const bytes = new Uint32Array(n);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < n; i++) out += set[bytes[i] % set.length];
  return out;
}

/** 16 chars, guaranteed mix of upper / lower / digits / symbols. */
export function generateTempPassword(): string {
  const chars = (pick(UPPER, 4) + pick(LOWER, 6) + pick(DIGIT, 4) + pick(SYMBOL, 2)).split("");
  const order = new Uint32Array(chars.length);
  crypto.getRandomValues(order);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = order[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildResultsCsv(rows: ExecResultRow[]): string {
  const head = ["email", "login_id", "temp_password", "full_name", "team_name", "role", "status"];
  const lines = [head.join(",")];
  for (const r of rows) {
    lines.push(
      [r.email, r.login_id, r.temp_password, r.full_name, r.team_name, r.role, r.status]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Allocates `firstname.lastname@cfi` login ids, deduped against rp_profiles + this batch. */
async function makeLoginIdAllocator(supabaseAdmin: any) {
  const taken = new Set<string>();
  const { data: rows } = await supabaseAdmin
    .from("rp_profiles")
    .select("login_id")
    .not("login_id", "is", null);
  for (const r of rows ?? []) taken.add(String(r.login_id).toLowerCase());

  const clean = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  return (fullName: string) => {
    const parts = String(fullName ?? "")
      .trim()
      .split(/\s+/)
      .map(clean)
      .filter(Boolean);
    const first = parts[0] ?? "user";
    const last = parts.length > 1 ? parts[parts.length - 1] : "";
    const base = last ? `${first}.${last}` : first;

    let candidate = `${base}@cfi`;
    let n = 1;
    while (taken.has(candidate)) {
      n += 1;
      candidate = `${base}${n}@cfi`;
    }
    taken.add(candidate);
    return candidate;
  };
}


/* ---------------------------------------------------------------- */
/* Main runner                                                       */
/* ---------------------------------------------------------------- */

export async function runBulkOnboarding(
  supabaseAdmin: any,
  importId: string,
  kind: "teams" | "mentors" | "evaluators",
  preview: BulkPreviewRow[],
): Promise<ExecOutcome> {
  const results: ExecResultRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  let created = 0;
  let skipped = preview.filter((p) => p.action === "skip").length;
  let failed = 0;

  const nextLoginId = await makeLoginIdAllocator(supabaseAdmin);

  // cohort name -> id (case-insensitive), loaded once.
  const cohortByName = new Map<string, string>();
  if (kind === "teams") {
    const { data: cohorts } = await supabaseAdmin.from("rp_cohorts").select("id, name");
    for (const c of cohorts ?? []) cohortByName.set(String(c.name).trim().toLowerCase(), c.id);
  }
  // team key (name|cohort) -> team id, resolved lazily and cached.
  const teamCache = new Map<string, string>();

  const todo = preview.filter((p) => p.action === "create");
  // Leaders first so the team row exists with its leader before members land.
  todo.sort((a, b) => (a.role === "leader" ? -1 : 0) - (b.role === "leader" ? -1 : 0));

  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const batch = todo.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      const email = row.email.trim().toLowerCase();
      let authUserId: string | null = null;
      try {
        /* --- race safety: already registered? --- */
        const { data: taken } = await supabaseAdmin.rpc("rp_existing_auth_emails", {
          _emails: [email],
        });
        if ((taken ?? []).length > 0) {
          skipped++;
          continue;
        }

        const tempPassword = generateTempPassword();
        const appRole =
          kind === "mentors"
            ? "mentor"
            : kind === "evaluators"
              ? "evaluator"
              : row.role === "leader"
                ? "team_leader"
                : "team_member";
        const loginId = nextLoginId(row.full_name);

        /* --- 1. auth user --- */
        const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: row.full_name, phone: row.phone ?? null, login_id: loginId, provisioned: true },
        });
        if (createErr || !createdUser?.user) {
          const msg = String(createErr?.message ?? "Could not create user.");
          if (/already\s*registered|already been registered|duplicate/i.test(msg)) {
            skipped++;
            continue;
          }
          throw new Error(msg);
        }
        authUserId = createdUser.user.id as string;

        /* --- 2. profile --- */
        const { error: profErr } = await supabaseAdmin.from("rp_profiles").upsert(
          {
            id: authUserId,
            full_name: row.full_name,
            email,
            login_id: loginId,
            phone: row.phone ?? null,
            organization: row.college ?? null,
            city: row.city ?? null,
            state: row.state ?? null,
          },
          { onConflict: "id" },
        );
        if (profErr) throw profErr;

        /* --- 3. domain rows --- */
        let teamName = "";
        if (kind === "teams") {
          const cohortId = cohortByName.get((row.cohort_name ?? "").trim().toLowerCase());
          if (!cohortId) throw new Error(`Cohort "${row.cohort_name}" not found.`);
          teamName = row.team_name ?? "";
          const teamId = await findOrCreateTeam(supabaseAdmin, {
            cohortId,
            teamName,
            college: row.college ?? null,
            city: row.city ?? null,
            state: row.state ?? null,
            cache: teamCache,
          });

          if (row.role === "leader") {
            const { error: leadErr } = await supabaseAdmin
              .from("rp_teams")
              .update({ team_leader_id: authUserId })
              .eq("id", teamId);
            if (leadErr) throw leadErr;
          }

          const { error: memErr } = await supabaseAdmin.from("rp_team_members").insert({
            team_id: teamId,
            profile_id: authUserId,
            full_name: row.full_name,
            email,
            phone: row.phone ?? null,
            college: row.college ?? null,
            role_in_team: row.role === "leader" ? "leader" : "member",
          });
          if (memErr) throw memErr;
        } else if (kind === "mentors") {
          const { error: mErr } = await supabaseAdmin.from("rp_mentors").insert({
            profile_id: authUserId,
            organization: row.college ?? null,
            status: "active",
          });
          if (mErr) throw mErr;
        }
        // evaluators have no dedicated table — profile + role is the record.

        /* --- 4. role --- */
        const { error: roleErr } = await supabaseAdmin
          .from("rp_user_roles")
          .upsert({ user_id: authUserId, role: appRole }, { onConflict: "user_id,role" });
        if (roleErr) throw roleErr;

        /* --- 5. recovery link + notification (best effort, never fatal) --- */
        let resetLink: string | null = null;
        try {
          const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
            type: "recovery",
            email,
          });
          resetLink =
            (linkData as any)?.properties?.action_link ?? (linkData as any)?.action_link ?? null;
        } catch {
          resetLink = null;
        }
        try {
          await supabaseAdmin.from("rp_notifications").insert({
            recipient_id: authUserId,
            title: "Your Project Rakshak account is ready",
            message: `Hi ${row.full_name}, an account has been created for you on Project Rakshak. Please set your password using the link below (valid for 1 hour). Your login ID is ${loginId}. If you miss the window, you can request a new link from the login page.`,
            type: "credentials_issued",
            related_entity_type: "rp_bulk_imports",
            related_entity_id: importId,
            action_link: resetLink ?? `${PORTAL_BASE}/rakshak-platform/auth`,
          });
        } catch (e: any) {
          errors.push({ row: row.row, message: `Account created, notification failed: ${String(e?.message ?? e)}` });
        }

        results.push({
          email,
          temp_password: tempPassword,
          login_id: loginId,
          full_name: row.full_name,
          team_name: teamName,
          role: appRole,
          status: "created",
        });
        created++;
      } catch (e: any) {
        failed++;
        const msg = String(e?.message ?? e);
        if (authUserId) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
            errors.push({ row: row.row, message: `${row.email}: ${msg} (rolled back)` });
          } catch {
            errors.push({
              row: row.row,
              message: `${row.email}: ${msg} — CLEANUP FAILED, orphan auth user ${authUserId} needs manual review`,
            });
          }
        } else {
          errors.push({ row: row.row, message: `${row.email}: ${msg}` });
        }
      }
    }

    // progress checkpoint after every batch
    await supabaseAdmin
      .from("rp_bulk_imports")
      .update({
        rows_created: created,
        rows_skipped: skipped,
        rows_failed: failed,
        errors_json: errors,
      })
      .eq("id", importId);

    if (i + BATCH_SIZE < todo.length) await sleep(BATCH_DELAY_MS);
  }

  return { rows_created: created, rows_skipped: skipped, rows_failed: failed, errors, results };
}

async function findOrCreateTeam(
  supabaseAdmin: any,
  opts: {
    cohortId: string;
    teamName: string;
    college: string | null;
    city: string | null;
    state: string | null;
    cache: Map<string, string>;
  },
): Promise<string> {
  const key = `${opts.teamName.toLowerCase()}|${opts.cohortId}`;
  const cached = opts.cache.get(key);
  if (cached) return cached;

  const { data: found } = await supabaseAdmin
    .from("rp_teams")
    .select("id")
    .eq("cohort_id", opts.cohortId)
    .ilike("team_name", opts.teamName)
    .maybeSingle();
  if (found?.id) {
    opts.cache.set(key, found.id);
    return found.id;
  }

  const { data: team, error } = await supabaseAdmin
    .from("rp_teams")
    .insert({
      cohort_id: opts.cohortId,
      team_name: opts.teamName,
      college: opts.college,
      city: opts.city,
      state: opts.state,
      current_phase: 1,
    })
    .select("id")
    .single();
  if (error) throw error;

  // Seed the 5 phase-progress rows exactly like createTeamWithCredentials does.
  const { data: sched } = await supabaseAdmin
    .from("rp_cohort_phase_schedule")
    .select("phase_number, deadline")
    .eq("cohort_id", opts.cohortId);
  const deadlineByPhase = new Map<number, string | null>(
    (sched ?? []).map((s: any) => [Number(s.phase_number), s.deadline ?? null]),
  );
  const nowIso = new Date().toISOString();
  await supabaseAdmin.from("rp_team_phase_progress").insert(
    [0, 1, 2, 3, 4].map((phase) => ({
      team_id: team.id as string,
      phase_number: phase,
      status: (phase === 1 ? "draft" : "not_started") as "draft" | "not_started",
      started_at: phase === 1 ? nowIso : null,
      completion_percentage: 0,
      deadline: deadlineByPhase.get(phase) ?? null,
    })),
  );

  opts.cache.set(key, team.id);
  return team.id as string;
}
