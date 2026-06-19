// Public cross-project upload endpoint for mentor applications.
//
// SECURITY MODEL
// - Caller MUST present `x-shared-secret` matching MENTOR_UPLOAD_SHARED_SECRET
//   (timing-safe compare). Intended for SERVER-TO-SERVER calls only — never
//   put the secret in a browser bundle.
// - Hard size cap (20 MB) and strict mime allowlist (PDF / DOC / DOCX).
// - `application_id` must exist in public.applications.
// - File is written via the service role to the mentor-applications bucket
//   under `{application_id}/...` (the same prefix the RLS policy enforces
//   for token-based uploads), and an application_files row is inserted.
// - No PII is returned. CORS is intentionally NOT enabled (server-to-server).
import { createFileRoute } from '@tanstack/react-router'
import { timingSafeEqual } from 'crypto'
import { z } from 'zod'

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const MAX_BYTES = 20 * 1024 * 1024

const bodySchema = z.object({
  application_id: z.string().uuid(),
  kind: z.enum(['cv', 'assignment']),
  file_name: z.string().min(1).max(200),
  mime_type: z.string().min(1).max(200),
  size_bytes: z.number().int().positive().max(MAX_BYTES),
  // base64-encoded file body (no `data:` prefix)
  file_base64: z.string().min(1).max(Math.ceil((MAX_BYTES * 4) / 3) + 1024),
})

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export const Route = createFileRoute('/api/public/hooks/mentor-upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.MENTOR_UPLOAD_SHARED_SECRET
        if (!secret) {
          return new Response('Server misconfigured', { status: 500 })
        }
        const provided = request.headers.get('x-shared-secret') ?? ''
        if (!provided || !safeEq(provided, secret)) {
          return new Response('Unauthorized', { status: 401 })
        }

        let json: unknown
        try {
          json = await request.json()
        } catch {
          return new Response('Invalid JSON', { status: 400 })
        }
        const parsed = bodySchema.safeParse(json)
        if (!parsed.success) {
          return Response.json(
            { error: 'Invalid body', details: parsed.error.flatten() },
            { status: 400 },
          )
        }
        const data = parsed.data

        if (!ALLOWED_MIME.has(data.mime_type)) {
          return Response.json(
            { error: 'Only PDF or DOC/DOCX files are accepted' },
            { status: 400 },
          )
        }

        // Decode base64 and re-verify size to prevent size_bytes spoofing.
        let bytes: Buffer
        try {
          bytes = Buffer.from(data.file_base64, 'base64')
        } catch {
          return new Response('Invalid file_base64', { status: 400 })
        }
        if (bytes.length === 0 || bytes.length > MAX_BYTES) {
          return Response.json(
            { error: `File must be 1 byte to ${MAX_BYTES} bytes` },
            { status: 400 },
          )
        }
        if (Math.abs(bytes.length - data.size_bytes) > 16) {
          return Response.json(
            { error: 'size_bytes does not match file_base64' },
            { status: 400 },
          )
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        // Confirm application exists (prevents arbitrary folder creation).
        const { data: app, error: appErr } = await supabaseAdmin
          .from('applications')
          .select('id')
          .eq('id', data.application_id)
          .maybeSingle()
        if (appErr) {
          return Response.json({ error: appErr.message }, { status: 500 })
        }
        if (!app) {
          return Response.json({ error: 'Unknown application_id' }, { status: 404 })
        }

        const safeName = data.file_name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
        const prefix = data.kind === 'cv' ? 'resume' : 'assignment'
        const storage_path = `${data.application_id}/${prefix}_${Date.now()}_${safeName}`
        const bucket = 'mentor-applications'

        const { error: upErr } = await supabaseAdmin.storage
          .from(bucket)
          .upload(storage_path, bytes, {
            contentType: data.mime_type,
            upsert: false,
          })
        if (upErr) {
          return Response.json({ error: upErr.message }, { status: 500 })
        }

        const { data: fileRow, error: fErr } = await supabaseAdmin
          .from('application_files')
          .insert({
            application_id: data.application_id,
            kind: data.kind as any,
            storage_bucket: bucket,
            storage_path,
            file_name: data.file_name,
            mime_type: data.mime_type,
            size_bytes: bytes.length,
          })
          .select('id')
          .single()
        if (fErr || !fileRow) {
          // Best-effort cleanup of the uploaded object.
          await supabaseAdmin.storage.from(bucket).remove([storage_path]).catch(() => {})
          return Response.json(
            { error: fErr?.message ?? 'Could not record file' },
            { status: 500 },
          )
        }

        return Response.json({
          ok: true,
          file_id: fileRow.id,
          storage_path,
        })
      },
    },
  },
})
