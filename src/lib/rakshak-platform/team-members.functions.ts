import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const emailSchema = z.string().email().max(200);

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("rp_user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.some((r: string) => r === "cfi_admin" || r === "super_admin")) {
    throw new Error("Admin access required");
  }
}

export const listTeamMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ team_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Allow admin OR the team's leader/mentor.
    const { data: team } = await context.supabase
      .from("rp_teams")
      .select("id, team_name, team_leader_id, assigned_mentor_id")
      .eq("id", data.team_id)
      .maybeSingle();
    if (!team) throw new Error("Team not found");

    const { data: members, error } = await context.supabase
      .from("rp_team_members")
      .select("id, full_name, email, phone, college, department, year, role_in_team, profile_id, created_at")
      .eq("team_id", data.team_id)
      .order("created_at", { ascending: true });
    if (error) throw error;

    return { team, members: members ?? [] };
  });

export const addTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      team_id: z.string().uuid(),
      full_name: z.string().min(1).max(120),
      email: emailSchema,
      phone: z.string().max(30).optional(),
      college: z.string().max(200).optional(),
      department: z.string().max(120).optional(),
      year: z.string().max(20).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();

    // Prevent duplicate on same team
    const { data: existing } = await supabaseAdmin
      .from("rp_team_members")
      .select("id")
      .eq("team_id", data.team_id)
      .ilike("email", email)
      .maybeSingle();
    if (existing) throw new Error("Member with that email already on this team.");

    // Find existing auth user by email (if any)
    let existingUserId: string | null = null;
    try {
      const { data: byEmail } = await (supabaseAdmin as any).auth.admin.getUserByEmail?.(email);
      existingUserId = byEmail?.user?.id ?? null;
    } catch {
      // fallback: search paginated (small directories only)
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      existingUserId = list?.users?.find((u: any) => (u.email ?? "").toLowerCase() === email)?.id ?? null;
    }

    // Insert row (link profile_id if user already exists)
    const { data: row, error: insErr } = await supabaseAdmin
      .from("rp_team_members")
      .insert({
        team_id: data.team_id,
        full_name: data.full_name,
        email,
        phone: data.phone ?? null,
        college: data.college ?? null,
        department: data.department ?? null,
        year: data.year ?? null,
        profile_id: existingUserId,
        role_in_team: "member",
      })
      .select()
      .single();
    if (insErr) throw insErr;

    if (existingUserId) {
      // Grant role immediately
      await supabaseAdmin
        .from("rp_user_roles")
        .insert({ user_id: existingUserId, role: "team_member" })
        .then((res) => {
          if (res.error && !String(res.error.message).includes("duplicate")) throw res.error;
        });
    } else {
      // Send Supabase magic-link invite; role granted on signup by trigger
      const origin = (context as any).origin ?? "https://rakshak.crashfreeindia.org";
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/rakshak-platform/auth`,
        data: { full_name: data.full_name },
      });
    }

    return { member: row, invited: !existingUserId };
  });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ member_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("rp_team_members")
      .select("id, profile_id")
      .eq("id", data.member_id)
      .maybeSingle();
    if (!row) throw new Error("Member not found");

    await supabaseAdmin.from("rp_team_members").delete().eq("id", data.member_id);

    // If user is no longer on any team, revoke the team_member role
    if (row.profile_id) {
      const { count } = await supabaseAdmin
        .from("rp_team_members")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", row.profile_id);
      if ((count ?? 0) === 0) {
        await supabaseAdmin
          .from("rp_user_roles")
          .delete()
          .eq("user_id", row.profile_id)
          .eq("role", "team_member");
      }
    }
    return { ok: true };
  });

/** Read-only fetch for the member dashboard. */
export const getMyTeamMemberOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: memberships } = await context.supabase
      .from("rp_team_members")
      .select("id, team_id, full_name, role_in_team, team:rp_teams(id, team_name, college, city, state, current_phase, status, team_leader_id, assigned_mentor_id)")
      .eq("profile_id", context.userId);

    const teams = (memberships ?? []).map((m: any) => m.team).filter(Boolean);
    if (teams.length === 0) return { teams: [], teammates: {}, leaders: {}, mentors: {} };

    const teamIds = teams.map((t: any) => t.id);
    const { data: allMembers } = await context.supabase
      .from("rp_team_members")
      .select("id, team_id, full_name, email, role_in_team")
      .in("team_id", teamIds);

    const leaderIds = teams.map((t: any) => t.team_leader_id).filter(Boolean);
    const mentorIds = teams.map((t: any) => t.assigned_mentor_id).filter(Boolean);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: leaderProfiles }, { data: mentorRows }] = await Promise.all([
      leaderIds.length
        ? supabaseAdmin.from("rp_profiles").select("id, full_name, email").in("id", leaderIds)
        : Promise.resolve({ data: [] as any[] }),
      mentorIds.length
        ? supabaseAdmin.from("rp_mentors").select("id, profile_id").in("id", mentorIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const mentorProfileIds = (mentorRows ?? []).map((m: any) => m.profile_id).filter(Boolean);
    const { data: mentorProfiles } = mentorProfileIds.length
      ? await supabaseAdmin.from("rp_profiles").select("id, full_name, email").in("id", mentorProfileIds)
      : { data: [] as any[] };

    const leaders: Record<string, any> = {};
    (leaderProfiles ?? []).forEach((p: any) => (leaders[p.id] = p));

    const mentorProfileById: Record<string, any> = {};
    (mentorProfiles ?? []).forEach((p: any) => (mentorProfileById[p.id] = p));
    const mentors: Record<string, any> = {};
    (mentorRows ?? []).forEach((m: any) => {
      mentors[m.id] = mentorProfileById[m.profile_id] ?? null;
    });

    const teammates: Record<string, any[]> = {};
    (allMembers ?? []).forEach((m: any) => {
      (teammates[m.team_id] ||= []).push(m);
    });

    return { teams, teammates, leaders, mentors };
  });
