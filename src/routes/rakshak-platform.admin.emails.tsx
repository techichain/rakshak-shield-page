import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { useRPAuth } from '@/lib/rakshak-platform/auth'
import { PlatformShell, Section } from '@/components/rakshak-platform/Shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Mail, Send, Users, ArrowLeft, Eye } from 'lucide-react'
import {
  listMassEmailScopes, previewMassEmailAudience, sendMassEmail, sendMassEmailTest,
  listMassEmailCampaigns,
} from '@/lib/rakshak-platform/mass-email.functions'


export const Route = createFileRoute('/rakshak-platform/admin/emails')({
  component: MassEmailComposer,
})

type AudienceType =
  | 'team_leaders' | 'team_members' | 'team_and_mentor'
  | 'all_mentors' | 'all_evaluators' | 'custom_emails'

const AUDIENCE_LABELS: Record<AudienceType, string> = {
  team_leaders: 'All team leaders',
  team_members: 'All team members + leaders',
  team_and_mentor: 'Teams + assigned mentors',
  all_mentors: 'All mentors',
  all_evaluators: 'All evaluators',
  custom_emails: 'Custom email list',
}

const TEMPLATE_OPTIONS = [
  { value: 'admin-deadline-team', label: 'Team — submission deadline', hint: 'Reminds teams + leaders of the phase deadline.' },
  { value: 'admin-deadline-mentor', label: 'Mentor — review deadline', hint: 'Reminds mentors to review submitted work.' },
  { value: 'admin-deadline-evaluator', label: 'Evaluator — evaluation deadline', hint: 'Reminds evaluators to score assigned teams.' },
] as const

const DUMMY_CAMPAIGNS = [
  { id: 'd1', template_name: 'admin-deadline-team',      subject_override: null,             audience: { type: 'team_leaders' },  status: 'sent',   recipient_count: 42, success_count: 41, failed_count: 1, sent_at: new Date(Date.now() - 2 * 86400000).toISOString(), created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 'd2', template_name: 'admin-deadline-mentor',    subject_override: null,             audience: { type: 'all_mentors' },   status: 'sent',   recipient_count: 18, success_count: 18, failed_count: 0, sent_at: new Date(Date.now() - 5 * 86400000).toISOString(), created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: 'd3', template_name: 'admin-deadline-evaluator', subject_override: 'Scoring due Fri', audience: { type: 'all_evaluators' }, status: 'sent',  recipient_count: 12, success_count: 11, failed_count: 1, sent_at: new Date(Date.now() - 9 * 86400000).toISOString(), created_at: new Date(Date.now() - 9 * 86400000).toISOString() },
  { id: 'd4', template_name: 'admin-deadline-team',      subject_override: null,             audience: { type: 'team_and_mentor' }, status: 'queued', recipient_count: 60, success_count: 0,  failed_count: 0, sent_at: null,                                              created_at: new Date(Date.now() - 12 * 86400000).toISOString() },
]


function MassEmailComposer() {
  const { isAdmin, loading } = useRPAuth()
  const navigate = useNavigate()

  // isAdmin from hook
  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: '/rakshak-platform/dashboard' })
  }, [loading, isAdmin, navigate])

  const loadScopes = useServerFn(listMassEmailScopes)
  const doPreview = useServerFn(previewMassEmailAudience)
  const doSend = useServerFn(sendMassEmail)
  const doTest = useServerFn(sendMassEmailTest)
  const loadCampaigns = useServerFn(listMassEmailCampaigns)


  const [scopes, setScopes] = useState<{ cohorts: any[]; teams: any[] }>({ cohorts: [], teams: [] })
  const [template, setTemplate] = useState<'admin-deadline-team' | 'admin-deadline-mentor' | 'admin-deadline-evaluator'>('admin-deadline-team')
  const [audienceType, setAudienceType] = useState<AudienceType>('team_leaders')
  const [cohortId, setCohortId] = useState<string>('')
  const [teamId, setTeamId] = useState<string>('')
  const [customEmails, setCustomEmails] = useState('')
  const [phaseNumber, setPhaseNumber] = useState('')
  const [deliverable, setDeliverable] = useState('')
  const [deadlineDate, setDeadlineDate] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [subjectOverride, setSubjectOverride] = useState('')
  const [testEmail, setTestEmail] = useState('')

  const [preview, setPreview] = useState<{ count: number; preview: any[]; capped: boolean } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [sending, setSending] = useState(false)
  const [testing, setTesting] = useState(false)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [campaignsDummy, setCampaignsDummy] = useState(false)


  useEffect(() => {
    if (!isAdmin) return
    loadScopes({}).then(setScopes).catch(() => toast.error('Failed to load cohorts/teams'))
    loadCampaigns({})
      .then((r: any) => {
        const rows = r?.campaigns ?? []
        if (rows.length === 0) {
          setCampaigns(DUMMY_CAMPAIGNS)
          setCampaignsDummy(true)
        } else {
          setCampaigns(rows)
          setCampaignsDummy(false)
        }
      })
      .catch(() => {
        setCampaigns(DUMMY_CAMPAIGNS)
        setCampaignsDummy(true)
      })
  }, [isAdmin, loadScopes, loadCampaigns])

  useEffect(() => { setPreview(null) }, [audienceType, cohortId, teamId, customEmails])


  const audience = useMemo(() => {
    const base: any = { type: audienceType }
    if (audienceType === 'custom_emails') {
      base.emails = customEmails
        .split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean)
    } else {
      if (cohortId) base.cohortId = cohortId
      if (teamId && (audienceType === 'team_and_mentor' || audienceType === 'team_leaders' || audienceType === 'team_members')) {
        base.teamId = teamId
      }
    }
    return base
  }, [audienceType, cohortId, teamId, customEmails])

  const mergeFields = useMemo(() => {
    const m: Record<string, string> = { deadline_date: deadlineDate }
    if (phaseNumber) m.phase_number = phaseNumber
    if (deliverable) m.deliverable = deliverable
    if (customMessage) m.custom_message = customMessage
    if (ctaUrl) m.cta_url = ctaUrl
    return m
  }, [deadlineDate, phaseNumber, deliverable, customMessage, ctaUrl])

  const canSubmit = deadlineDate.length > 0 && (audienceType !== 'custom_emails' || audience.emails?.length)

  async function handlePreview() {
    setPreviewing(true)
    try {
      const res = await doPreview({ data: { audience } })
      setPreview(res)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to resolve audience')
    } finally {
      setPreviewing(false)
    }
  }

  async function handleTest() {
    if (!testEmail) { toast.error('Enter a test email address'); return }
    if (!canSubmit) { toast.error('Deadline date is required'); return }
    setTesting(true)
    try {
      const res: any = await doTest({ data: {
        templateName: template, audience, mergeFields,
        subjectOverride: subjectOverride || undefined, testRecipient: testEmail,
      } })
      if (res.ok) toast.success(`Test email queued to ${testEmail}`)
      else toast.error(`Test skipped: ${res.reason}`)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send test')
    } finally {
      setTesting(false)
    }
  }

  async function handleSend() {
    if (!preview) { toast.error('Preview the audience first'); return }
    if (!canSubmit) { toast.error('Deadline date is required'); return }
    if (preview.count === 0) { toast.error('No recipients'); return }
    const ok = confirm(`Send this email to ${preview.count} recipient${preview.count === 1 ? '' : 's'}?`)
    if (!ok) return
    setSending(true)
    try {
      const res: any = await doSend({ data: {
        templateName: template, audience, mergeFields,
        subjectOverride: subjectOverride || undefined,
      } })
      toast.success(`Queued ${res.success} of ${res.total} emails${res.failed ? ` (${res.failed} skipped)` : ''}`)
      setPreview(null)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  if (loading || !isAdmin) {
    return <PlatformShell><div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div></PlatformShell>
  }

  const scopedTeams = cohortId ? scopes.teams.filter((t) => t.cohort_id === cohortId) : scopes.teams
  const audienceNeedsScope = ['team_leaders', 'team_members', 'team_and_mentor'].includes(audienceType)

  return (
    <PlatformShell>
      <Section>
        <div className="mb-4">
          <Link to="/rakshak-platform/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to admin
          </Link>
        </div>

        <div className="mb-6 flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand"><Mail className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Mass email composer</h1>
            <p className="text-sm text-muted-foreground">Draft deadline reminders to teams, mentors, or evaluators. Uses your existing Lovable Email infrastructure — respects unsubscribes automatically.</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* LEFT: form */}
          <div className="space-y-5">
            <Card>
              <CardHeader><CardTitle className="text-base">1. Template</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {TEMPLATE_OPTIONS.map((t) => (
                  <label key={t.value} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${template === t.value ? 'border-brand bg-brand/5' : 'hover:bg-muted/40'}`}>
                    <input type="radio" name="tmpl" checked={template === t.value} onChange={() => setTemplate(t.value)} className="mt-1" />
                    <div>
                      <div className="font-medium text-sm">{t.label}</div>
                      <div className="text-xs text-muted-foreground">{t.hint}</div>
                    </div>
                  </label>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">2. Audience</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(AUDIENCE_LABELS) as AudienceType[]).map((k) => (
                    <label key={k} className={`flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer ${audienceType === k ? 'border-brand bg-brand/5' : 'hover:bg-muted/40'}`}>
                      <input type="radio" checked={audienceType === k} onChange={() => setAudienceType(k)} />
                      {AUDIENCE_LABELS[k]}
                    </label>
                  ))}
                </div>

                {audienceNeedsScope && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Cohort (optional)</Label>
                      <Select value={cohortId || 'all'} onValueChange={(v) => { setCohortId(v === 'all' ? '' : v); setTeamId('') }}>
                        <SelectTrigger><SelectValue placeholder="All cohorts" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All cohorts</SelectItem>
                          {scopes.cohorts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Specific team (optional)</Label>
                      <Select value={teamId || 'all'} onValueChange={(v) => setTeamId(v === 'all' ? '' : v)}>
                        <SelectTrigger><SelectValue placeholder="All teams" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All teams</SelectItem>
                          {scopedTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.team_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {audienceType === 'custom_emails' && (
                  <div>
                    <Label className="text-xs">Email addresses (comma/space/newline separated)</Label>
                    <Textarea rows={4} value={customEmails} onChange={(e) => setCustomEmails(e.target.value)} placeholder="alice@example.com, bob@example.com" />
                  </div>
                )}

                <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewing}>
                  {previewing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  Preview recipients
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">3. Content</CardTitle><CardDescription>Merge fields fill placeholders in the template.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Deadline date *</Label>
                    <Input value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} placeholder="e.g. 15 July 2026" />
                  </div>
                  <div>
                    <Label className="text-xs">Phase number</Label>
                    <Input value={phaseNumber} onChange={(e) => setPhaseNumber(e.target.value)} placeholder="e.g. 2" />
                  </div>
                </div>
                {template === 'admin-deadline-team' && (
                  <div>
                    <Label className="text-xs">Deliverable name</Label>
                    <Input value={deliverable} onChange={(e) => setDeliverable(e.target.value)} placeholder="e.g. Phase 2 audit + questionnaire" />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Custom message (optional)</Label>
                  <Textarea rows={4} value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} placeholder="Anything extra you want to add (plain text, up to 2000 chars)" maxLength={2000} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">CTA URL (optional)</Label>
                    <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://rakshak.crashfreeindia.org/…" />
                  </div>
                  <div>
                    <Label className="text-xs">Subject override (optional)</Label>
                    <Input value={subjectOverride} onChange={(e) => setSubjectOverride(e.target.value)} placeholder="Leave blank to use template default" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">4. Test then send</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="Send test to your email…" />
                  <Button variant="outline" onClick={handleTest} disabled={testing || !canSubmit}>
                    {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Send test
                  </Button>
                </div>
                <Button className="w-full" onClick={handleSend} disabled={sending || !preview || preview.count === 0 || !canSubmit}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Send to {preview?.count ?? '—'} recipient{preview?.count === 1 ? '' : 's'}
                </Button>
                {!preview && <p className="text-xs text-muted-foreground">Preview recipients first to enable send.</p>}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: preview panel */}
          <div className="space-y-4">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Recipients</CardTitle>
              </CardHeader>
              <CardContent>
                {!preview ? (
                  <p className="text-sm text-muted-foreground">Click "Preview recipients" to resolve the audience.</p>
                ) : (
                  <>
                    <div className="mb-3 flex items-center gap-2">
                      <Badge variant={preview.count === 0 ? 'destructive' : 'default'} className="text-base px-3 py-1">{preview.count}</Badge>
                      <span className="text-sm text-muted-foreground">recipient{preview.count === 1 ? '' : 's'} resolved</span>
                    </div>
                    {preview.capped && <p className="text-xs text-amber-600 mb-2">List capped at 1000. Narrow the audience or split the send.</p>}
                    <div className="space-y-1 max-h-80 overflow-auto">
                      {preview.preview.map((r, i) => (
                        <div key={i} className="text-xs border-b py-1.5">
                          <div className="font-medium">{r.email}</div>
                          <div className="text-muted-foreground">{r.name}{r.team_name ? ` · ${r.team_name}` : ''}</div>
                        </div>
                      ))}
                      {preview.count > 10 && <div className="text-xs text-muted-foreground pt-2">…and {preview.count - 10} more</div>}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-xs text-muted-foreground space-y-2">
                <p><strong>Safety:</strong> Suppressed and unsubscribed addresses are skipped automatically.</p>
                <p><strong>Delivery:</strong> Emails are queued and sent at ~120/min through the existing infra.</p>
                <p><Link to="/rakshak-platform/admin/emails/log" className="text-brand hover:underline">View campaign history →</Link></p>
              </CardContent>
            </Card>
          </div>
        </div>
      </Section>
    </PlatformShell>
  )
}
