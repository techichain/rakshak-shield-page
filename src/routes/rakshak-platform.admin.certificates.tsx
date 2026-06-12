import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { issueCertificate, revokeCertificate } from "@/lib/rakshak-platform/certificates.functions";
import { Award, ShieldOff, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/certificates")({
  loader: async ({ context }) => {
    const [{ data: certs }, { data: teams }] = await Promise.all([
      supabase.from("rp_certificates").select("*, rp_teams(team_name, city)").order("issued_at", { ascending: false }).limit(200),
      supabase.from("rp_teams").select("id, team_name, city").order("team_name"),
    ]);
    return { certs: certs ?? [], teams: teams ?? [] };
  },
  component: AdminCerts,
  errorComponent: ({ error }) => {
    if (String(error).includes("Forbidden") || String(error).includes("Unauthorized")) {
      throw redirect({ to: "/rakshak-platform/auth" });
    }
    return <PlatformShell><Section><p>{String(error)}</p></Section></PlatformShell>;
  },
  notFoundComponent: () => <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>,
});

function AdminCerts() {
  const initial = Route.useLoaderData();
  const qc = useQueryClient();
  const issue = useServerFn(issueCertificate);
  const revoke = useServerFn(revokeCertificate);
  const { data } = useSuspenseQuery({
    queryKey: ["rp-admin-certs"],
    queryFn: async () => {
      const [{ data: certs }, { data: teams }] = await Promise.all([
        supabase.from("rp_certificates").select("*, rp_teams(team_name, city)").order("issued_at", { ascending: false }).limit(200),
        supabase.from("rp_teams").select("id, team_name, city").order("team_name"),
      ]);
      return { certs: certs ?? [], teams: teams ?? [] };
    },
    initialData: initial,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleIssue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true); setErr(null);
    try {
      await issue({
        data: {
          team_id: String(fd.get("team_id")),
          certificate_type: String(fd.get("certificate_type") || "participation") as any,
          phase_number: fd.get("phase_number") ? Number(fd.get("phase_number")) : null,
          title: String(fd.get("title")),
          recipient_name: String(fd.get("recipient_name")),
        },
      });
      form.reset();
      qc.invalidateQueries({ queryKey: ["rp-admin-certs"] });
    } catch (e: any) {
      setErr(e?.message ?? "Issue failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    const reason = prompt("Reason for revoking?") ?? undefined;
    await revoke({ data: { id, reason } });
    qc.invalidateQueries({ queryKey: ["rp-admin-certs"] });
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Certificates</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">Issue recognition.<br /><span className="text-brand">Verifiable in one click.</span></h1>

        <form onSubmit={handleIssue} className="mt-10 rounded-2xl border border-border bg-background p-6 grid gap-3 md:grid-cols-6">
          <select name="team_id" required className="rp-input md:col-span-2">
            <option value="">Select team…</option>
            {data.teams.map((t: any) => (
              <option key={t.id} value={t.id}>{t.team_name} · {t.city}</option>
            ))}
          </select>
          <select name="certificate_type" className="rp-input">
            <option value="participation">Participation</option>
            <option value="phase_completion">Phase completion</option>
            <option value="programme_completion">Programme completion</option>
            <option value="excellence">Excellence</option>
          </select>
          <input name="phase_number" type="number" min={0} max={4} placeholder="Phase #" className="rp-input" />
          <input name="recipient_name" required maxLength={200} placeholder="Recipient name" className="rp-input md:col-span-1" />
          <input name="title" required maxLength={200} placeholder="Certificate title" className="rp-input md:col-span-1" />
          <div className="md:col-span-6 flex items-center justify-between">
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button type="submit" disabled={busy} className="ml-auto inline-flex items-center gap-2 h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90 disabled:opacity-60">
              <Award className="h-4 w-4" /> {busy ? "Issuing…" : "Issue certificate"}
            </button>
          </div>
        </form>

        <div className="mt-12 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-brand-lite text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Serial</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.certs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No certificates yet.</td></tr>
              )}
              {data.certs.map((c: any) => (
                <tr key={c.id} className={`border-t border-border ${c.is_revoked ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs">{c.serial_no}</td>
                  <td className="px-4 py-3">{c.recipient_name}</td>
                  <td className="px-4 py-3">{c.rp_teams?.team_name}</td>
                  <td className="px-4 py-3 capitalize text-xs">{c.certificate_type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-xs">{new Date(c.issued_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <Link
                      to="/rakshak-platform/verify/$slug"
                      params={{ slug: c.public_slug }}
                      className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Verify
                    </Link>
                    {!c.is_revoked && (
                      <button onClick={() => handleRevoke(c.id)} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline">
                        <ShieldOff className="h-3 w-3" /> Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </PlatformShell>
  );
}
