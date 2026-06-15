import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'

const emailList = z
  .array(z.string().trim().toLowerCase().email().max(255))
  .max(30)
  .default([])

const createSchema = z.object({
  teamName: z.string().trim().min(2).max(120),
  leaderEmail: z.string().trim().toLowerCase().email().max(255),
  college: z.string().trim().max(160).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(80).optional().nullable(),
  memberEmails: emailList.optional(),
})

// Mentor creates a team-creation request. Admin must approve.
export const requestMentorTeam = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context

    const { data: isMentor } = await supabase.rpc('rp_has_role', {
      _user_id: userId,
      _role: 'mentor',
    })
    if (!isMentor) throw new Error('Only mentors can request team creation.')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // Validate leader: must already be a verified team_leader
    const { data: leaderProfile } = await supabaseAdmin
      .from('rp_profiles')
      .select('id, full_name, email')
      .ilike('email', data.leaderEmail)
      .maybeSingle()
    if (!leaderProfile) {
      throw new Error(`No account found for leader email "${data.leaderEmail}". Ask the leader to sign up first.`)
    }
    const { data: leaderHasRole } = await supabaseAdmin.rpc('rp_has_role', {
      _user_id: leaderProfile.id,
      _role: 'team_leader',
    })
    if (!leaderHasRole) {
      throw new Error(`"${data.leaderEmail}" is not yet an approved team leader.`)
    }

    // Validate each member email: must be approved team_leader or team_member
    const members = Array.from(
      new Set((data.memberEmails ?? []).filter((e) => e && e !== data.leaderEmail)),
    )
    for (const em of members) {
      const { data: prof } = await supabaseAdmin
        .from('rp_profiles')
        .select('id')
        .ilike('email', em)
        .maybeSingle()
      if (!prof) {
        throw new Error(`No account found for member "${em}". Ask them to sign up first.`)
      }
      const [{ data: isLeader }, { data: isMember }] = await Promise.all([
        supabaseAdmin.rpc('rp_has_role', { _user_id: prof.id, _role: 'team_leader' }),
        supabaseAdmin.rpc('rp_has_role', { _user_id: prof.id, _role: 'team_member' }),
      ])
      if (!isLeader && !isMember) {
        throw new Error(`"${em}" is not an approved team leader or team member.`)
      }
    }

    const { data: dupe } = await supabaseAdmin
      .from('rp_mentor_team_requests')
      .select('id')
      .eq('mentor_profile_id', userId)
      .eq('status', 'pending')
      .ilike('leader_email', data.leaderEmail)
      .ilike('team_name', data.teamName)
      .maybeSingle()
    if (dupe) throw new Error('You already have a pending request for this team/leader.')

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('rp_mentor_team_requests')
      .insert({
        mentor_profile_id: userId,
        team_name: data.teamName,
        leader_email: data.leaderEmail,
        college: data.college ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        member_emails: members,
      })
      .select('id')
      .single()
    if (insertErr) throw insertErr

    const { data: mentorProfile } = await supabaseAdmin
      .from('rp_profiles')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle()
    const { data: admins } = await supabaseAdmin
      .from('rp_user_roles')
      .select('user_id')
      .in('role', ['cfi_admin', 'super_admin'])
    const adminIds = Array.from(new Set((admins ?? []).map((a) => a.user_id)))
    if (adminIds.length) {
      await supabaseAdmin.from('rp_notifications').insert(
        adminIds.map((aid) => ({
          recipient_id: aid,
          title: `New team creation request from ${mentorProfile?.full_name ?? mentorProfile?.email ?? 'a mentor'}`,
          message: `Team "${data.teamName}" — leader: ${data.leaderEmail}. Awaiting approval.`,
          type: 'mentor_team_request',
          related_entity_type: 'rp_mentor_team_requests',
          related_entity_id: inserted.id,
          action_link: '/rakshak-platform/admin/access-requests',
        })),
      )
    }

    return { id: inserted.id, status: 'pending' as const }
  })

export const listMyMentorTeamRequests = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context
    const { data, error } = await supabase
      .from('rp_mentor_team_requests')
      .select('id, team_name, leader_email, member_emails, college, city, state, status, admin_notes, created_at, reviewed_at, created_team_id')
      .eq('mentor_profile_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  })

export const listMentorTeamRequests = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context
    const { data: isAdmin } = await supabase.rpc('rp_is_admin', { _user_id: userId })
    if (!isAdmin) throw new Error('Forbidden')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: rows, error } = await supabaseAdmin
      .from('rp_mentor_team_requests')
      .select('id, mentor_profile_id, team_name, leader_email, member_emails, college, city, state, status, admin_notes, created_at, reviewed_at, created_team_id')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) throw error
    const mentorIds = Array.from(new Set((rows ?? []).map((r) => r.mentor_profile_id)))
    const { data: profs } = mentorIds.length
      ? await supabaseAdmin.from('rp_profiles').select('id, full_name, email').in('id', mentorIds)
      : { data: [] as any[] }
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]))
    return (rows ?? []).map((r) => ({
      ...r,
      mentor_name: map.get(r.mentor_profile_id)?.full_name ?? null,
      mentor_email: map.get(r.mentor_profile_id)?.email ?? null,
    }))
  })

const decideSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().trim().min(3).max(2000),
})

export const decideMentorTeamRequest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => decideSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const { data: isAdmin } = await supabase.rpc('rp_is_admin', { _user_id: userId })
    if (!isAdmin) throw new Error('Forbidden')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: req, error: reqErr } = await supabaseAdmin
      .from('rp_mentor_team_requests')
      .select('*')
      .eq('id', data.requestId)
      .maybeSingle()
    if (reqErr) throw reqErr
    if (!req) throw new Error('Request not found.')
    if (req.status !== 'pending') throw new Error('Already decided.')

    let createdTeamId: string | null = null

    if (data.decision === 'approved') {
      const { data: leaderProfile } = await supabaseAdmin
        .from('rp_profiles')
        .select('id, full_name, email, city, state')
        .ilike('email', req.leader_email)
        .maybeSingle()
      if (!leaderProfile) throw new Error('Leader account not found.')
      const { data: leaderHasRole } = await supabaseAdmin.rpc('rp_has_role', {
        _user_id: leaderProfile.id,
        _role: 'team_leader',
      })
      if (!leaderHasRole) throw new Error('Leader is not an approved team leader.')

      const { data: mentor } = await supabaseAdmin
        .from('rp_mentors')
        .select('id')
        .eq('profile_id', req.mentor_profile_id)
        .maybeSingle()
      if (!mentor) throw new Error('Mentor record not found.')

      const { data: cohort } = await supabaseAdmin
        .from('rp_cohorts')
        .select('id')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!cohort) throw new Error('No active cohort available. Create one first.')

      const { data: team, error: teamErr } = await supabaseAdmin
        .from('rp_teams')
        .insert({
          cohort_id: cohort.id,
          team_name: req.team_name,
          college: req.college ?? null,
          city: req.city ?? leaderProfile.city ?? null,
          state: req.state ?? leaderProfile.state ?? null,
          team_leader_id: leaderProfile.id,
          assigned_mentor_id: mentor.id,
          status: 'active',
        })
        .select('id')
        .single()
      if (teamErr) throw teamErr
      createdTeamId = team.id

      await supabaseAdmin.from('rp_team_members').insert({
        team_id: team.id,
        profile_id: leaderProfile.id,
        full_name: leaderProfile.full_name ?? leaderProfile.email ?? 'Team Leader',
        email: leaderProfile.email,
        role_in_team: 'leader',
      })

      const memberEmails: string[] = Array.isArray(req.member_emails) ? req.member_emails : []
      for (const em of memberEmails) {
        const { data: mp } = await supabaseAdmin
          .from('rp_profiles')
          .select('id, full_name, email')
          .ilike('email', em)
          .maybeSingle()
        await supabaseAdmin.from('rp_team_members').insert({
          team_id: team.id,
          profile_id: mp?.id ?? null,
          full_name: mp?.full_name ?? em,
          email: mp?.email ?? em,
          role_in_team: 'member',
        })
      }
    }

    const { error: updErr } = await supabaseAdmin
      .from('rp_mentor_team_requests')
      .update({
        status: data.decision,
        admin_notes: data.notes,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        created_team_id: createdTeamId,
      })
      .eq('id', data.requestId)
    if (updErr) throw updErr

    await supabaseAdmin.from('rp_notifications').insert({
      recipient_id: req.mentor_profile_id,
      title:
        data.decision === 'approved'
          ? `Team "${req.team_name}" approved`
          : `Team "${req.team_name}" rejected`,
      message:
        data.decision === 'approved'
          ? `Your team has been created with leader ${req.leader_email}.`
          : `Reason: ${data.notes}`,
      type: 'mentor_team_request_' + data.decision,
      related_entity_type: 'rp_mentor_team_requests',
      related_entity_id: req.id,
      action_link: '/rakshak-platform/mentor',
    })

    return { ok: true, decision: data.decision, teamId: createdTeamId }
  })

/* ──────────────────────────────────────────────────────────────────── */
/* Admin: direct team creation (no email restriction)                    */
/* ──────────────────────────────────────────────────────────────────── */

const adminCreateSchema = z.object({
  teamName: z.string().trim().min(2).max(120),
  leaderEmail: z.string().trim().toLowerCase().email().max(255),
  memberEmails: emailList.optional(),
  mentorEmail: z.string().trim().toLowerCase().email().max(255).optional().or(z.literal('')),
  cohortId: z.string().uuid().optional(),
  college: z.string().trim().max(160).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(80).optional().nullable(),
})

export const adminCreateTeamDirect = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => adminCreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const { data: isAdmin } = await supabase.rpc('rp_is_admin', { _user_id: userId })
    if (!isAdmin) throw new Error('Forbidden')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // Resolve cohort (most recent active if not supplied)
    let cohortId = data.cohortId
    if (!cohortId) {
      const { data: cohort } = await supabaseAdmin
        .from('rp_cohorts')
        .select('id')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!cohort) throw new Error('No active cohort available. Create one first.')
      cohortId = cohort.id
    }

    // Resolve or invite leader
    const { data: leaderProfile } = await supabaseAdmin
      .from('rp_profiles')
      .select('id, full_name, email, city, state')
      .ilike('email', data.leaderEmail)
      .maybeSingle()
    if (!leaderProfile) {
      // Issue a role invite so when they sign up, the role is auto-granted
      await supabaseAdmin
        .from('rp_role_invites')
        .insert({ email: data.leaderEmail, role: 'team_leader', invited_by: userId, note: 'Auto-invited from team creation' })
        .select('id')
        .maybeSingle()
        .then(() => null, () => null) // ignore dupe-pending
    } else {
      // Ensure role granted
      await supabaseAdmin
        .from('rp_user_roles')
        .insert({ user_id: leaderProfile.id, role: 'team_leader' })
        .select('id')
        .maybeSingle()
        .then(() => null, () => null)
    }

    // Resolve mentor (optional)
    let assignedMentorId: string | null = null
    if (data.mentorEmail) {
      const { data: mp } = await supabaseAdmin
        .from('rp_profiles')
        .select('id')
        .ilike('email', data.mentorEmail)
        .maybeSingle()
      if (mp) {
        const { data: mentorRow } = await supabaseAdmin
          .from('rp_mentors')
          .select('id')
          .eq('profile_id', mp.id)
          .maybeSingle()
        if (mentorRow) assignedMentorId = mentorRow.id
      }
      if (!assignedMentorId) {
        throw new Error(`No mentor record found for "${data.mentorEmail}".`)
      }
    }

    const { data: team, error: teamErr } = await supabaseAdmin
      .from('rp_teams')
      .insert({
        cohort_id: cohortId,
        team_name: data.teamName,
        college: data.college ?? null,
        city: data.city ?? leaderProfile?.city ?? null,
        state: data.state ?? leaderProfile?.state ?? null,
        team_leader_id: leaderProfile?.id ?? null,
        assigned_mentor_id: assignedMentorId,
        status: 'active',
      })
      .select('id')
      .single()
    if (teamErr) throw teamErr

    // Leader as team member
    await supabaseAdmin.from('rp_team_members').insert({
      team_id: team.id,
      profile_id: leaderProfile?.id ?? null,
      full_name: leaderProfile?.full_name ?? data.leaderEmail,
      email: leaderProfile?.email ?? data.leaderEmail,
      role_in_team: 'leader',
    })

    // Members (any email — invite if needed)
    const memberEmails = Array.from(
      new Set((data.memberEmails ?? []).filter((e) => e && e !== data.leaderEmail)),
    )
    for (const em of memberEmails) {
      const { data: mp } = await supabaseAdmin
        .from('rp_profiles')
        .select('id, full_name, email')
        .ilike('email', em)
        .maybeSingle()
      if (!mp) {
        await supabaseAdmin
          .from('rp_role_invites')
          .insert({ email: em, role: 'team_member', invited_by: userId, note: 'Auto-invited from team creation' })
          .select('id')
          .maybeSingle()
          .then(() => null, () => null)
      } else {
        await supabaseAdmin
          .from('rp_user_roles')
          .insert({ user_id: mp.id, role: 'team_member' })
          .select('id')
          .maybeSingle()
          .then(() => null, () => null)
      }
      await supabaseAdmin.from('rp_team_members').insert({
        team_id: team.id,
        profile_id: mp?.id ?? null,
        full_name: mp?.full_name ?? em,
        email: mp?.email ?? em,
        role_in_team: 'member',
      })
    }

    return { ok: true, teamId: team.id }
  })
