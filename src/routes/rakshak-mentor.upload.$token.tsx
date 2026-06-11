import { createFileRoute, useParams } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { CheckCircle2, Loader2, Upload, AlertTriangle, Download, FileText, ExternalLink } from 'lucide-react'
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

const ASSIGNMENT_PDF_URL = '/api/docs/mentor-assignment.pdf'

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
  const [pickedName, setPickedName] = useState<string>('')

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

  // Loading / error / terminal states ---------------------------------------
  if (loadErr) {
    return <CenterCard><Notice tone="error" title="Link error">{loadErr}</Notice></CenterCard>
  }
  if (!info) {
    return (
      <CenterCard>
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </CenterCard>
    )
  }
  if (!info.found) {
    return <CenterCard><Notice tone="error" title="Invalid link">This upload link is not valid. Please check your email or contact us.</Notice></CenterCard>
  }
  if (info.fulfilled_at || info.status === 'fulfilled' || done) {
    return <CenterCard><Notice tone="ok" title="Already received">We've received your {info.kind === 'assignment' ? 'assignment' : 'resume'}. Thank you!</Notice></CenterCard>
  }
  if (info.expired || info.status === 'expired') {
    return <CenterCard><Notice tone="error" title="Link expired">This upload link has expired. Please reply to the email so we can send a new one.</Notice></CenterCard>
  }
  if (info.status === 'cancelled') {
    return <CenterCard><Notice tone="error" title="Request cancelled">This request was cancelled by the admin team.</Notice></CenterCard>
  }

  // Assignment: full-screen split layout with PDF viewer --------------------
  if (info.kind === 'assignment') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="border-b border-slate-200 bg-white px-4 md:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Crashfree India · Rakshak Mentor
            </div>
            <h1 className="text-lg md:text-xl font-bold text-slate-900 mt-0.5">
              Mentor Assignment — {info.full_name.split(' ')[0]}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={ASSIGNMENT_PDF_URL}
              download
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-100"
            >
              <Download className="h-4 w-4" /> Download PDF
            </a>
            <a
              href={ASSIGNMENT_PDF_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-100"
            >
              <ExternalLink className="h-4 w-4" /> Open in new tab
            </a>
          </div>
        </header>

        <div className="flex-1 grid lg:grid-cols-[1fr_420px] gap-0">
          {/* PDF Viewer */}
          <div className="bg-slate-900 min-h-[60vh] lg:min-h-[calc(100vh-73px)]">
            <object
              data={ASSIGNMENT_PDF_URL}
              type="application/pdf"
              className="w-full h-[70vh] lg:h-[calc(100vh-73px)]"
            >
              <div className="p-8 text-center text-white">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-70" />
                <p className="text-sm">
                  Your browser can't display the PDF inline.{' '}
                  <a href={ASSIGNMENT_PDF_URL} className="underline" target="_blank" rel="noreferrer">
                    Open it in a new tab
                  </a>{' '}
                  or download it above.
                </p>
              </div>
            </object>
          </div>

          {/* Submit panel */}
          <aside className="border-l border-slate-200 bg-white p-6 lg:p-8 overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900">Submit your assignment</h2>
            <p className="mt-2 text-sm text-slate-600">
              Read the assignment on the left, then upload your completed submission below.
              We received this request for <strong>{info.email_masked}</strong>.
            </p>

            <ol className="mt-5 space-y-2 text-sm text-slate-700">
              <li className="flex gap-2"><span className="font-semibold text-[#4A35FF]">1.</span> Read or download the assignment PDF.</li>
              <li className="flex gap-2"><span className="font-semibold text-[#4A35FF]">2.</span> Complete it on your computer (PDF, DOC, or DOCX).</li>
              <li className="flex gap-2"><span className="font-semibold text-[#4A35FF]">3.</span> Upload your final file here. Max 20 MB.</li>
            </ol>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Your completed assignment
                </span>
                <div className="rounded-xl border-2 border-dashed border-slate-300 hover:border-[#4A35FF] transition px-4 py-6 text-center bg-slate-50">
                  <Upload className="h-6 w-6 mx-auto text-slate-400" />
                  <p className="mt-2 text-sm text-slate-600">
                    {pickedName ? (
                      <span className="font-medium text-slate-900">{pickedName}</span>
                    ) : (
                      <>Click to choose a file<br />
                        <span className="text-xs text-slate-500">PDF, DOC, or DOCX · up to 20 MB</span>
                      </>
                    )}
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    required
                    onChange={(e) => setPickedName(e.target.files?.[0]?.name ?? '')}
                    className="block w-full mt-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#4A35FF] file:px-4 file:py-2 file:text-white hover:file:bg-[#3A28D9]"
                  />
                </div>
              </label>

              {err && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {err}
                </div>
              )}

              <button
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-full bg-[#4A35FF] text-white text-sm font-semibold hover:bg-[#3A28D9] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {busy ? 'Uploading…' : 'Submit assignment'}
              </button>
              <p className="text-xs text-slate-500 text-center">
                You'll get an email confirmation once we receive it.
              </p>
            </form>
          </aside>
        </div>
      </div>
    )
  }

  // Resume: original compact card ------------------------------------------
  return (
    <CenterCard>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Upload your resume</h1>
      <p className="mt-2 text-sm text-slate-600">
        Hi {info.full_name.split(' ')[0]}, please attach your latest resume / CV below.
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
    </CenterCard>
  )
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-lg rounded-2xl bg-white border border-slate-200 p-8 shadow-sm">
        <div className="text-xs uppercase tracking-wider text-slate-500">
          Crashfree India · Rakshak Mentor
        </div>
        {children}
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
