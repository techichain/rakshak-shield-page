// Server-only helper to notify all CFI/super admins about a new role-access
// request — via in-app notifications AND a transactional email per admin.
import * as React from 'react'
import { render } from '@react-email/components'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'rakshak-crashfreeindia'
const SENDER_DOMAIN = 'notify.rakshak.crashfreeindia.org'
const FROM_DOMAIN = 'rakshak.crashfreeindia.org'
const REVIEW_URL =
  'https://rakshak.crashfreeindia.org/rakshak-platform/admin/access-requests'

const ROLE_LABEL: Record<string, string> = {
  mentor: 'Mentor',
  evaluator: 'Evaluator',
  team_leader: 'Team Leader',
  team: 'Team Leader',
  cfi_admin: 'CFI Admin',
  super_admin: 'Super Admin',
}

function normalizeRole(role: string) {
  return role === 'team' ? 'team_leader' : role
}

export async function notifyAdminsOfRoleRequest(args: {
  requesterId: string
  requesterName: string
  requesterEmail: string
  requestedRole: string
  notes?: string | null
  source?: string
  approvalId?: string
}) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const requestedRole = normalizeRole(args.requestedRole)
  const roleLabel = ROLE_LABEL[requestedRole] ?? requestedRole

  // 1. Find every admin recipient
  const { data: admins, error: adminsError } = await supabaseAdmin
    .from('rp_user_roles')
    .select('user_id')
    .in('role', ['cfi_admin', 'super_admin'])
  if (adminsError) throw adminsError
  const adminIds = Array.from(new Set((admins ?? []).map((a) => a.user_id)))
  if (adminIds.length === 0) return { notified: 0, emailed: 0 }

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('rp_profiles')
    .select('id, full_name, email')
    .in('id', adminIds)
  if (profilesError) throw profilesError

  // 2. In-app notification rows for every admin
  const title = `New ${roleLabel} access request`
  const message = `${args.requesterName || args.requesterEmail || 'A user'} requested ${roleLabel} access.`
  const existingNotified = new Set<string>()
  if (args.approvalId) {
    const { data: existingNotifications } = await supabaseAdmin
      .from('rp_notifications')
      .select('recipient_id')
      .eq('related_entity_type', 'rp_role_approvals')
      .eq('related_entity_id', args.approvalId)
      .eq('type', 'role_request')
      .in('recipient_id', adminIds)
    for (const n of existingNotifications ?? []) existingNotified.add((n as any).recipient_id)
  }

  let notified = 0
  for (const rid of adminIds) {
    if (existingNotified.has(rid)) continue
    const { error: notifyError } = await supabaseAdmin.from('rp_notifications').insert({
      recipient_id: rid,
      title,
      message,
      type: 'role_request',
      related_entity_type: 'rp_role_approvals',
      related_entity_id: args.approvalId ?? null,
      action_link: '/rakshak-platform/admin/access-requests',
    })
    if (notifyError) {
      console.error('rp admin in-app notification failed', { adminId: rid, approvalId: args.approvalId, error: notifyError.message })
    } else {
      notified++
    }
  }

  // 3. Render email once, enqueue per admin recipient
  const template = TEMPLATES['rp-admin-role-request']
  if (!template) return { notified, emailed: 0 }

  let emailed = 0
  for (const p of profiles ?? []) {
    if (!p.email) continue
    if (args.approvalId) {
      const { data: existingEmail } = await supabaseAdmin
        .from('email_send_log')
        .select('id')
        .eq('template_name', 'rp-admin-role-request')
        .eq('recipient_email', p.email)
        .contains('metadata', { approval_id: args.approvalId })
        .limit(1)
        .maybeSingle()
      if (existingEmail) continue
    }
    const element = React.createElement(template.component, {
      admin_name: p.full_name ?? 'Admin',
      requester_name: args.requesterName,
      requester_email: args.requesterEmail,
      requested_role: requestedRole,
      notes: args.notes ?? undefined,
      review_url: REVIEW_URL,
      source: args.source ?? 'self-signup',
    })
    const html = await render(element)
    const plainText = await render(element, { plainText: true })
    const subject =
      typeof template.subject === 'function'
        ? template.subject({ requested_role: requestedRole })
        : template.subject
    const messageId = crypto.randomUUID()

    const { error: logError } = await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'rp-admin-role-request',
      recipient_email: p.email,
      status: 'pending',
      metadata: { approval_id: args.approvalId ?? null, requester_id: args.requesterId, role: requestedRole },
    })
    if (logError) console.error('rp admin email log insert failed', { recipient: p.email, approvalId: args.approvalId, error: logError.message })

    const { error } = await supabaseAdmin.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to: p.email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text: plainText,
        purpose: 'transactional',
        label: 'rp-admin-role-request',
        idempotency_key: messageId,
        queued_at: new Date().toISOString(),
      },
    })
    if (!error) emailed++
    else {
      await supabaseAdmin
        .from('email_send_log')
        .update({ status: 'failed', error_message: error.message })
        .eq('message_id', messageId)
      console.error('rp admin email enqueue failed', { recipient: p.email, approvalId: args.approvalId, error: error.message })
    }
  }

  return { notified, emailed }
}
