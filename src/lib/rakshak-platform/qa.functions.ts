import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Comprehensive QA sweep — runs a battery of data-integrity checks across the
 * platform tables and returns categorized findings. Admin-only.
 */
export const runQAChecks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("rp_user_roles").select("role").eq("user_id", context.userId);
    const ok = (roles ?? []).some((r: any) => ["cfi_admin", "super_admin"].includes(r.role));
    if (!ok) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [
      teamsQ, membersQ, locsQ, subsQ, mentorsQ, teamsForMentorQ,
      certsQ, profilesQ, evalsQ, phaseProgQ, feedbackQ,
    ] = await Promise.all([
      supabaseAdmin.from("rp_teams").select("id, team_name, cohort_id, assigned_mentor_id, current_phase, status, created_at"),
      supabaseAdmin.from("rp_team_members").select("team_id, profile_id"),
      supabaseAdmin.from("rp_locations").select("id, team_id, location_name, latitude, longitude, severity, is_final_selected"),
      supabaseAdmin.from("rp_submissions").select("id, team_id, phase_number, status, submitted_at, created_at"),
      supabaseAdmin.from("rp_mentors").select("id, profile_id"),
      supabaseAdmin.from("rp_teams").select("id, assigned_mentor_id"),
      supabaseAdmin.from("rp_certificates").select("id, serial_no, public_slug, is_revoked"),
      supabaseAdmin.from("rp_profiles").select("id, full_name, email"),
      supabaseAdmin.from("rp_evaluations").select("id, team_id, submission_id, evaluator_id"),
      supabaseAdmin.from("rp_team_phase_progress").select("team_id, phase_number, status, deadline"),
      supabaseAdmin.from("rp_feedback").select("id, submission_id, reviewer_id"),
    ]);

    const teams = teamsQ.data ?? [];
    const members = membersQ.data ?? [];
    const locs = locsQ.data ?? [];
    const subs = subsQ.data ?? [];
    const mentors = mentorsQ.data ?? [];
    const teamMentor = teamsForMentorQ.data ?? [];
    const certs = certsQ.data ?? [];
    const profiles = profilesQ.data ?? [];
    const evals = evalsQ.data ?? [];
    const tpp = phaseProgQ.data ?? [];
    const feedback = feedbackQ.data ?? [];

    const teamMemberCount = new Map<string, number>();
    for (const m of members) teamMemberCount.set(m.team_id, (teamMemberCount.get(m.team_id) ?? 0) + 1);

    const submissionIds = new Set(subs.map((s) => s.id));
    const teamIds = new Set(teams.map((t) => t.id));
    const profileIds = new Set(profiles.map((p) => p.id));
    const assignedMentorIds = new Set(teamMentor.map((t) => t.assigned_mentor_id).filter(Boolean));

    const checks: Array<{
      id: string;
      title: string;
      severity: "info" | "warn" | "error";
      category: string;
      count: number;
      items: any[];
    }> = [];

    // 1. Teams with no members
    const noMembers = teams.filter((t) => (teamMemberCount.get(t.id) ?? 0) === 0);
    checks.push({
      id: "teams-no-members", title: "Teams with no members", severity: noMembers.length ? "warn" : "info",
      category: "Teams", count: noMembers.length,
      items: noMembers.slice(0, 20).map((t) => ({ id: t.id, label: t.team_name })),
    });

    // 2. Teams with no mentor (and active)
    const noMentor = teams.filter((t) => t.status === "active" && !t.assigned_mentor_id);
    checks.push({
      id: "teams-no-mentor", title: "Active teams without an assigned mentor",
      severity: noMentor.length ? "warn" : "info",
      category: "Teams", count: noMentor.length,
      items: noMentor.slice(0, 20).map((t) => ({ id: t.id, label: t.team_name })),
    });

    // 3. Locations missing coordinates
    const noCoords = locs.filter((l) => l.latitude == null || l.longitude == null);
    checks.push({
      id: "locs-no-coords", title: "Locations missing latitude/longitude",
      severity: noCoords.length ? "warn" : "info",
      category: "Locations", count: noCoords.length,
      items: noCoords.slice(0, 20).map((l) => ({ id: l.id, label: l.location_name ?? "—" })),
    });

    // 4. Locations with invalid coordinates (outside India bounding box)
    const offMap = locs.filter((l) => {
      const lat = Number(l.latitude), lng = Number(l.longitude);
      return l.latitude != null && (lat < 6 || lat > 38 || lng < 67 || lng > 98);
    });
    checks.push({
      id: "locs-off-india", title: "Locations with coordinates outside India",
      severity: offMap.length ? "warn" : "info",
      category: "Locations", count: offMap.length,
      items: offMap.slice(0, 20).map((l) => ({ id: l.id, label: `${l.location_name} (${l.latitude}, ${l.longitude})` })),
    });

    // 5. Submissions with no submitted_at but status submitted
    const pendingTs = subs.filter((s) => ["submitted", "resubmitted"].includes(s.status) && !s.submitted_at);
    checks.push({
      id: "subs-missing-ts", title: "Submissions in 'submitted' state without a timestamp",
      severity: pendingTs.length ? "error" : "info",
      category: "Submissions", count: pendingTs.length,
      items: pendingTs.slice(0, 20).map((s) => ({ id: s.id, label: `Phase ${s.phase_number}` })),
    });

    // 6. Phase progress past deadline not completed
    const overdue = tpp.filter((p) => p.deadline && new Date(p.deadline) < new Date() && p.status !== "completed");
    checks.push({
      id: "tpp-overdue", title: "Team phases past their deadline",
      severity: overdue.length ? "warn" : "info",
      category: "Phases", count: overdue.length,
      items: overdue.slice(0, 20).map((p) => ({ id: `${p.team_id}-${p.phase_number}`, label: `Team ${p.team_id.slice(0, 8)} · Phase ${p.phase_number} due ${new Date(p.deadline as string).toLocaleDateString()}` })),
    });

    // 7. Mentor profiles without team assignment
    const idleMentors = mentors.filter((m) => !assignedMentorIds.has(m.id));
    checks.push({
      id: "mentors-idle", title: "Mentors with no team assigned",
      severity: "info",
      category: "Mentors", count: idleMentors.length,
      items: idleMentors.slice(0, 20).map((m) => ({ id: m.id, label: m.profile_id?.slice(0, 8) ?? m.id })),
    });

    // 8. Orphaned feedback (no parent submission)
    const orphanedFb = feedback.filter((f) => !submissionIds.has(f.submission_id));
    checks.push({
      id: "feedback-orphan", title: "Orphaned feedback (parent submission deleted)",
      severity: orphanedFb.length ? "error" : "info",
      category: "Integrity", count: orphanedFb.length,
      items: orphanedFb.slice(0, 20).map((f) => ({ id: f.id, label: f.id })),
    });

    // 9. Orphaned evaluations
    const orphanedEval = evals.filter((e) => !submissionIds.has(e.submission_id) || !teamIds.has(e.team_id));
    checks.push({
      id: "eval-orphan", title: "Orphaned evaluations",
      severity: orphanedEval.length ? "error" : "info",
      category: "Integrity", count: orphanedEval.length,
      items: orphanedEval.slice(0, 20).map((e) => ({ id: e.id, label: e.id })),
    });

    // 10. Duplicate certificate serials / slugs
    const serialCounts = new Map<string, number>();
    const slugCounts = new Map<string, number>();
    for (const c of certs) {
      if (c.serial_no) serialCounts.set(c.serial_no, (serialCounts.get(c.serial_no) ?? 0) + 1);
      if (c.public_slug) slugCounts.set(c.public_slug, (slugCounts.get(c.public_slug) ?? 0) + 1);
    }
    const dupSerials = Array.from(serialCounts.entries()).filter(([, n]) => n > 1);
    const dupSlugs = Array.from(slugCounts.entries()).filter(([, n]) => n > 1);
    checks.push({
      id: "cert-dup-serial", title: "Duplicate certificate serial numbers",
      severity: dupSerials.length ? "error" : "info",
      category: "Certificates", count: dupSerials.length,
      items: dupSerials.slice(0, 20).map(([s, n]) => ({ id: s, label: `${s} ×${n}` })),
    });
    checks.push({
      id: "cert-dup-slug", title: "Duplicate certificate verify slugs",
      severity: dupSlugs.length ? "error" : "info",
      category: "Certificates", count: dupSlugs.length,
      items: dupSlugs.slice(0, 20).map(([s, n]) => ({ id: s, label: `${s} ×${n}` })),
    });

    // 11. Profiles missing email
    const noEmail = profiles.filter((p) => !p.email);
    checks.push({
      id: "profiles-no-email", title: "User profiles missing email address",
      severity: "info",
      category: "Profiles", count: noEmail.length,
      items: noEmail.slice(0, 20).map((p) => ({ id: p.id, label: p.full_name ?? p.id.slice(0, 8) })),
    });

    // 12. Teams without a cohort
    const noCohort = teams.filter((t) => !t.cohort_id);
    checks.push({
      id: "teams-no-cohort", title: "Teams not linked to any cohort",
      severity: noCohort.length ? "warn" : "info",
      category: "Teams", count: noCohort.length,
      items: noCohort.slice(0, 20).map((t) => ({ id: t.id, label: t.team_name })),
    });

    // 13. Final-selected locations missing severity
    const missingSev = locs.filter((l) => l.is_final_selected && !l.severity);
    checks.push({
      id: "locs-no-severity", title: "Final-selected locations missing severity",
      severity: missingSev.length ? "warn" : "info",
      category: "Locations", count: missingSev.length,
      items: missingSev.slice(0, 20).map((l) => ({ id: l.id, label: l.location_name ?? "—" })),
    });

    const summary = {
      total_checks: checks.length,
      errors: checks.filter((c) => c.severity === "error" && c.count > 0).length,
      warnings: checks.filter((c) => c.severity === "warn" && c.count > 0).length,
      clean: checks.filter((c) => c.count === 0).length,
      generated_at: new Date().toISOString(),
    };

    return { checks, summary };
  });
