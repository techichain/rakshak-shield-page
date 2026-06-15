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

  // 1. Find every admin recipient
  const { data: admins } = await supabaseAdmin
    .from('rp_user_roles')
    .select('user_id')
    .in('role', ['cfi_admin', 'super_admin'])
  const adminIds = Array.from(new Set((admins ?? []).map((a) => a.user_id)))
  if (adminIds.length === 0) return { notified: 0, emailed: 0 }

  const { data: profiles } = await supabaseAdmin
    .from('rp_profiles')
    .select('id, full_name, email')
    .in('id', adminIds)

  // 2. In-app notification rows for every admin
  const title = `New ${args.requestedRole} access request`
  const message = `${args.requesterName || args.requesterEmail || 'A user'} requested ${args.requestedRole} access.`
  const rows = adminIds.map((rid) => ({
    recipient_id: rid,
    title,
    message,
    type: 'role_request',
    related_entity_type: 'rp_role_approvals',
    related_entity_id: args.approvalId ?? null,
    action_link: '/rakshak-platform/admin/access-requests',
  }))
  await supabaseAdmin.from('rp_notifications').insert(rows)

  // 3. Render email once, enqueue per admin recipient
  const template = TEMPLATES['rp-admin-role-request']
  if (!template) return { notified: rows.length, emailed: 0 }

  let emailed = 0
  for (const p of profiles ?? []) {
    if (!p.email) continue
    const element = React.createElement(template.component, {
      admin_name: p.full_name ?? 'Admin',
      requester_name: args.requesterName,
      requester_email: args.requesterEmail,
      requested_role: args.requestedRole,
      notes: args.notes ?? undefined,
      review_url: REVIEW_URL,
      source: args.source ?? 'self-signup',
    })
    const html = await render(element)
    const plainText = await render(element, { plainText: true })
    const subject =
      typeof template.subject === 'function'
        ? template.subject({ requested_role: args.requestedRole })
        : template.subject
    const messageId = crypto.randomUUID()

    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'rp-admin-role-request',
      recipient_email: p.email,
      status: 'pending',
    })

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
    }
  }

  return { notified: rows.length, emailed }
}
