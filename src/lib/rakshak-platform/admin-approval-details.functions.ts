import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const inputSchema = z.object({
  approvalIds: z.array(z.string().uuid()).min(1).max(100),
})

export type ApprovalAuditEntry = {
  id: string
  action: string
  actor_id: string | null
  actor_name: string | null
  actor_email: string | null
  created_at: string
  old_value: any
  new_value: any
}

export type ApprovalEmailEntry = {
  message_id: string | null
  recipient_email: string
  status: string
  error_message: string | null
  created_at: string
}

export type ApprovalDetails = {
  audit: Record<string, ApprovalAuditEntry[]>
  emails: Record<string, ApprovalEmailEntry[]>
}

export const getApprovalDetails = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<ApprovalDetails> => {
    const { supabase, userId } = context
    const { data: isAdmin, error: adminErr } = await supabase.rpc('rp_is_admin', {
      _user_id: userId,
    })
    if (adminErr) throw adminErr
    if (!isAdmin) throw new Error('Forbidden — admin role required')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: logs } = await supabaseAdmin
      .from('rp_audit_logs')
      .select('id, action, actor_id, created_at, old_value, new_value, entity_id')
      .eq('entity_type', 'rp_role_approvals')
      .in('entity_id', data.approvalIds)
      .order('created_at', { ascending: true })

    const actorIds = Array.from(
      new Set((logs ?? []).map((l: any) => l.actor_id).filter(Boolean)),
    )
    const actorMap = new Map<string, { name: string | null; email: string | null }>()
    if (actorIds.length) {
      const { data: profs } = await supabaseAdmin
        .from('rp_profiles')
        .select('id, full_name, email')
        .in('id', actorIds)
      for (const p of profs ?? []) {
        actorMap.set((p as any).id, {
          name: (p as any).full_name ?? null,
          email: (p as any).email ?? null,
        })
      }
    }

    const audit: Record<string, ApprovalAuditEntry[]> = {}
    const messageIds: string[] = []
    for (const log of logs ?? []) {
      const entityId = (log as any).entity_id as string
      const actor = (log as any).actor_id ? actorMap.get((log as any).actor_id) : null
      const entry: ApprovalAuditEntry = {
        id: (log as any).id,
        action: (log as any).action,
        actor_id: (log as any).actor_id,
        actor_name: actor?.name ?? null,
        actor_email: actor?.email ?? null,
        created_at: (log as any).created_at,
        old_value: (log as any).old_value,
        new_value: (log as any).new_value,
      }
      ;(audit[entityId] ||= []).push(entry)
      const mid = (log as any).new_value?.message_id
      if (mid) messageIds.push(mid)
    }

    const emails: Record<string, ApprovalEmailEntry[]> = {}
    const emailRowsByApproval = await Promise.all(
      data.approvalIds.map((approvalId) =>
        supabaseAdmin
          .from('email_send_log')
          .select('message_id, recipient_email, status, error_message, created_at, metadata')
          .eq('template_name', 'rp-role-decision')
          .contains('metadata', { approval_id: approvalId })
          .order('created_at', { ascending: false }),
      ),
    )
    for (const result of emailRowsByApproval) {
      for (const row of result.data ?? []) {
        const approvalId = (row as any).metadata?.approval_id as string | undefined
        if (!approvalId || !data.approvalIds.includes(approvalId)) continue
        ;(emails[approvalId] ||= []).push({
          message_id: (row as any).message_id,
          recipient_email: (row as any).recipient_email,
          status: (row as any).status,
          error_message: (row as any).error_message,
          created_at: (row as any).created_at,
        })
      }
    }

    return { audit, emails }
  })
