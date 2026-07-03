import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { useRPAuth } from '@/lib/rakshak-platform/auth'
import { PlatformShell, Section } from '@/components/rakshak-platform/Shell'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowLeft, Mail } from 'lucide-react'
import { listMassEmailCampaigns } from '@/lib/rakshak-platform/mass-email.functions'

export const Route = createFileRoute('/rakshak-platform/admin/emails/log')({
  component: MassEmailLog,
})

function MassEmailLog() {
  const { profile, loading } = useRPAuth()
  const navigate = useNavigate()
  const isAdmin = profile?.roles?.some((r: string) => ['cfi_admin', 'super_admin'].includes(r))
  const load = useServerFn(listMassEmailCampaigns)
  const [rows, setRows] = useState<any[]>([])
  const [busy, setBusy] = useState(true)

  useEffect(() => { if (!loading && !isAdmin) navigate({ to: '/rakshak-platform/dashboard' }) }, [loading, isAdmin, navigate])
  useEffect(() => {
    if (!isAdmin) return
    load({}).then((r: any) => setRows(r.campaigns)).finally(() => setBusy(false))
  }, [isAdmin, load])

  if (loading || !isAdmin) return <PlatformShell><div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div></PlatformShell>

  return (
    <PlatformShell>
      <Section>
        <div className="mb-4">
          <Link to="/rakshak-platform/admin/emails" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to composer
          </Link>
        </div>
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand"><Mail className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Mass email history</h1>
            <p className="text-sm text-muted-foreground">Last 50 mass-email campaigns.</p>
          </div>
        </div>

        {busy ? (
          <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="pt-6 text-sm text-muted-foreground">No campaigns yet. Draft your first one from the composer.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <Card key={r.id}>
                <CardContent className="pt-4 pb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div>
                    <div className="text-sm font-medium">{r.subject_override || r.template_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.template_name} · audience: {r.audience?.type || 'unknown'} · {new Date(r.sent_at || r.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant={r.status === 'sent' ? 'default' : r.status === 'failed' ? 'destructive' : 'secondary'}>{r.status}</Badge>
                    <span className="text-muted-foreground">
                      {r.success_count}/{r.recipient_count} queued
                      {r.failed_count ? ` · ${r.failed_count} skipped` : ''}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </PlatformShell>
  )
}
