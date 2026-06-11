import { createFileRoute, useParams } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { CheckCircle2, Loader2, Upload, AlertTriangle } from 'lucide-react'
import {
  getFileRequest,
  createUploadUrl,
  completeUpload,
} from '@/lib/mentor/file-requests.functions'

export const Route = createFileRoute('/rakshak-mentor/upload/$token')({
  head: () => ({
    meta: [
      { title: 'Upload file — Rakshak Mentor' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: UploadPage,
})

type Info =
  | { found: false }
  | {
      found: true
      id: string
      kind: 'resume' | 'assignment'
      status: string
      expired: boolean
      fulfilled_at: string | null
      full_name: string
      email_masked: string
    }

function UploadPage() {
  const { token } = useParams({ from: '/rakshak-mentor/upload/$token' })
  const getFn = useServerFn(getFileRequest)
  const createUrlFn = useServerFn(createUploadUrl)
  const completeFn = useServerFn(completeUpload)

  const [info, setInfo] = useState<Info | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true
    getFn({ data: { token } })
      .then((r) => mounted && setInfo(r as Info))
      .catch((e) => mounted && setLoadErr(e?.message ?? 'Could not load link'))
    return () => { mounted = false }
  }, [token, getFn])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const file = fileRef.current?.files?.[0]
    if (!file) { setErr('Please choose a file.'); return }
    setBusy(true)
    try {
      const prep = await createUrlFn({
        data: {
          token,
          file_name: file.name,
          mime_type: file.type || 'application/pdf',
          size_bytes: file.size,
        },
      })
      const put = await fetch(prep.signed_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/pdf' },
        body: file,
      })
      if (!put.ok) throw new Error(`Upload failed (${put.status})`)
      await completeFn({
        data: {
          token,
          storage_path: prep.storage_path,
          file_name: file.name,
          mime_type: file.type || 'application/pdf',
          size_bytes: file.size,
        },
      })
      setDone(true)
    } catch (e: any) {
      setErr(e?.message ?? 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-lg rounded-2xl bg-white border border-slate-200 p-8 shadow-sm">
        <div className="text-xs uppercase tracking-wider text-slate-500">
          Crashfree India · Rakshak Mentor
        </div>

        {loadErr ? (
          <Notice tone="error" title="Link error">{loadErr}</Notice>
        ) : !info ? (
          <div className="mt-6 flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !info.found ? (
          <Notice tone="error" title="Invalid link">
            This upload link is not valid. Please check your email or contact us.
          </Notice>
        ) : info.fulfilled_at || info.status === 'fulfilled' || done ? (
          <Notice tone="ok" title="Already received">
            We’ve received your {info.found && info.kind === 'assignment' ? 'assignment' : 'resume'}. Thank you!
          </Notice>
        ) : info.expired || info.status === 'expired' ? (
          <Notice tone="error" title="Link expired">
            This upload link has expired. Please reply to the email so we can send a new one.
          </Notice>
        ) : info.status === 'cancelled' ? (
          <Notice tone="error" title="Request cancelled">
            This request was cancelled by the admin team.
          </Notice>
        ) : (
          <>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              {info.kind === 'assignment' ? 'Submit your assignment' : 'Upload your resume'}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Hi {info.full_name.split(' ')[0]}, please attach your {info.kind === 'assignment' ? 'completed mentor assignment' : 'latest resume / CV'} below.
              We received this request for <strong>{info.email_masked}</strong>.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  File (PDF / DOC / DOCX, max 20 MB)
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  required
                  className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#4A35FF] file:px-4 file:py-2 file:text-white hover:file:bg-[#3A28D9]"
                />
              </label>

              {err && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {err}
                </div>
              )}

              <button
                disabled={busy}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[#4A35FF] text-white text-sm font-semibold hover:bg-[#3A28D9] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {busy ? 'Uploading…' : 'Upload'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function Notice({
  tone, title, children,
}: { tone: 'ok' | 'error'; title: string; children: React.ReactNode }) {
  const ok = tone === 'ok'
  return (
    <div className={`mt-6 rounded-xl border p-4 ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className={`flex items-center gap-2 text-sm font-semibold ${ok ? 'text-emerald-800' : 'text-amber-800'}`}>
        {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        {title}
      </div>
      <div className={`mt-1 text-sm ${ok ? 'text-emerald-700' : 'text-amber-800'}`}>{children}</div>
    </div>
  )
}
