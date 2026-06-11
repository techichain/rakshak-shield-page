import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  code?: string;
  role?: string;
  expiresInMinutes?: number;
}

const RegistrationOtpEmail = ({
  code = "000000",
  role = "team",
  expiresInMinutes = 10,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Project Rakshak verification code is {code}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Verify your email</Heading>
        <Text style={text}>
          Use the 6-digit code below to finish creating your Project Rakshak{" "}
          <strong>{role}</strong> account.
        </Text>
        <Section style={codeBox}>
          <Text style={codeStyle}>{code}</Text>
        </Section>
        <Text style={text}>
          This code expires in {expiresInMinutes} minutes. If you didn't request
          this, you can safely ignore the email.
        </Text>
        <Text style={footer}>Project Rakshak · Crash Free India</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: RegistrationOtpEmail,
  subject: (data: Record<string, unknown>) =>
    `Your Project Rakshak verification code: ${(data?.code as string) ?? ""}`,
  displayName: "Registration verification code",
  previewData: { code: "428193", role: "team", expiresInMinutes: 10 },
} satisfies TemplateEntry;

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
};
const container = { padding: "32px 24px", maxWidth: "520px" };
const h1 = { fontSize: "22px", fontWeight: 700, color: "#0f172a", margin: "0 0 16px" };
const text = { fontSize: "15px", lineHeight: "22px", color: "#334155", margin: "0 0 16px" };
const codeBox = {
  background: "#f1f5f9",
  borderRadius: "12px",
  padding: "20px 0",
  textAlign: "center" as const,
  margin: "24px 0",
};
const codeStyle = {
  fontSize: "34px",
  fontWeight: 700,
  letterSpacing: "12px",
  color: "#0f172a",
  margin: 0,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};
const footer = { fontSize: "12px", color: "#94a3b8", marginTop: "24px" };
