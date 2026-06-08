import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { listPublicSponsors, createSponsorshipPledge } from "@/lib/rakshak-platform/sponsorships.functions";
import { Heart, Award } from "lucide-react";

const TIERS = [
  { id: "friend",   label: "Friend",   amount: 1000,   blurb: "Powers a team's printing & travel for one phase." },
  { id: "bronze",   label: "Bronze",   amount: 10000,  blurb: "Fully funds one student team for a full cohort." },
  { id: "silver",   label: "Silver",   amount: 50000,  blurb: "Sponsors a city programme + mentor stipends." },
  { id: "gold",     label: "Gold",     amount: 200000, blurb: "Underwrites a full cohort across multiple colleges." },
  { id: "platinum", label: "Platinum", amount: 1000000,blurb: "Becomes the lead programme sponsor for the year." },
] as const;

export const Route = createFileRoute("/rakshak-platform/sponsor")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["rp-public-sponsors"],
      queryFn: () => listPublicSponsors(),
    }),
  component: SponsorPage,
  errorComponent: ({ error }) => (
    <PlatformShell><Section><p>Could not load page: {String(error)}</p></Section></PlatformShell>
  ),
  notFoundComponent: () => (
    <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>
  ),
  head: () => ({
    meta: [
      { title: "Sponsor Project Rakshak — Crashfree India" },
      { name: "description", content: "Sponsor a student team auditing India's deadliest roads. Pick a tier and back youth-led road safety." },
    ],
  }),
});

function SponsorPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["rp-public-sponsors"],
    queryFn: () => listPublicSponsors(),
  });
  const queryClient = useQueryClient();
  const submit = useServerFn(createSponsorshipPledge);
  const [tier, setTier] = useState<typeof TIERS[number]["id"]>("bronze");
  const [amount, setAmount] = useState<number>(10000);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sponsors = data.sponsors as any[];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const fd = new FormData(e.currentTarget);
    try {
      await submit({
        data: {
          sponsor_name: String(fd.get("name") || ""),
          sponsor_email: String(fd.get("email") || ""),
          sponsor_org: String(fd.get("org") || ""),
          message: String(fd.get("message") || ""),
          tier,
          amount_inr: amount,
          is_public: fd.get("public") === "on",
        },
      });
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["rp-public-sponsors"] });
    } catch (e: any) {
      setErr(e?.message ?? "Could not record pledge");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Back the programme</Eyebrow>
        <h1 className="mt-3 font-heading text-5xl md:text-6xl tracking-tight">
          Sponsor a team. <span className="text-brand">Save a road.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Every Project Rakshak team audits a real high-fatality stretch in their city and pitches fixes to authorities. Your sponsorship pays for fuel, printing, mentor stipends, and authority outreach.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-5">
          {TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTier(t.id); setAmount(t.amount); }}
              className={`text-left rounded-2xl border p-5 transition ${tier === t.id ? "border-brand bg-brand-lite" : "border-border bg-background hover:border-brand/40"}`}
            >
              <div className="font-heading text-lg">{t.label}</div>
              <div className="mt-1 font-semibold text-brand">₹{t.amount.toLocaleString("en-IN")}</div>
              <p className="mt-2 text-xs text-muted-foreground">{t.blurb}</p>
            </button>
          ))}
        </div>
      </Section>

      <Section tone="brand-lite">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <Eyebrow>Pledge form</Eyebrow>
            <h2 className="mt-3 font-heading text-3xl tracking-tight">
              Tell us about you.<br /><span className="text-brand">We'll send payment details.</span>
            </h2>
            <p className="mt-4 text-sm text-muted-foreground">
              This records your pledge. Our team will email you within one working day with payment instructions and an 80G donation receipt where applicable.
            </p>
          </div>
          <div>
            {done ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                <Heart className="h-6 w-6 text-emerald-600" />
                <h3 className="mt-3 font-heading text-2xl">Thank you.</h3>
                <p className="mt-2 text-sm text-emerald-800/80">
                  Your pledge is recorded. We'll be in touch shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-background p-6">
                <div>
                  <label className="text-xs text-muted-foreground">Your name *</label>
                  <input name="name" required maxLength={200} className="rp-input mt-1" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Email</label>
                    <input name="email" type="email" maxLength={200} className="rp-input mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Organisation</label>
                    <input name="org" maxLength={200} className="rp-input mt-1" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Amount (INR)</label>
                  <input
                    type="number" min={100} max={50_000_000} step={100} required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value || 0))}
                    className="rp-input mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Message (optional)</label>
                  <textarea name="message" maxLength={800} rows={3} className="rp-input mt-1" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="public" defaultChecked /> Show me on the public sponsor wall
                </label>
                {err && <p className="text-sm text-red-600">{err}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="h-11 rounded-full bg-brand px-6 text-sm text-brand-foreground inline-flex items-center hover:bg-brand/90 disabled:opacity-60"
                >
                  {busy ? "Submitting…" : `Pledge ₹${amount.toLocaleString("en-IN")}`}
                </button>
              </form>
            )}
          </div>
        </div>
      </Section>

      <Section>
        <Eyebrow>Sponsor wall</Eyebrow>
        <h2 className="mt-3 font-heading text-4xl tracking-tight">
          Thank you to the people<br /><span className="text-brand">making this possible.</span>
        </h2>
        {sponsors.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">Be the first to back Project Rakshak.</p>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sponsors.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-background p-5">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-brand" />
                  <span className="text-xs uppercase tracking-wide text-brand">{s.tier}</span>
                </div>
                <div className="mt-2 font-heading text-lg">{s.sponsor_name}</div>
                {s.sponsor_org && <div className="text-sm text-muted-foreground">{s.sponsor_org}</div>}
                {s.message && <p className="mt-3 text-sm">{s.message}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}
