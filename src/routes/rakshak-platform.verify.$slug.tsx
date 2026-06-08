import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { verifyCertificate } from "@/lib/rakshak-platform/certificates.functions";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/verify/$slug")({
  loader: async ({ params, context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["rp-cert", params.slug],
      queryFn: () => verifyCertificate({ data: { slug: params.slug } }),
    }),
  component: VerifyPage,
  errorComponent: ({ error }) => (
    <PlatformShell>
      <Section>
        <p className="text-sm text-muted-foreground">Could not load certificate: {String(error)}</p>
      </Section>
    </PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell>
      <Section><p>Certificate not found.</p></Section>
    </PlatformShell>
  ),
});

function VerifyPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery({
    queryKey: ["rp-cert", slug],
    queryFn: () => verifyCertificate({ data: { slug } }),
  });
  const cert = data.certificate as any;
  if (!cert) {
    return (
      <PlatformShell>
        <Section>
          <Eyebrow>Verification</Eyebrow>
          <div className="mt-6 flex items-start gap-4 rounded-2xl border border-red-200 bg-red-50 p-6">
            <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
            <div>
              <h1 className="font-heading text-2xl">Certificate not found</h1>
              <p className="mt-2 text-sm text-red-700/80">
                No certificate matches this verification link. Please check the URL or contact the Crashfree India team.
              </p>
            </div>
          </div>
        </Section>
      </PlatformShell>
    );
  }

  const valid = !cert.is_revoked;
  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Certificate verification</Eyebrow>
        <div className={`mt-6 flex items-start gap-4 rounded-2xl border p-6 ${valid ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          {valid ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          ) : (
            <XCircle className="h-6 w-6 text-red-600" />
          )}
          <div>
            <h1 className="font-heading text-3xl tracking-tight">
              {valid ? "Verified certificate" : "Revoked certificate"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Serial <span className="font-mono">{cert.serial_no}</span> · issued {new Date(cert.issued_at).toLocaleDateString()}
            </p>
            {!valid && cert.revoked_reason && (
              <p className="mt-2 text-sm text-red-700">Reason: {cert.revoked_reason}</p>
            )}
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-background p-10">
          <div className="flex items-center gap-3 text-brand">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-semibold tracking-[0.25em] uppercase">Crashfree India · Project Rakshak</span>
          </div>
          <h2 className="mt-6 font-heading text-4xl tracking-tight">{cert.title}</h2>
          <p className="mt-4 text-lg">Awarded to <span className="font-semibold">{cert.recipient_name}</span></p>
          {cert.rp_teams && (
            <p className="mt-1 text-sm text-muted-foreground">
              Team {cert.rp_teams.team_name} · {cert.rp_teams.college ?? ""} · {cert.rp_teams.city}, {cert.rp_teams.state}
            </p>
          )}
          <div className="mt-8 grid gap-4 sm:grid-cols-3 text-sm">
            <div className="rounded-xl bg-brand-lite p-4">
              <div className="text-muted-foreground text-xs uppercase tracking-wide">Type</div>
              <div className="mt-1 font-medium capitalize">{cert.certificate_type.replace(/_/g, " ")}</div>
            </div>
            {cert.phase_number !== null && (
              <div className="rounded-xl bg-brand-lite p-4">
                <div className="text-muted-foreground text-xs uppercase tracking-wide">Phase</div>
                <div className="mt-1 font-medium">Phase {cert.phase_number}</div>
              </div>
            )}
            <div className="rounded-xl bg-brand-lite p-4">
              <div className="text-muted-foreground text-xs uppercase tracking-wide">Issued</div>
              <div className="mt-1 font-medium">{new Date(cert.issued_at).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      </Section>
    </PlatformShell>
  );
}
