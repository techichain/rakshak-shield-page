import React from 'react'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  requester_name?: string
  requested_role?: string
  decision?: 'approved' | 'rejected'
  reason?: string
  reviewer_name?: string
  reviewed_at?: string
  portal_url?: string
}

const ROLE_LABEL: Record<string, string> = {
  mentor: 'Mentor',
  evaluator: 'Evaluator',
  cfi_admin: 'CFI Admin',
  super_admin: 'Super Admin',
  team_leader: 'Team Leader',
}

const ROLE_LANDING: Record<string, string> = {
  mentor: '/rakshak-platform/mentor',
  evaluator: '/rakshak-platform/evaluator',
  team_leader: '/rakshak-platform/team',
  cfi_admin: '/rakshak-platform/admin',
  super_admin: '/rakshak-platform/admin',
}

const Email = ({
  requester_name = 'there',
  requested_role = 'mentor',
  decision = 'approved',
  reason,
  reviewer_name,
  reviewed_at,
  portal_url,
}: Props) => {
  const roleLabel = ROLE_LABEL[requested_role] ?? requested_role
  const approved = decision === 'approved'
  const landing = portal_url ||
    `https://rakshak.crashfreeindia.org${ROLE_LANDING[requested_role] ?? '/rakshak-platform/dashboard'}`
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {approved
          ? `Your ${roleLabel} access has been approved`
          : `Update on your ${roleLabel} access request`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {approved
              ? `Welcome aboard — ${roleLabel} access approved`
              : `Your ${roleLabel} access request was not approved`}
          </Heading>
          <Text style={text}>Hi {requester_name},</Text>
          {approved ? (
            <>
              <Text style={text}>
                Good news — an admin has approved your request for{' '}
                <strong>{roleLabel}</strong> access on the Rakshak Platform. You
                can sign in and start using your portal right away.
              </Text>
              <Section style={{ textAlign: 'center', margin: '28px 0' }}>
                <Button href={landing} style={button}>Open my portal</Button>
              </Section>
              <Text style={small}>
                Or open: <Link href={landing} style={link}>{landing}</Link>
              </Text>
            </>
          ) : (
            <>
              <Text style={text}>
                After review, an admin was unable to approve your request for{' '}
                <strong>{roleLabel}</strong> access at this time.
              </Text>
              <Text style={{ ...text, borderLeft: '3px solid #E2E8F0', paddingLeft: 12 }}>
                <strong>Reason from the reviewer:</strong>
                <br />
                {reason || 'No additional details were provided.'}
              </Text>
              <Text style={text}>
                If you believe this was a mistake or you'd like to share more
                context, reply to this email and our team will get back to you.
              </Text>
            </>
          )}
          <Hr style={hr} />
          <Text style={footer}>
            Reviewed{reviewer_name ? ` by ${reviewer_name}` : ''}
            {reviewed_at ? ` on ${reviewed_at}` : ''}.<br />
            Crashfree India · Rakshak Platform
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => {
    const role = ROLE_LABEL[data?.requested_role] ?? 'role'
    return data?.decision === 'rejected'
      ? `Update on your ${role} access request — Rakshak Platform`
      : `Your ${role} access has been approved — Rakshak Platform`
  },
  displayName: 'Requester: role decision',
  previewData: {
    requester_name: 'Asha Verma',
    requested_role: 'mentor',
    decision: 'approved',
    reviewer_name: 'Muskan',
    reviewed_at: new Date().toLocaleString(),
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }
const container: React.CSSProperties = { maxWidth: 560, margin: '0 auto', padding: '32px 24px' }
const h1: React.CSSProperties = { fontSize: 24, fontWeight: 700, color: '#0F172A', margin: '0 0 16px' }
const text: React.CSSProperties = { fontSize: 15, lineHeight: 1.6, color: '#1F2937', margin: '0 0 14px' }
const small: React.CSSProperties = { fontSize: 13, lineHeight: 1.5, color: '#64748B', margin: '12px 0' }
const button: React.CSSProperties = {
  backgroundColor: '#4A35FF', color: '#ffffff', borderRadius: 8,
  padding: '12px 28px', fontSize: 15, fontWeight: 600, textDecoration: 'none', display: 'inline-block',
}
const link: React.CSSProperties = { color: '#4A35FF', wordBreak: 'break-all' }
const hr: React.CSSProperties = { border: 'none', borderTop: '1px solid #E2E8F0', margin: '28px 0 16px' }
const footer: React.CSSProperties = { fontSize: 12, color: '#94A3B8', lineHeight: 1.5 }
