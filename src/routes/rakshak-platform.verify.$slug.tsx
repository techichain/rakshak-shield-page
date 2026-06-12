import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { verifyCertificate } from "@/lib/rakshak-platform/certificates.functions";
import { CheckCircle2, XCircle, ShieldCheck, Download } from "lucide-react";
import { jsPDF } from "jspdf";

function downloadCertificatePdf(cert: any) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.6);
  doc.rect(10, 10, W - 20, H - 20);
  doc.setLineWidth(0.2);
  doc.rect(13, 13, W - 26, H - 26);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text("CRASHFREE INDIA  ·  PROJECT RAKSHAK", W / 2, 26, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(
    "CERTIFICATE OF " + String(cert.certificate_type || "participation").replace(/_/g, " ").toUpperCase(),
    W / 2, 50, { align: "center" },
  );

  doc.setFont("times", "italic");
  doc.setFontSize(34);
  doc.setTextColor(20);
  doc.text(cert.title || "Certificate", W / 2, 70, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(110);
  doc.text("is hereby awarded to", W / 2, 88, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(40);
  doc.setTextColor(15);
  doc.text(cert.recipient_name || "", W / 2, 110, { align: "center" });

  doc.setDrawColor(20);
  doc.setLineWidth(0.4);
  doc.line(W / 2 - 60, 116, W / 2 + 60, 116);

  if (cert.rp_teams) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(80);
    const t = cert.rp_teams;
    const team = `Team ${t.team_name}${t.college ? " · " + t.college : ""}${t.city ? " · " + t.city : ""}${t.state ? ", " + t.state : ""}`;
    doc.text(team, W / 2, 128, { align: "center" });
  }

  if (cert.phase_number != null) {
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(`Phase ${cert.phase_number}`, W / 2, 138, { align: "center" });
  }

  const issued = new Date(cert.issued_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Issued ${issued}`, 25, H - 25);
  doc.text(`Serial  ${cert.serial_no}`, 25, H - 19);

  const verifyUrl = typeof window !== "undefined"
    ? `${window.location.origin}/rakshak-platform/verify/${cert.public_slug}`
    : `/rakshak-platform/verify/${cert.public_slug}`;
  doc.text("Verify at", W - 25, H - 25, { align: "right" });
  doc.setTextColor(40);
  doc.text(verifyUrl, W - 25, H - 19, { align: "right" });

  doc.setDrawColor(60);
  doc.setLineWidth(0.3);
  doc.line(W / 2 - 30, H - 25, W / 2 + 30, H - 25);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text("Crashfree India", W / 2, H - 19, { align: "center" });

  doc.save(`Rakshak-Certificate-${cert.serial_no}.pdf`);
}

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
          {valid && (
            <button
              onClick={() => downloadCertificatePdf(cert)}
              className="ml-auto inline-flex items-center gap-2 h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90"
            >
              <Download className="h-4 w-4" /> Download PDF
            </button>
          )}
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
