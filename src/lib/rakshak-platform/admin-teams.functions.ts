import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeTeamHealth } from "@/lib/rakshak-platform/admin-team-health";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("rp_is_admin", { _user_id: userId });
  if (!data) throw new Error("Admin only");
}

export const listTeamsAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: teams, error } = await supabaseAdmin
      .from("rp_teams")
      .select(
        "id, team_name, college, city, state, current_phase, status, risk_status, completion_percentage, final_score, evaluated_phases, team_leader_id, assigned_mentor_id, assigned_evaluator_id, leader:team_leader_id(id, full_name, email), rp_mentors:assigned_mentor_id(id, profile_id, rp_profiles:profile_id(full_name, email)), evaluator:assigned_evaluator_id(id, full_name, email)",
      )
      .order("final_score", { ascending: false, nullsFirst: false });
    if (error) throw error;

    const ids = (teams ?? []).map((t: any) => t.id);
    const { data: members } = ids.length
      ? await supabaseAdmin
          .from("rp_team_members")
          .select("team_id, full_name, email, role_in_team")
          .in("team_id", ids)
      : { data: [] as any[] };
    const membersByTeam = new Map<string, any[]>();
    for (const m of members ?? []) {
      const arr = membersByTeam.get(m.team_id) ?? [];
      arr.push(m);
      membersByTeam.set(m.team_id, arr);
    }

    const { data: progress } = ids.length
      ? await supabaseAdmin
          .from("rp_team_phase_progress")
          .select("team_id, phase_number, status, deadline")
          .in("team_id", ids)
      : { data: [] as any[] };
    const phasesByTeam = new Map<string, any[]>();
    for (const p of progress ?? []) {
      const arr = phasesByTeam.get(p.team_id) ?? [];
      arr.push(p);
      phasesByTeam.set(p.team_id, arr);
    }

    // Health / cluster — see admin-team-health.ts for the formula.
    const health = computeTeamHealth(
      (teams ?? []).map((t: any) => ({
        id: t.id,
        completion_percentage: t.completion_percentage,
        score: t.final_score,
        phases: phasesByTeam.get(t.id) ?? [],
      })),
    );

    // Rank by final_score (already sorted desc). Ties get same rank.
    let lastScore: number | null = null;
    let lastRank = 0;
    const ranked = (teams ?? []).map((t: any, i: number) => {
      const score = t.final_score == null ? -1 : Number(t.final_score);
      if (lastScore === null || score !== lastScore) {
        lastRank = i + 1;
        lastScore = score;
      }
      const h = health.get(t.id);
      return {
        ...t,
        rank: t.final_score == null ? null : lastRank,
        members: membersByTeam.get(t.id) ?? [],
        member_count: (membersByTeam.get(t.id) ?? []).length,
        health: h?.health ?? 0,
        cluster: h?.cluster ?? "needs_attention",
        overdue_count: h?.overdue_count ?? 0,
      };
    });

    return { teams: ranked };
  });

/**
 * Admin-only. Per-phase rank (across all teams), score and status for one team.
 * Rank is computed by ranking every team's best submitted evaluation score for
 * that phase; ties share a rank (competition ranking).
 */
export const getTeamPhaseRankings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ team_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: evals }, { data: progress }, { count: teamCount }] = await Promise.all([
      supabaseAdmin
        .from("rp_evaluations")
        .select("team_id, phase_number, weighted_score, total_score, status")
        .eq("status", "submitted"),
      supabaseAdmin
        .from("rp_team_phase_progress")
        .select("phase_number, status, deadline, submitted_at, completion_percentage")
        .eq("team_id", data.team_id),
      supabaseAdmin.from("rp_teams").select("id", { count: "exact", head: true }),
    ]);

    // best weighted score per (team, phase)
    const best = new Map<string, number>();
    for (const e of evals ?? []) {
      const k = `${e.phase_number}|${e.team_id}`;
      const w = Number(e.weighted_score ?? e.total_score) || 0;
      if (w > (best.get(k) ?? -Infinity)) best.set(k, w);
    }

    const progByPhase = new Map<number, any>();
    for (const p of progress ?? []) progByPhase.set(Number(p.phase_number), p);

    const rows = [0, 1, 2, 3, 4].map((phase) => {
      const scores: Array<{ team_id: string; score: number }> = [];
      for (const [k, v] of best) {
        const [p, teamId] = k.split("|");
        if (Number(p) === phase) scores.push({ team_id: teamId, score: v });
      }
      scores.sort((a, b) => b.score - a.score);

      const mine = scores.find((s) => s.team_id === data.team_id) ?? null;
      let rank: number | null = null;
      if (mine) {
        rank = scores.filter((s) => s.score > mine.score).length + 1;
      }

      const pr = progByPhase.get(phase) ?? null;
      const now = Date.now();
      const status: string = pr?.status ?? "not_started";
      let timeliness: "on_time" | "late" | "overdue" | null = null;
      if (pr?.deadline) {
        const dl = new Date(pr.deadline).getTime();
        if (pr.submitted_at) {
          timeliness = new Date(pr.submitted_at).getTime() <= dl ? "on_time" : "late";
        } else if (dl < now && !["completed", "admin_approved", "mentor_approved"].includes(status)) {
          timeliness = "overdue";
        }
      }

      return {
        phase_number: phase,
        rank,
        of: scores.length,
        score: mine ? Number(mine.score.toFixed(2)) : null,
        status,
        timeliness,
        deadline: pr?.deadline ?? null,
        submitted_at: pr?.submitted_at ?? null,
      };
    });

    return { phases: rows, team_count: teamCount ?? 0 };
  });

export const getAdminTeamDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ team_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: team, error: teamErr } = await supabaseAdmin
      .from("rp_teams")
      .select(
        "*, leader:team_leader_id(id, full_name, email, phone), rp_mentors:assigned_mentor_id(id, profile_id, rp_profiles:profile_id(full_name, email, phone)), evaluator:assigned_evaluator_id(id, full_name, email, phone)",
      )
      .eq("id", data.team_id)
      .maybeSingle();
    if (teamErr) throw teamErr;
    if (!team) throw new Error("Team not found");

    // compute rank among all teams by final_score
    const { data: allScores } = await supabaseAdmin
      .from("rp_teams")
      .select("id, final_score")
      .order("final_score", { ascending: false, nullsFirst: false });
    let rank: number | null = null;
    if (team.final_score != null && allScores) {
      let lastScore: number | null = null;
      let lastRank = 0;
      for (let i = 0; i < allScores.length; i++) {
        const s = allScores[i].final_score == null ? -1 : Number(allScores[i].final_score);
        if (lastScore === null || s !== lastScore) { lastRank = i + 1; lastScore = s; }
        if (allScores[i].id === team.id) { rank = lastRank; break; }
      }
    }

    const [members, progress, submissions, feedback, files, meetings, evaluations, locations] = await Promise.all([
      supabaseAdmin
        .from("rp_team_members")
        .select("id, full_name, email, role_in_team, phone, profile_id, created_at")
        .eq("team_id", data.team_id)
        .order("full_name"),
      supabaseAdmin
        .from("rp_team_phase_progress")
        .select("*")
        .eq("team_id", data.team_id)
        .order("phase_number"),
      supabaseAdmin
        .from("rp_submissions")
        .select("*")
        .eq("team_id", data.team_id)
        .order("phase_number"),
      supabaseAdmin
        .from("rp_feedback")
        .select("*, rp_profiles:reviewer_id(full_name, email)")
        .eq("team_id", data.team_id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("rp_submission_files")
        .select("*")
        .eq("team_id", data.team_id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("rp_meetings")
        .select("*, rp_meeting_attendees(profile_id, rsvp, rp_profiles(full_name, email))")
        .eq("team_id", data.team_id)
        .order("scheduled_start", { ascending: false }),
      supabaseAdmin
        .from("rp_evaluations")
        .select("id, submission_id, phase_number, total_score, weighted_score, comments, status, submitted_at, evaluator:evaluator_id(id, full_name, email)")
        .eq("team_id", data.team_id)
        .order("phase_number"),
      supabaseAdmin
        .from("rp_locations")
        .select("id, phase_number, location_name, address, city, state, latitude, longitude, issue_type, severity, description, is_final_selected, drive_link, submitted_to_authority_at, authority_response, priority_rank")
        .eq("team_id", data.team_id)
        .order("phase_number")
        .order("priority_rank", { ascending: true, nullsFirst: false }),
    ]);

    const locRows = locations.data ?? [];
    const locIds = locRows.map((l: any) => l.id);
    const { data: photos } = locIds.length
      ? await supabaseAdmin
          .from("rp_location_photos")
          .select("id, location_id, file_name, storage_path, mime_type, caption, created_at, latitude, longitude")
          .in("location_id", locIds)
          .order("created_at", { ascending: false })
      : { data: [] as any[] };

    const photoRows = photos ?? [];
    const signedByPath: Record<string, string> = {};
    if (photoRows.length) {
      const paths = photoRows.map((p: any) => p.storage_path);
      const { data: signed } = await supabaseAdmin.storage
        .from("rp-submissions")
        .createSignedUrls(paths, 60 * 60);
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) signedByPath[s.path] = s.signedUrl;
      }
    }
    const photosWithUrls = photoRows.map((p: any) => ({
      ...p,
      signed_url: signedByPath[p.storage_path] ?? null,
    }));

    return {
      team: { ...team, rank },
      members: members.data ?? [],
      progress: progress.data ?? [],
      submissions: submissions.data ?? [],
      feedback: feedback.data ?? [],
      files: files.data ?? [],
      meetings: meetings.data ?? [],
      evaluations: evaluations.data ?? [],
      locations: locRows,
      location_photos: photosWithUrls,
    };
  });

export const addAdminRemark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      submission_id: z.string().uuid(),
      team_id: z.string().uuid(),
      phase_number: z.number().int().min(0).max(4),
      remark: z.string().trim().min(1).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { error: fbErr } = await context.supabase.from("rp_feedback").insert({
      submission_id: data.submission_id,
      team_id: data.team_id,
      phase_number: data.phase_number,
      reviewer_id: context.userId,
      reviewer_role: "admin",
      feedback_text: data.remark,
      status: "open",
    });
    if (fbErr) throw fbErr;

    // Best-effort notify team leader + members (do not fail on notification error)
    try {
      const { data: team } = await context.supabase
        .from("rp_teams")
        .select("team_leader_id, team_name")
        .eq("id", data.team_id)
        .maybeSingle();
      const { data: members } = await context.supabase
        .from("rp_team_members")
        .select("profile_id")
        .eq("team_id", data.team_id);
      const ids = new Set<string>();
      if (team?.team_leader_id) ids.add(team.team_leader_id);
      for (const m of members ?? []) if (m.profile_id) ids.add(m.profile_id);
      const rows = Array.from(ids).map((r) => ({
        recipient_id: r,
        type: "admin_remark",
        title: `Admin remark on Phase ${data.phase_number}`,
        message: data.remark.slice(0, 240),
        action_link: `/rakshak-platform/team/phases`,
        related_entity_type: "submission",
        related_entity_id: data.submission_id,
      }));
      if (rows.length) await context.supabase.from("rp_notifications").insert(rows);

      // Best-effort WhatsApp notify (inert until credentials configured)
      try {
        const { notifyTeamWhatsApp } = await import("./whatsapp.server");
        const teamName = team?.team_name ?? "your team";
        const snippet = data.remark.length > 200 ? `${data.remark.slice(0, 200)}…` : data.remark;
        await notifyTeamWhatsApp({
          team_id: data.team_id,
          body: `Admin feedback on Phase ${data.phase_number} for ${teamName}: ${snippet}`,
        });
      } catch (e) {
        console.error("[addAdminRemark] whatsapp notify failed", e);
      }
    } catch {
      // ignore
    }



    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Unified admin team creation (team + leader + members, credentialed)  */
/* ------------------------------------------------------------------ */

const SYNTH_DOMAIN = "rakshak.credentials.local";

const ROLE_CAPS = { team_leader: 120, team_member: 240 } as const;

function sanitizeLoginId(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "");
  if (!cleaned || cleaned.length < 3 || cleaned.length > 40) {
    throw new Error(`Login ID "${raw}" must be 3–40 chars (letters, digits, . _ -).`);
  }
  return cleaned;
}

const personSchema = z.object({
  full_name: z.string().trim().min(1).max(160),
  login_id: z.string().trim().min(3).max(60),
  password: z.string().min(8).max(200),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(200).optional().nullable(),
  college: z.string().trim().max(200).optional().nullable(),
  department: z.string().trim().max(120).optional().nullable(),
  year: z.string().trim().max(20).optional().nullable(),
});

type Person = z.infer<typeof personSchema>;

async function countRole(supabaseAdmin: any, role: "team_leader" | "team_member") {
  const { count } = await supabaseAdmin
    .from("rp_user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", role);
  return count ?? 0;
}

/** Creates auth user + rp_profiles row + rp_user_roles row. Returns the new user id. */
async function provisionUser(
  supabaseAdmin: any,
  p: Person,
  role: "team_leader" | "team_member",
  fallbackCollege: string | null,
) {
  const login_id = sanitizeLoginId(p.login_id);

  const { data: dupLogin } = await supabaseAdmin
    .from("rp_profiles").select("id").eq("login_id", login_id).maybeSingle();
  if (dupLogin) throw new Error(`Login ID "${login_id}" is already in use.`);

  const email = p.email?.trim()
    ? p.email.trim().toLowerCase()
    : `${login_id}@${SYNTH_DOMAIN}`;

  const { data: dupEmail } = await supabaseAdmin
    .from("rp_profiles").select("id").eq("email", email).maybeSingle();
  if (dupEmail) throw new Error(`An account with email "${email}" already exists.`);

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: p.password,
    email_confirm: true,
    user_metadata: { full_name: p.full_name, login_id, provisioned: true },
  });
  if (createErr || !created?.user) throw new Error(createErr?.message || "Could not create user.");
  const userId = created.user.id as string;

  const { error: profErr } = await supabaseAdmin.from("rp_profiles").upsert(
    {
      id: userId,
      full_name: p.full_name,
      email,
      login_id,
      phone: p.phone ?? null,
      organization: p.college ?? fallbackCollege,
    },
    { onConflict: "id" },
  );
  if (profErr) {
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
    throw profErr;
  }

  const { error: roleErr } = await supabaseAdmin
    .from("rp_user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
  if (roleErr) {
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
    throw roleErr;
  }

  return { userId, login_id, email, password: p.password };
}

export const listTeamCreationOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [cohorts, mentors, leaderCount, memberCount] = await Promise.all([
      supabaseAdmin.from("rp_cohorts").select("id, name, year, status").order("created_at"),
      supabaseAdmin
        .from("rp_mentors")
        .select("id, profile_id, organization, rp_profiles:profile_id(full_name, email)")
        .order("created_at"),
      countRole(supabaseAdmin, "team_leader"),
      countRole(supabaseAdmin, "team_member"),
    ]);
    return {
      cohorts: cohorts.data ?? [],
      mentors: (mentors.data ?? []).map((m: any) => ({
        id: m.id,
        full_name: m.rp_profiles?.full_name ?? "Unnamed mentor",
        email: m.rp_profiles?.email ?? null,
        organization: m.organization ?? null,
      })),
      counts: { team_leader: leaderCount, team_member: memberCount },
      caps: { ...ROLE_CAPS },
    };
  });

export const suggestTeamLoginIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ leader: z.number().int().min(0).max(1), members: z.number().int().min(0).max(20) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    async function nextFrom(prefix: string, n: number) {
      const { data: rows } = await supabaseAdmin
        .from("rp_profiles").select("login_id").not("login_id", "is", null).ilike("login_id", `${prefix}%`);
      const re = new RegExp(`^${prefix.toLowerCase()}(\\d{1,6})$`);
      let max = 0;
      for (const r of rows ?? []) {
        const m = String(r.login_id).toLowerCase().match(re);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      }
      return Array.from({ length: n }, (_, i) => `${prefix}${String(max + 1 + i).padStart(4, "0")}`);
    }

    return {
      leader: (await nextFrom("TL", data.leader))[0] ?? null,
      members: await nextFrom("TM", data.members),
    };
  });

export const createTeamWithCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      team_name: z.string().trim().min(2).max(160),
      cohort_id: z.string().uuid().optional().nullable(),
      college: z.string().trim().max(200).optional().nullable(),
      city: z.string().trim().max(120).optional().nullable(),
      state: z.string().trim().max(120).optional().nullable(),
      assigned_mentor_id: z.string().uuid().optional().nullable(),
      leader: personSchema,
      members: z.array(personSchema).max(20).default([]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Duplicate login IDs within the payload
    const allIds = [data.leader.login_id, ...data.members.map((m) => m.login_id)].map((s) =>
      s.trim().toLowerCase(),
    );
    if (new Set(allIds).size !== allIds.length) {
      throw new Error("Duplicate login IDs in this form. Each person needs a unique login ID.");
    }

    // Caps
    const [leaders, members] = await Promise.all([
      countRole(supabaseAdmin, "team_leader"),
      countRole(supabaseAdmin, "team_member"),
    ]);
    if (leaders + 1 > ROLE_CAPS.team_leader) {
      throw new Error(`Cap reached: ${ROLE_CAPS.team_leader} team leader accounts already exist.`);
    }
    if (members + data.members.length > ROLE_CAPS.team_member) {
      throw new Error(
        `Cap reached: only ${ROLE_CAPS.team_member - members} team member slots left (needed ${data.members.length}).`,
      );
    }

    // Resolve cohort
    let cohortId = data.cohort_id ?? null;
    if (!cohortId) {
      const { data: c } = await supabaseAdmin
        .from("rp_cohorts").select("id").eq("status", "active").order("created_at").limit(1).maybeSingle();
      cohortId = c?.id ?? null;
    }
    if (!cohortId) throw new Error("No cohort available. Create a cohort first.");

    const createdUserIds: string[] = [];
    let teamId: string | null = null;

    try {
      const leaderCred = await provisionUser(supabaseAdmin, data.leader, "team_leader", data.college ?? null);
      createdUserIds.push(leaderCred.userId);

      const { data: team, error: teamErr } = await supabaseAdmin
        .from("rp_teams")
        .insert({
          cohort_id: cohortId,
          team_name: data.team_name,
          college: data.college ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          team_leader_id: leaderCred.userId,
          assigned_mentor_id: data.assigned_mentor_id ?? null,
        })
        .select("id")
        .single();
      if (teamErr) throw teamErr;
      teamId = team.id as string;

      await supabaseAdmin.from("rp_team_members").insert({
        team_id: teamId,
        profile_id: leaderCred.userId,
        full_name: data.leader.full_name,
        email: leaderCred.email,
        phone: data.leader.phone ?? null,
        college: data.leader.college ?? data.college ?? null,
        department: data.leader.department ?? null,
        year: data.leader.year ?? null,
        role_in_team: "leader",
      });

      const memberCreds: Array<{ full_name: string; login_id: string; email: string; password: string }> = [];
      for (const m of data.members) {
        const cred = await provisionUser(supabaseAdmin, m, "team_member", data.college ?? null);
        createdUserIds.push(cred.userId);
        await supabaseAdmin.from("rp_team_members").insert({
          team_id: teamId,
          profile_id: cred.userId,
          full_name: m.full_name,
          email: cred.email,
          phone: m.phone ?? null,
          college: m.college ?? data.college ?? null,
          department: m.department ?? null,
          year: m.year ?? null,
          role_in_team: "member",
        });
        memberCreds.push({ full_name: m.full_name, login_id: cred.login_id, email: cred.email, password: cred.password });
      }

      if (data.assigned_mentor_id) {
        const { data: mentorRow } = await supabaseAdmin
          .from("rp_mentors").select("current_team_count").eq("id", data.assigned_mentor_id).maybeSingle();
        await supabaseAdmin
          .from("rp_mentors")
          .update({ current_team_count: Number(mentorRow?.current_team_count ?? 0) + 1 })
          .eq("id", data.assigned_mentor_id);
      }

      return {
        team_id: teamId,
        team_name: data.team_name,
        leader: {
          full_name: data.leader.full_name,
          login_id: leaderCred.login_id,
          email: leaderCred.email,
          password: leaderCred.password,
        },
        members: memberCreds,
      };
    } catch (e) {
      // Roll back everything we created so the admin can retry cleanly.
      if (teamId) {
        try { await supabaseAdmin.from("rp_team_members").delete().eq("team_id", teamId); } catch { /* noop */ }
        await supabaseAdmin.from("rp_teams").delete().eq("id", teamId);
      }
      for (const uid of createdUserIds) {
        await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
      }
      throw e;
    }
  });

export const addTeamMemberWithCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ team_id: z.string().uuid(), member: personSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const used = await countRole(supabaseAdmin, "team_member");
    if (used + 1 > ROLE_CAPS.team_member) {
      throw new Error(`Cap reached: ${ROLE_CAPS.team_member} team member accounts already exist.`);
    }

    const { data: team } = await supabaseAdmin
      .from("rp_teams").select("id, college").eq("id", data.team_id).maybeSingle();
    if (!team) throw new Error("Team not found");

    const cred = await provisionUser(supabaseAdmin, data.member, "team_member", team.college ?? null);

    const { error: insErr } = await supabaseAdmin.from("rp_team_members").insert({
      team_id: data.team_id,
      profile_id: cred.userId,
      full_name: data.member.full_name,
      email: cred.email,
      phone: data.member.phone ?? null,
      college: data.member.college ?? team.college ?? null,
      department: data.member.department ?? null,
      year: data.member.year ?? null,
      role_in_team: "member",
    });
    if (insErr) {
      await supabaseAdmin.auth.admin.deleteUser(cred.userId).catch(() => {});
      throw insErr;
    }

    return {
      full_name: data.member.full_name,
      login_id: cred.login_id,
      email: cred.email,
      password: cred.password,
    };
  });
