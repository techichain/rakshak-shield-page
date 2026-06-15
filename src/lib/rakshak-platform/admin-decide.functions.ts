import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const inputSchema = z.object({
  approvalId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().min(1, 'Decision notes are required').max(2000),
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

export const decideRoleApproval = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context

    // 1. Authorize: caller must be an admin
    const { data: isAdmin, error: adminErr } = await supabase.rpc('rp_is_admin', {
      _user_id: userId,
    })
    if (adminErr) throw adminErr
    if (!isAdmin) throw new Error('Forbidden — admin role required')

    if (!data.reason?.trim()) {
      throw new Error('Decision notes are required.')
    }

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // 2. Load the approval row + requester profile
    const { data: approval, error: approvalErr } = await supabaseAdmin
      .from('rp_role_approvals')
      .select('id, user_id, requested_role, status, notes')
      .eq('id', data.approvalId)
      .maybeSingle()
    if (approvalErr) throw approvalErr
    if (!approval) throw new Error('Approval request not found.')
    if (approval.status !== 'pending') {
      throw new Error(`This request has already been ${approval.status}.`)
    }

    const { data: requester } = await supabaseAdmin
      .from('rp_profiles')
      .select('id, full_name, email')
      .eq('id', approval.user_id)
      .maybeSingle()

    const { data: reviewer } = await supabaseAdmin
      .from('rp_profiles')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle()

    const requestedRole = approval.requested_role as string
    const reviewedAt = new Date().toISOString()

    // 3. On approve: grant the role (and mentor row if applicable)
    if (data.decision === 'approved') {
      const { error: roleErr } = await supabaseAdmin
        .from('rp_user_roles')
        .upsert(
          { user_id: approval.user_id, role: requestedRole as any },
          { onConflict: 'user_id,role' }
        )
      if (roleErr && !String(roleErr.message).includes('duplicate')) throw roleErr

      if (requestedRole === 'mentor') {
        await supabaseAdmin
          .from('rp_mentors')
          .upsert({ profile_id: approval.user_id }, { onConflict: 'profile_id' })
      }

      // Pre-stage a role invite keyed by email so any future sign-in / re-onboard
      // also picks up the role via the rp_tg_apply_role_invites trigger.
      if (requester?.email) {
        await supabaseAdmin.from('rp_role_invites').insert({
          email: requester.email,
          role: requestedRole as any,
          status: 'accepted',
          accepted_user_id: approval.user_id,
          invited_by: userId,
          reviewed_at: reviewedAt,
          note: `Auto-issued on approval of ${requestedRole} request ${approval.id}.`,
        })
      }
    }

    // 4. Update the approval row — notes capture the reject reason for audit + email
    const mergedNotes =
      data.decision === 'rejected'
        ? `${approval.notes ? approval.notes + '\n\n' : ''}Reject reason: ${data.reason}`
        : approval.notes
    const { error: updErr } = await supabaseAdmin
      .from('rp_role_approvals')
      .update({
        status: data.decision,
        reviewed_at: reviewedAt,
        reviewed_by: userId,
        notes: mergedNotes,
      })
      .eq('id', approval.id)
    if (updErr) throw updErr
    // rp_tg_audit_role_approvals already writes to rp_audit_logs with actor + status + notes.

    // 5. Notify the requester via email (best-effort; never block the decision)
    let emailed = false
    if (requester?.email) {
      try {
        const React = await import('react')
        const { render } = await import('@react-email/components')
        const { TEMPLATES } = await import('@/lib/email-templates/registry')
        const tpl = TEMPLATES['rp-role-decision']
        if (tpl) {
          const portalUrl = `${PORTAL_BASE}${ROLE_LANDING[requestedRole] ?? '/rakshak-platform/dashboard'}`
          const element = React.createElement(tpl.component, {
            requester_name: requester.full_name ?? requester.email.split('@')[0],
            requested_role: requestedRole,
            decision: data.decision,
            reason: data.reason ?? undefined,
            reviewer_name: reviewer?.full_name ?? reviewer?.email ?? 'Admin',
            reviewed_at: new Date(reviewedAt).toLocaleString(),
            portal_url: portalUrl,
          })
          const html = await render(element)
          const plainText = await render(element, { plainText: true })
          const subject =
            typeof tpl.subject === 'function'
              ? tpl.subject({ requested_role: requestedRole, decision: data.decision })
              : tpl.subject
          const messageId = crypto.randomUUID()

          await supabaseAdmin.from('email_send_log').insert({
            message_id: messageId,
            template_name: 'rp-role-decision',
            recipient_email: requester.email,
            status: 'pending',
          })

          const { error: enqErr } = await supabaseAdmin.rpc('enqueue_email', {
            queue_name: 'transactional_emails',
            payload: {
              message_id: messageId,
              to: requester.email,
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
          } else {
            emailed = true
          }
        }
      } catch (err) {
        console.error('rp-role-decision email failed', err)
      }
    }

    return {
      ok: true,
      decision: data.decision,
      role: requestedRole,
      emailed,
    }
  })
