import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  kind?: 'resume' | 'assignment'
  upload_url?: string
  expires_on?: string
}

const KIND_LABEL: Record<string, { title: string; what: string }> = {
  resume: {
    title: 'Please share your resume',
    what: 'a copy of your latest resume / CV (PDF preferred)',
  },
  assignment: {
    title: 'Please submit your mentor assignment',
    what: 'your completed mentor assignment file (PDF preferred)',
  },
}

const Email = ({ name, kind = 'resume', upload_url = '#', expires_on }: Props) => {
  const meta = KIND_LABEL[kind] ?? KIND_LABEL.resume
  const isAssignment = kind === 'assignment'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{meta.title} — Crashfree India Rakshak Mentor</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{meta.title}</Heading>
          <Text style={text}>Hi {name || 'there'},</Text>
          {isAssignment ? (
            <>
              <Text style={text}>
                Thank you for applying to become a mentor for Project Rakshak.
              </Text>
              <Text style={text}>
                To move your application forward, please upload your assignment using the
                secure link below. PDF format is preferred.
              </Text>
            </>
          ) : (
            <Text style={text}>
              Thanks for applying to become a Rakshak mentor with Crashfree India. To move
              your application forward, please share {meta.what} using the secure link
              below.
            </Text>
          )}
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={upload_url} style={button}>
              Upload {isAssignment ? 'assignment' : 'resume'}
            </Button>
          </Section>
          <Text style={small}>
            Or copy and paste this link into your browser:
            <br />
            <Link href={upload_url} style={link}>{upload_url}</Link>
          </Text>
          {expires_on && (
            <Text style={small}>This upload link expires on {expires_on}.</Text>
          )}
          <Hr style={hr} />
          <Text style={footer}>
            Crashfree India · Rakshak Mentor Programme
            <br />
            If you didn't apply, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    data?.kind === 'assignment'
      ? 'Submit your Rakshak mentor assignment'
      : 'Share your resume — Rakshak mentor application',
  displayName: 'Mentor file request',
  previewData: {
    name: 'Asha',
    kind: 'resume',
    upload_url: 'https://example.com/rakshak-mentor/upload/abc123',
    expires_on: '30 Jun 2026',
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
