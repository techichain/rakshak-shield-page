// Mass email server functions — admin only.
// Resolves an audience against RP tables, then enqueues one transactional email
// per recipient into the pgmq `transactional_emails` queue. Reuses the existing
// suppression list + unsubscribe token machinery.

import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'
import * as React from 'react'
import { render } from '@react-email/components'
import { TEMPLATES } from '@/lib/email-templates/registry'

// Baked into transactional/send.ts — keep in sync.
const SITE_NAME = 'rakshak-crashfreeindia'
const SENDER_DOMAIN = 'notify.rakshak.crashfreeindia.org'
const FROM_DOMAIN = 'rakshak.crashfreeindia.org'
const MAX_RECIPIENTS = 1000

const AUDIENCE_TYPES = [
  'team_leaders',
  'team_members',
  'team_and_mentor',
  'all_mentors',
  'all_evaluators',
  'custom_emails',
] as const

const audienceSchema = z.object({
  type: z.enum(AUDIENCE_TYPES),
  cohortId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  emails: z.array(z.string().email()).max(MAX_RECIPIENTS).optional(),
})

type Recipient = {
  email: string
  name: string
  team_name?: string
  cohort_name?: string
}

function tokenHex(): string {
  const b = new Uint8Array(32)
  crypto.getRandomValues(b)
  return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('')
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from('rp_user_roles')
    .select('role')
    .eq('user_id', userId)
  const ok = (data ?? []).some((r: any) =>
    ['cfi_admin', 'super_admin'].includes(r.role),
  )
  if (!ok) throw new Error('Forbidden: admin only')
}

async function resolve(
  admin: any,
  audience: z.infer<typeof audienceSchema>,
): Promise<Recipient[]> {
  const seen = new Set<string>()
  const out: Recipient[] = []
  const push = (r: Recipient) => {
    const key = r.email.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      out.push({ ...r, email: key })
    }
  }

  // Custom pasted email list
  if (audience.type === 'custom_emails') {
    for (const e of audience.emails ?? []) push({ email: e, name: e.split('@')[0] })
    return out.slice(0, MAX_RECIPIENTS)
  }

  // Load team scope
  let teamQuery = admin
    .from('rp_teams')
    .select('id, team_name, cohort_id, team_leader_id, assigned_mentor_id, rp_cohorts(name)')
  if (audience.teamId) teamQuery = teamQuery.eq('id', audience.teamId)
  else if (audience.cohortId) teamQuery = teamQuery.eq('cohort_id', audience.cohortId)
  const { data: teams } = await teamQuery
  const teamRows = (teams ?? []) as any[]
  const teamById = new Map(teamRows.map((t) => [t.id, t]))

  if (audience.type === 'team_leaders' || audience.type === 'team_members' || audience.type === 'team_and_mentor') {
    const leaderIds = teamRows.map((t) => t.team_leader_id).filter(Boolean) as string[]

    // Fetch team members
    let members: any[] = []
    if ((audience.type === 'team_members') && teamRows.length) {
      const { data } = await admin
        .from('rp_team_members')
        .select('team_id, email, name, profile_id')
        .in('team_id', teamRows.map((t) => t.id))
      members = data ?? []
    }

    // Look up leader emails from auth.users
    let leaderEmailById = new Map<string, string>()
    let leaderNameById = new Map<string, string>()
    if (leaderIds.length) {
      const { data: profs } = await admin
        .from('rp_profiles')
        .select('user_id, full_name')
        .in('user_id', leaderIds)
      for (const p of profs ?? []) leaderNameById.set(p.user_id, p.full_name ?? '')
      // Email via auth admin
      for (const uid of leaderIds) {
        try {
          const { data } = await admin.auth.admin.getUserById(uid)
          if (data?.user?.email) leaderEmailById.set(uid, data.user.email)
        } catch { /* ignore */ }
      }
    }

    for (const t of teamRows) {
      const cohort_name = t.rp_cohorts?.name
      if (t.team_leader_id) {
        const e = leaderEmailById.get(t.team_leader_id)
        if (e) push({ email: e, name: leaderNameById.get(t.team_leader_id) || 'Team Leader', team_name: t.team_name, cohort_name })
      }
      if (audience.type === 'team_members') {
        for (const m of members.filter((x) => x.team_id === t.id)) {
          if (m.email) push({ email: m.email, name: m.name || 'Team member', team_name: t.team_name, cohort_name })
        }
      }
    }

    if (audience.type === 'team_and_mentor') {
      const mentorProfileIds = new Set<string>()
      const mentorIds = teamRows.map((t) => t.assigned_mentor_id).filter(Boolean) as string[]
      if (mentorIds.length) {
        const { data: mentors } = await admin
          .from('rp_mentors')
          .select('id, profile_id, name')
          .in('id', mentorIds)
        for (const m of mentors ?? []) if (m.profile_id) mentorProfileIds.add(m.profile_id)
        const mentorByTeamId = new Map<string, any>()
        for (const t of teamRows) {
          const m = (mentors ?? []).find((x: any) => x.id === t.assigned_mentor_id)
          if (m) mentorByTeamId.set(t.id, m)
        }
        for (const t of teamRows) {
          const m = mentorByTeamId.get(t.id)
          if (m?.profile_id) {
            try {
              const { data } = await admin.auth.admin.getUserById(m.profile_id)
              if (data?.user?.email) push({ email: data.user.email, name: m.name || 'Mentor', team_name: t.team_name, cohort_name: t.rp_cohorts?.name })
            } catch { /* ignore */ }
          }
        }
      }
    }
    return out.slice(0, MAX_RECIPIENTS)
  }

  if (audience.type === 'all_mentors') {
    const { data: mentors } = await admin.from('rp_mentors').select('profile_id, name')
    for (const m of mentors ?? []) {
      if (!m.profile_id) continue
      try {
        const { data } = await admin.auth.admin.getUserById(m.profile_id)
        if (data?.user?.email) push({ email: data.user.email, name: m.name || 'Mentor' })
      } catch { /* ignore */ }
    }
    return out.slice(0, MAX_RECIPIENTS)
  }

  if (audience.type === 'all_evaluators') {
    const { data: roles } = await admin
      .from('rp_user_roles')
      .select('user_id')
      .eq('role', 'evaluator')
    for (const r of roles ?? []) {
      try {
        const { data } = await admin.auth.admin.getUserById(r.user_id)
        if (data?.user?.email) {
          const name = data.user.user_metadata?.name || data.user.email.split('@')[0]
          push({ email: data.user.email, name })
        }
      } catch { /* ignore */ }
    }
    return out.slice(0, MAX_RECIPIENTS)
  }

  return out
}

/** Preview recipients (count + first 10) without sending. */
export const previewMassEmailAudience = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ audience: audienceSchema }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const recipients = await resolve(supabaseAdmin, data.audience)
    return {
      count: recipients.length,
      preview: recipients.slice(0, 10).map((r) => ({ email: r.email, name: r.name, team_name: r.team_name })),
      capped: recipients.length >= MAX_RECIPIENTS,
    }
  })

const sendSchema = z.object({
  templateName: z.enum(['admin-deadline-team', 'admin-deadline-mentor', 'admin-deadline-evaluator']),
  audience: audienceSchema,
  mergeFields: z.object({
    phase_number: z.string().optional(),
    deliverable: z.string().optional(),
    deadline_date: z.string().min(1),
    custom_message: z.string().max(2000).optional(),
    cta_url: z.string().url().optional(),
  }),
  subjectOverride: z.string().max(200).optional(),
  testRecipient: z.string().email().optional(),
})

async function enqueueOne(
  admin: any,
  templateName: string,
  recipient: Recipient,
  mergeFields: Record<string, any>,
  subjectOverride: string | undefined,
  senderName: string,
  campaignId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const template = TEMPLATES[templateName]
  if (!template) return { ok: false, reason: 'template_not_found' }

  const normalized = recipient.email.toLowerCase()
  const messageId = crypto.randomUUID()

  // Suppression check
  const { data: suppressed } = await admin
    .from('suppressed_emails').select('id').eq('email', normalized).maybeSingle()
  if (suppressed) {
    await admin.from('email_send_log').insert({
      message_id: messageId, template_name: templateName, recipient_email: recipient.email,
      status: 'suppressed', metadata: { campaign_id: campaignId },
    })
    return { ok: false, reason: 'suppressed' }
  }

  // Unsubscribe token (reuse or create)
  let unsubscribeToken: string
  const { data: existing } = await admin
    .from('email_unsubscribe_tokens').select('token, used_at').eq('email', normalized).maybeSingle()
  if (existing && !existing.used_at) {
    unsubscribeToken = existing.token
  } else if (!existing) {
    unsubscribeToken = tokenHex()
    await admin.from('email_unsubscribe_tokens').upsert(
      { token: unsubscribeToken, email: normalized },
      { onConflict: 'email', ignoreDuplicates: true },
    )
    const { data: re } = await admin
      .from('email_unsubscribe_tokens').select('token').eq('email', normalized).maybeSingle()
    unsubscribeToken = re?.token ?? unsubscribeToken
  } else {
    return { ok: false, reason: 'token_used' }
  }

  const templateData: Record<string, any> = {
    ...mergeFields,
    recipient_name: recipient.name,
    team_name: recipient.team_name,
    cohort_name: recipient.cohort_name,
    sender_name: senderName,
  }

  const element = React.createElement(template.component as any, templateData)
  const html = await render(element)
  const plainText = await render(element, { plainText: true })
  const subject = subjectOverride
    ? subjectOverride
    : typeof template.subject === 'function' ? template.subject(templateData) : template.subject

  await admin.from('email_send_log').insert({
    message_id: messageId, template_name: templateName, recipient_email: recipient.email,
    status: 'pending', metadata: { campaign_id: campaignId },
  })

  const { error } = await admin.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: recipient.email,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: `${campaignId}:${normalized}`,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (error) {
    await admin.from('email_send_log').insert({
      message_id: messageId, template_name: templateName, recipient_email: recipient.email,
      status: 'failed', error_message: 'Failed to enqueue', metadata: { campaign_id: campaignId },
    })
    return { ok: false, reason: 'enqueue_failed' }
  }
  return { ok: true }
}

/** Send test email to a single address (no campaign record). */
export const sendMassEmailTest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sendSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId)
    if (!data.testRecipient) throw new Error('testRecipient required')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: prof } = await context.supabase
      .from('rp_profiles').select('full_name').eq('user_id', context.userId).maybeSingle()
    const senderName = (prof as any)?.full_name || 'Rakshak Admin'
    const result = await enqueueOne(
      supabaseAdmin,
      data.templateName,
      { email: data.testRecipient, name: 'Test recipient' },
      data.mergeFields,
      data.subjectOverride,
      senderName,
      `test-${crypto.randomUUID()}`,
    )
    return result
  })

/** Resolve audience → create campaign → enqueue every recipient. */
export const sendMassEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sendSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const recipients = await resolve(supabaseAdmin, data.audience)
    if (recipients.length === 0) throw new Error('No recipients matched')
    if (recipients.length > MAX_RECIPIENTS) throw new Error(`Too many recipients (max ${MAX_RECIPIENTS})`)

    const { data: prof } = await context.supabase
      .from('rp_profiles').select('full_name').eq('user_id', context.userId).maybeSingle()
    const senderName = (prof as any)?.full_name || 'Rakshak Admin'

    const { data: campaign, error: campErr } = await context.supabase
      .from('rp_email_campaigns')
      .insert({
        template_name: data.templateName,
        subject_override: data.subjectOverride ?? null,
        audience: data.audience as any,
        merge_fields: data.mergeFields as any,
        status: 'sending',
        recipient_count: recipients.length,
        created_by: context.userId,
      })
      .select('id')
      .single()
    if (campErr || !campaign) throw new Error(campErr?.message || 'Failed to create campaign')

    let success = 0
    let failed = 0
    for (const r of recipients) {
      const res = await enqueueOne(
        supabaseAdmin, data.templateName, r, data.mergeFields, data.subjectOverride, senderName, campaign.id,
      )
      if (res.ok) success++
      else failed++
    }

    await context.supabase
      .from('rp_email_campaigns')
      .update({
        status: failed === recipients.length ? 'failed' : 'sent',
        sent_at: new Date().toISOString(),
        success_count: success,
        failed_count: failed,
      })
      .eq('id', campaign.id)

    return { campaignId: campaign.id, total: recipients.length, success, failed }
  })

/** List cohorts + teams for the compose form. */
export const listMassEmailScopes = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId)
    const [{ data: cohorts }, { data: teams }] = await Promise.all([
      context.supabase.from('rp_cohorts').select('id, name').order('name'),
      context.supabase.from('rp_teams').select('id, team_name, cohort_id').order('team_name'),
    ])
    return { cohorts: cohorts ?? [], teams: teams ?? [] }
  })

/** List recent campaigns for log view. */
export const listMassEmailCampaigns = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId)
    const { data } = await context.supabase
      .from('rp_email_campaigns')
      .select('id, template_name, subject_override, audience, status, recipient_count, success_count, failed_count, sent_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    return { campaigns: data ?? [] }
  })
