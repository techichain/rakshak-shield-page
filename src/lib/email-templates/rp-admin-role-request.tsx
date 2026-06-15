import React from 'react'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  admin_name?: string
  requester_name?: string
  requester_email?: string
  requested_role?: string
  notes?: string
  review_url?: string
  source?: string // e.g. "self-signup" or "mentor application"
}

const ROLE_LABEL: Record<string, string> = {
  mentor: 'Mentor',
  evaluator: 'Evaluator',
  cfi_admin: 'CFI Admin',
  super_admin: 'Super Admin',
  team_leader: 'Team Leader',
}

const Email = ({
  admin_name,
  requester_name = 'A new user',
  requester_email = '',
  requested_role = 'mentor',
  notes,
  review_url = 'https://rakshak.crashfreeindia.org/rakshak-platform/admin/access-requests',
  source = 'self-signup',
}: Props) => {
  const roleLabel = ROLE_LABEL[requested_role] ?? requested_role
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>New {roleLabel} access request from {requester_name}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>New {roleLabel} access request</Heading>
          <Text style={text}>Hi {admin_name || 'Admin'},</Text>
          <Text style={text}>
            <strong>{requester_name}</strong>{requester_email ? ` (${requester_email})` : ''} has
            requested <strong>{roleLabel}</strong> access on the Rakshak Platform via {source}.
          </Text>
          {notes && (
            <Text style={{ ...text, fontStyle: 'italic', borderLeft: '3px solid #E2E8F0', paddingLeft: 12 }}>
              "{notes}"
            </Text>
          )}
          <Text style={text}>
            Please review and approve or reject the request from the admin panel.
          </Text>
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={review_url} style={button}>Review request</Button>
          </Section>
          <Text style={small}>
            Or open: <Link href={review_url} style={link}>{review_url}</Link>
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            Crashfree India · Rakshak Platform · Admin notification
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `New ${ROLE_LABEL[data?.requested_role] ?? 'role'} access request — Rakshak Platform`,
  displayName: 'Admin: role access request',
  previewData: {
    admin_name: 'Muskan',
    requester_name: 'Asha Verma',
    requester_email: 'asha@example.com',
    requested_role: 'mentor',
    notes: 'Self-requested mentor access at sign-up.',
    review_url: 'https://rakshak.crashfreeindia.org/rakshak-platform/admin/access-requests',
    source: 'self-signup',
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
