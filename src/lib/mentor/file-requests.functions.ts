import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

type Kind = 'resume' | 'assignment'

function genToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function assertAdmin(ctx: any) {
  const { data, error } = await ctx.supabase.rpc('has_role', { _user_id: ctx.userId, _role: 'admin' })
  if (error || !data) throw new Error('Forbidden')
}

/* ───────── ADMIN: bulk-create file requests and queue emails ───────── */

export const bulkRequestFiles = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { application_ids: string[]; kind: Kind }) => {
    if (!Array.isArray(d.application_ids) || d.application_ids.length === 0) {
      throw new Error('application_ids required')
    }
    if (d.kind !== 'resume' && d.kind !== 'assignment') throw new Error('invalid kind')
    return d
  })
  .handler(async ({ data, context, request }) => {
    await assertAdmin(context)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: apps, error: appErr } = await supabaseAdmin
      .from('applications')
      .select('id, full_name, email')
      .in('id', data.application_ids)
    if (appErr) throw new Error(appErr.message)

    const origin = (() => {
      try { return new URL(request.url).origin } catch { return '' }
    })()

    const sent: any[] = []
    const failed: any[] = []
    const authHeader = request.headers.get('Authorization') ?? ''

    for (const app of apps ?? []) {
      const token = genToken()
      const { data: row, error: insErr } = await supabaseAdmin
        .from('application_file_requests')
        .insert({
          application_id: app.id,
          kind: data.kind,
          token,
          status: 'sent',
          requested_by: context.userId,
        })
        .select('id, token, expires_at')
        .single()
      if (insErr || !row) {
        failed.push({ application_id: app.id, error: insErr?.message ?? 'insert failed' })
        continue
      }

      const upload_url = `${origin}/rakshak-mentor/upload/${row.token}`
      const expires_on = new Date(row.expires_at).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })

      try {
        const res = await fetch(`${origin}/lovable/email/transactional/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader },
          body: JSON.stringify({
            templateName: 'mentor-file-request',
            recipientEmail: app.email,
            idempotencyKey: `mfr-${row.id}`,
            templateData: {
              name: app.full_name,
              kind: data.kind,
              upload_url,
              expires_on,
            },
          }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok || body?.error) {
          failed.push({ application_id: app.id, error: body?.error ?? `email http ${res.status}` })
        } else {
          sent.push({ application_id: app.id, request_id: row.id })
        }
      } catch (e: any) {
        failed.push({ application_id: app.id, error: e?.message ?? 'email send failed' })
      }
    }

    return { sent_count: sent.length, failed_count: failed.length, sent, failed }
  })

/* ───────── PUBLIC: token-based lookup + upload ───────── */

export const getFileRequest = createServerFn({ method: 'POST' })
  .inputValidator((d: { token: string }) => {
    if (!d?.token || typeof d.token !== 'string') throw new Error('token required')
    return d
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: rows, error } = await supabaseAdmin
      .rpc('application_file_request_by_token', { _token: data.token })
    if (error) throw new Error(error.message)
    const row = (rows ?? [])[0]
    if (!row) return { found: false as const }
    const expired = new Date(row.expires_at).getTime() < Date.now()
    return {
      found: true as const,
      id: row.id,
      kind: row.kind as Kind,
      status: row.status as string,
      expired,
      fulfilled_at: row.fulfilled_at,
      full_name: row.full_name as string,
      email_masked: maskEmail(row.email as string),
    }
  })

function maskEmail(e: string): string {
  const [l, d] = (e || '').split('@')
  if (!l || !d) return '***'
  return `${l[0]}***@${d}`
}

export const createUploadUrl = createServerFn({ method: 'POST' })
  .inputValidator((d: { token: string; file_name: string; mime_type: string; size_bytes: number }) => {
    if (!d?.token) throw new Error('token required')
    if (!d.file_name) throw new Error('file_name required')
    if (!d.mime_type) throw new Error('mime_type required')
    if (typeof d.size_bytes !== 'number' || d.size_bytes <= 0) throw new Error('size_bytes required')
    if (d.size_bytes > 20 * 1024 * 1024) throw new Error('File must be 20 MB or smaller')
    const ok = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!ok.includes(d.mime_type)) throw new Error('Only PDF or DOC/DOCX files are accepted')
    return d
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: rows } = await supabaseAdmin
      .rpc('application_file_request_by_token', { _token: data.token })
    const row = (rows ?? [])[0]
    if (!row) throw new Error('Invalid link')
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error('This link has expired')
    if (row.status === 'fulfilled') throw new Error('This file has already been submitted')
    if (row.status === 'cancelled') throw new Error('This request was cancelled')

    const safeName = data.file_name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    const storage_path = `${row.application_id}/${row.kind === 'resume' ? 'resume' : 'assignment'}_${Date.now()}_${safeName}`
    const bucket = 'mentor-applications'

    const { data: signed, error: signErr } = await supabaseAdmin
      .storage.from(bucket).createSignedUploadUrl(storage_path)
    if (signErr || !signed) throw new Error(signErr?.message ?? 'Could not prepare upload')

    return {
      bucket,
      storage_path,
      signed_url: signed.signedUrl,
      token: signed.token,
      request_id: row.id,
      application_id: row.application_id,
      kind: row.kind as Kind,
    }
  })

export const completeUpload = createServerFn({ method: 'POST' })
  .inputValidator((d: {
    token: string
    storage_path: string
    file_name: string
    mime_type: string
    size_bytes: number
  }) => {
    if (!d?.token || !d.storage_path || !d.file_name) throw new Error('Missing fields')
    return d
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: rows } = await supabaseAdmin
      .rpc('application_file_request_by_token', { _token: data.token })
    const row = (rows ?? [])[0]
    if (!row) throw new Error('Invalid link')
    if (row.status === 'fulfilled') throw new Error('Already submitted')

    const dbKind = row.kind === 'resume' ? 'cv' : 'assignment'

    const { data: fileRow, error: fErr } = await supabaseAdmin
      .from('application_files')
      .insert({
        application_id: row.application_id,
        kind: dbKind as any,
        storage_bucket: 'mentor-applications',
        storage_path: data.storage_path,
        file_name: data.file_name,
        mime_type: data.mime_type,
        size_bytes: data.size_bytes,
      })
      .select('id')
      .single()
    if (fErr || !fileRow) throw new Error(fErr?.message ?? 'Could not save file')

    const { error: updErr } = await supabaseAdmin
      .from('application_file_requests')
      .update({
        status: 'fulfilled',
        fulfilled_at: new Date().toISOString(),
        uploaded_file_id: fileRow.id,
      })
      .eq('id', row.id)
    if (updErr) throw new Error(updErr.message)

    return { ok: true }
  })
