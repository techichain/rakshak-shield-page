import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { listAllSponsorships, updateSponsorshipStatus } from "@/lib/rakshak-platform/sponsorships.functions";

export const Route = createFileRoute("/rakshak-platform/admin/sponsorships")({
  component: AdminSponsorships,
  errorComponent: ({ error }) => {
    if (String(error).includes("Forbidden") || String(error).includes("Unauthorized")) {
      throw redirect({ to: "/rakshak-platform/auth" });
    }
    return <PlatformShell><Section><p>{String(error)}</p></Section></PlatformShell>;
  },
  notFoundComponent: () => <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>,
});

function AdminSponsorships() {
  const qc = useQueryClient();
  const list = useServerFn(listAllSponsorships);
  const updateStatus = useServerFn(updateSponsorshipStatus);
  const { data } = useSuspenseQuery({
    queryKey: ["rp-admin-sponsors"],
    queryFn: () => list(),
  });

  async function setStatus(id: string, status: "paid" | "refunded" | "cancelled") {
    await updateStatus({ data: { id, status } });
    qc.invalidateQueries({ queryKey: ["rp-admin-sponsors"] });
    qc.invalidateQueries({ queryKey: ["rp-public-sponsors"] });
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Sponsorship inbox</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">Pledges, payments,<br /><span className="text-brand">and follow-ups.</span></h1>
        <div className="mt-10 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-brand-lite text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Sponsor</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.sponsorships.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No pledges yet.</td></tr>
              )}
              {data.sponsorships.map((s: any) => (
                <tr key={s.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.sponsor_name}</div>
                    {s.sponsor_org && <div className="text-xs text-muted-foreground">{s.sponsor_org}</div>}
                    {s.sponsor_email && <div className="text-xs text-muted-foreground">{s.sponsor_email}</div>}
                  </td>
                  <td className="px-4 py-3 capitalize">{s.tier}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    ₹{Number(s.amount_inr).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 capitalize">{s.status}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {s.status === "pending" && (
                      <>
                        <button onClick={() => setStatus(s.id, "paid")} className="text-xs text-emerald-700 hover:underline">Mark paid</button>
                        <button onClick={() => setStatus(s.id, "cancelled")} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                      </>
                    )}
                    {s.status === "paid" && (
                      <button onClick={() => setStatus(s.id, "refunded")} className="text-xs text-muted-foreground hover:underline">Refund</button>
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
