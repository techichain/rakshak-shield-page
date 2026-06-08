import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { getFinanceDashboard, upsertFinanceEntry, deleteFinanceEntry } from "@/lib/rakshak-platform/finance.functions";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/finance")({
  component: FinancePage,
  errorComponent: ({ error }) => {
    if (String(error).includes("Forbidden") || String(error).includes("Unauthorized")) {
      throw redirect({ to: "/rakshak-platform/auth" });
    }
    return <PlatformShell><Section><p>Could not load finance: {String(error)}</p></Section></PlatformShell>;
  },
  notFoundComponent: () => <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>,
});

function inr(n: number) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function FinancePage() {
  const qc = useQueryClient();
  const fetchDash = useServerFn(getFinanceDashboard);
  const save = useServerFn(upsertFinanceEntry);
  const del = useServerFn(deleteFinanceEntry);
  const { data } = useSuspenseQuery({
    queryKey: ["rp-finance"],
    queryFn: () => fetchDash(),
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const fd = new FormData(e.currentTarget);
    try {
      await save({
        data: {
          entry_type: String(fd.get("entry_type") || "expense") as any,
          category: String(fd.get("category") || ""),
          amount_inr: Number(fd.get("amount") || 0),
          currency: "INR",
          description: String(fd.get("description") || ""),
          occurred_on: String(fd.get("occurred_on") || new Date().toISOString().slice(0, 10)),
        },
      });
      (e.currentTarget as HTMLFormElement).reset();
      qc.invalidateQueries({ queryKey: ["rp-finance"] });
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["rp-finance"] });
  }

  const { entries, totals, sponsorships } = data;
  const net = totals.inflows - totals.expenses;

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Programme finance</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Cash in. Cash out.<br /><span className="text-brand">Always transparent.</span>
        </h1>

        <div className="mt-10 grid gap-4 md:grid-cols-4">
          <Stat label="Inflows (logged)"  value={inr(totals.inflows)} tone="emerald" />
          <Stat label="Expenses"          value={inr(totals.expenses)} tone="red" />
          <Stat label="Net"                value={inr(net)} tone={net >= 0 ? "emerald" : "red"} />
          <Stat label="Pending sponsorships" value={inr(totals.pendingSponsors)} tone="amber" />
        </div>

        <form onSubmit={handleSave} className="mt-12 rounded-2xl border border-border bg-background p-6">
          <h2 className="font-heading text-xl">Add entry</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-6">
            <select name="entry_type" className="rp-input md:col-span-1">
              <option value="expense">Expense</option>
              <option value="reimbursement">Reimbursement</option>
              <option value="grant">Grant</option>
              <option value="sponsorship">Sponsorship</option>
              <option value="donation">Donation</option>
              <option value="other">Other</option>
            </select>
            <input name="category" required placeholder="Category" className="rp-input md:col-span-1" />
            <input name="amount" type="number" required min={0} step={0.01} placeholder="Amount (INR)" className="rp-input md:col-span-1" />
            <input name="occurred_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="rp-input md:col-span-1" />
            <input name="description" placeholder="Description" className="rp-input md:col-span-2" />
          </div>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          <button type="submit" disabled={busy} className="mt-4 inline-flex items-center gap-2 h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground hover:bg-brand/90 disabled:opacity-60">
            <Plus className="h-4 w-4" /> {busy ? "Saving…" : "Add entry"}
          </button>
        </form>

        <div className="mt-12">
          <h2 className="font-heading text-2xl">Ledger</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-brand-lite text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No entries yet.</td></tr>
                )}
                {entries.map((e: any) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-4 py-3">{e.occurred_on}</td>
                    <td className="px-4 py-3 capitalize">{e.entry_type}</td>
                    <td className="px-4 py-3">{e.category}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.description}</td>
                    <td className="px-4 py-3 text-right font-mono">{inr(Number(e.amount_inr))}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(e.id)} className="text-muted-foreground hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="font-heading text-2xl">Recent sponsorships</h2>
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-background">
            {sponsorships.length === 0 && <li className="p-6 text-sm text-muted-foreground">No sponsorships yet.</li>}
            {sponsorships.map((s: any) => (
              <li key={s.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <div className="font-medium">{s.sponsor_name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{s.tier} · {s.status}</div>
                </div>
                <div className="font-mono">{inr(Number(s.amount_inr))}</div>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </PlatformShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "red" | "amber" }) {
  const toneCls = tone === "emerald" ? "text-emerald-700" : tone === "red" ? "text-red-700" : "text-amber-700";
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-2 font-heading text-2xl ${toneCls}`}>{value}</div>
    </div>
  );
}
