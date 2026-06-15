import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const inputSchema = z.object({
  approvalId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().min(1, 'Decision notes are required').max(2000),
})

const bulkInputSchema = z.object({
  approvalIds: z.array(z.string().uuid()).min(1).max(100),
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().min(1, 'Decision notes are required').max(2000),
})

const resendInputSchema = z.object({
  approvalId: z.string().uuid(),
})

const SITE_NAME = 'rakshak-crashfreeindia'
const SENDER_DOMAIN = 'notify.rakshak.crashfreeindia.org'
const FROM_DOMAIN = 'rakshak.crashfreeindia.org'
const PORTAL_BASE = 'https://rakshak.crashfreeindia.org'

const ROLE_LANDING: Record<string, string> = {
  mentor: '/rakshak-platform/mentor',
  evaluator: '/rakshak-platform/evaluator',
  team_leader: '/rakshak-platform/team',
  cfi_admin: '/rakshak-platform/admin',
  super_admin: '/rakshak-platform/admin',
}

function normalizeRequestedRole(role: string) {
  return role === 'team' ? 'team_leader' : role
}

// In-process rate limiter: max 30 decisions per admin per minute.
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30
const decisionRate = new Map<string, number[]>()
function rateLimit(adminId: string) {
  const now = Date.now()
  const arr = (decisionRate.get(adminId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (arr.length >= RATE_LIMIT_MAX) {
    throw new Error('Too many decisions in the last minute. Please slow down and try again.')
  }
  arr.push(now)
  decisionRate.set(adminId, arr)
}

async function sendDecisionEmail(
  supabaseAdmin: any,
  args: {
    approvalId: string
    requesterEmail: string
    requesterName: string | null
    requestedRole: string
    decision: 'approved' | 'rejected'
    reason: string
    reviewerName: string | null
    reviewerId: string
    reviewedAt: string
    auditLog?: boolean
  },
): Promise<{ emailed: boolean; messageId: string | null; error: string | null }> {
  try {
    const React = await import('react')
    const { render } = await import('@react-email/components')
    const { TEMPLATES } = await import('@/lib/email-templates/registry')
    const tpl = TEMPLATES['rp-role-decision']
    if (!tpl) return { emailed: false, messageId: null, error: 'Template missing' }

    const portalUrl = `${PORTAL_BASE}${ROLE_LANDING[args.requestedRole] ?? '/rakshak-platform/dashboard'}`
    const element = React.createElement(tpl.component, {
      requester_name: args.requesterName ?? args.requesterEmail.split('@')[0],
      requested_role: args.requestedRole,
      decision: args.decision,
      reason: args.reason,
      reviewer_name: args.reviewerName ?? 'Admin',
      reviewed_at: new Date(args.reviewedAt).toLocaleString(),
      portal_url: portalUrl,
    })
    const html = await render(element)
    const plainText = await render(element, { plainText: true })
    const subject =
      typeof tpl.subject === 'function'
        ? tpl.subject({ requested_role: args.requestedRole, decision: args.decision })
        : tpl.subject
    const messageId = crypto.randomUUID()

    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'rp-role-decision',
      recipient_email: args.requesterEmail,
      status: 'pending',
      metadata: { approval_id: args.approvalId, decision: args.decision, role: args.requestedRole },
    })

    const { error: enqErr } = await supabaseAdmin.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to: args.requesterEmail,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text: plainText,
        purpose: 'transactional',
        label: 'rp-role-decision',
        idempotency_key: messageId,
        queued_at: new Date().toISOString(),
      },
    })
    if (enqErr) {
      await supabaseAdmin
        .from('email_send_log')
        .update({ status: 'failed', error_message: enqErr.message })
        .eq('message_id', messageId)
    }

    if (args.auditLog !== false) {
      await supabaseAdmin.from('rp_audit_logs').insert({
        actor_id: args.reviewerId,
        action: enqErr ? 'role_approval_email_failed' : 'role_approval_email_queued',
        entity_type: 'rp_role_approvals',
        entity_id: args.approvalId,
        new_value: {
          message_id: messageId,
          recipient_email: args.requesterEmail,
          template: 'rp-role-decision',
          error: enqErr?.message ?? null,
        },
      })
    }

    return { emailed: !enqErr, messageId, error: enqErr?.message ?? null }
  } catch (err) {
    console.error('rp-role-decision email failed', err)
    return { emailed: false, messageId: null, error: err instanceof Error ? err.message : String(err) }
  }
}

async function applyDecision(
  supabaseAdmin: any,
  approvalId: string,
  decision: 'approved' | 'rejected',
  reason: string,
  reviewerId: string,
  reviewerProfile: { full_name: string | null; email: string | null } | null,
): Promise<{ ok: boolean; emailed: boolean; skipped?: string }> {
  const { data: approval, error: approvalErr } = await supabaseAdmin
    .from('rp_role_approvals')
    .select('id, user_id, requested_role, status, notes')
    .eq('id', approvalId)
    .maybeSingle()
  if (approvalErr) throw approvalErr
  if (!approval) return { ok: false, emailed: false, skipped: 'not_found' }

  // Idempotency: if already decided, skip silently (so duplicate clicks no-op).
  if (approval.status !== 'pending') {
    return { ok: false, emailed: false, skipped: `already_${approval.status}` }
  }

  const { data: requester } = await supabaseAdmin
    .from('rp_profiles')
    .select('id, full_name, email')
    .eq('id', approval.user_id)
    .maybeSingle()

  const requestedRole = normalizeRequestedRole(approval.requested_role as string)
  const reviewedAt = new Date().toISOString()

  if (decision === 'approved') {
    const { error: roleErr } = await supabaseAdmin
      .from('rp_user_roles')
      .upsert(
        { user_id: approval.user_id, role: requestedRole as any },
        { onConflict: 'user_id,role' },
      )
    if (roleErr && !String(roleErr.message).includes('duplicate')) throw roleErr

    if (requestedRole === 'mentor') {
      await supabaseAdmin
        .from('rp_mentors')
        .upsert({ profile_id: approval.user_id }, { onConflict: 'profile_id' })
    }

    if (requester?.email) {
      const { error: inviteErr } = await supabaseAdmin.from('rp_role_invites').insert({
        email: requester.email,
        role: requestedRole as any,
        status: 'accepted',
        accepted_user_id: approval.user_id,
        invited_by: reviewerId,
        reviewed_by: reviewerId,
        reviewed_at: reviewedAt,
        note: `Auto-issued on approval of ${requestedRole} request ${approval.id}.`,
      })
      if (inviteErr && !String(inviteErr.message).toLowerCase().includes('duplicate')) throw inviteErr
    }
  }

  const noteLabel = decision === 'rejected' ? 'Reject reason' : 'Approval notes'
  const mergedNotes = `${approval.notes ? approval.notes + '\n\n' : ''}${noteLabel}: ${reason}`
  // Conditional update enforces idempotency at the DB level.
  const { data: updated, error: updErr } = await supabaseAdmin
    .from('rp_role_approvals')
    .update({
      status: decision,
      reviewed_at: reviewedAt,
      reviewed_by: reviewerId,
      notes: mergedNotes,
    })
    .eq('id', approval.id)
    .eq('status', 'pending')
    .select('id')
  if (updErr) throw updErr
  if (!updated || updated.length === 0) {
    return { ok: false, emailed: false, skipped: 'race_already_decided' }
  }

  await supabaseAdmin.from('rp_audit_logs').insert({
    actor_id: reviewerId,
    action: `role_approval_${decision}`,
    entity_type: 'rp_role_approvals',
    entity_id: approval.id,
    old_value: { status: approval.status },
    new_value: {
      status: decision,
      role: requestedRole,
      notes: reason,
      reviewed_at: reviewedAt,
    },
  })

  let emailed = false
  if (requester?.email) {
    const res = await sendDecisionEmail(supabaseAdmin, {
      approvalId: approval.id,
      requesterEmail: requester.email,
      requesterName: requester.full_name,
      requestedRole,
      decision,
      reason,
      reviewerName: reviewerProfile?.full_name ?? reviewerProfile?.email ?? 'Admin',
      reviewerId,
      reviewedAt,
    })
    emailed = res.emailed
  }

  return { ok: true, emailed }
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc('rp_is_admin', {
    _user_id: context.userId,
  })
  if (error) throw error
  if (!isAdmin) throw new Error('Forbidden — admin role required')
}

export const decideRoleApproval = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    rateLimit(context.userId)
    if (!data.reason?.trim()) throw new Error('Decision notes are required.')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: reviewer } = await supabaseAdmin
      .from('rp_profiles')
      .select('full_name, email')
      .eq('id', context.userId)
      .maybeSingle()
    const res = await applyDecision(
      supabaseAdmin,
      data.approvalId,
      data.decision,
      data.reason,
      context.userId,
      reviewer ?? null,
    )
    if (!res.ok && res.skipped?.startsWith('already_')) {
      throw new Error(`This request has already been ${res.skipped.replace('already_', '')}.`)
    }
    if (!res.ok && res.skipped === 'not_found') {
      throw new Error('Approval request not found.')
    }
    return { ok: true, decision: data.decision, emailed: res.emailed }
  })

export const bulkDecideRoleApprovals = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => bulkInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    rateLimit(context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: reviewer } = await supabaseAdmin
      .from('rp_profiles')
      .select('full_name, email')
      .eq('id', context.userId)
      .maybeSingle()

    let processed = 0
    let emailed = 0
    let skipped = 0
    const errors: Array<{ id: string; message: string }> = []
    for (const id of data.approvalIds) {
      try {
        const res = await applyDecision(
          supabaseAdmin,
          id,
          data.decision,
          data.reason,
          context.userId,
          reviewer ?? null,
        )
        if (res.ok) {
          processed++
          if (res.emailed) emailed++
        } else {
          skipped++
        }
      } catch (e) {
        errors.push({ id, message: e instanceof Error ? e.message : String(e) })
      }
    }
    return { processed, emailed, skipped, errors, total: data.approvalIds.length }
  })

export const resendDecisionEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => resendInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    rateLimit(context.userId)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: approval } = await supabaseAdmin
      .from('rp_role_approvals')
      .select('id, user_id, requested_role, status, notes, reviewed_at')
      .eq('id', data.approvalId)
      .maybeSingle()
    if (!approval) throw new Error('Approval request not found.')
    if (approval.status === 'pending') {
      throw new Error('This request has not been decided yet — cannot resend a decision email.')
    }

    const { data: requester } = await supabaseAdmin
      .from('rp_profiles')
      .select('id, full_name, email')
      .eq('id', approval.user_id)
      .maybeSingle()
    if (!requester?.email) throw new Error('Requester has no email on file.')

    const { data: reviewer } = await supabaseAdmin
      .from('rp_profiles')
      .select('full_name, email')
      .eq('id', context.userId)
      .maybeSingle()

    // Extract the most recent reason from the notes blob (last "Approval notes:" / "Reject reason:" block).
    const notesText = (approval.notes as string) ?? ''
    const reasonMatch = notesText.match(/(?:Approval notes|Reject reason):\s*([\s\S]*)$/)
    const reason = (reasonMatch?.[1] ?? notesText ?? '').trim() || 'See portal for details.'

    const res = await sendDecisionEmail(supabaseAdmin, {
      approvalId: approval.id,
      requesterEmail: requester.email,
      requesterName: requester.full_name,
      requestedRole: approval.requested_role as string,
      decision: approval.status as 'approved' | 'rejected',
      reason,
      reviewerName: reviewer?.full_name ?? reviewer?.email ?? 'Admin',
      reviewerId: context.userId,
      reviewedAt: approval.reviewed_at ?? new Date().toISOString(),
    })

    await supabaseAdmin.from('rp_audit_logs').insert({
      actor_id: context.userId,
      action: 'role_approval_email_resent',
      entity_type: 'rp_role_approvals',
      entity_id: approval.id,
      new_value: {
        message_id: res.messageId,
        recipient_email: requester.email,
        emailed: res.emailed,
        error: res.error,
      },
    })

    return { emailed: res.emailed, messageId: res.messageId, error: res.error }
  })
