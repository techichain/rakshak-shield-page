import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitMentorApplication } from "@/lib/rakshak-platform/mentor-apply.functions";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/mentor-apply")({
  head: () => ({
    meta: [
      { title: "Become a Rakshak Mentor — Crashfree India" },
      { name: "description", content: "Apply to mentor student teams building road-safety solutions across India." },
    ],
  }),
  component: ApplyPage,
});

type Form = {
  full_name: string; email: string; phone: string; city: string; state: string;
  organization: string; designation: string; expertise: string; years_experience: string;
  linkedin_url: string; motivation: string;
};

const empty: Form = {
  full_name: "", email: "", phone: "", city: "", state: "",
  organization: "", designation: "", expertise: "", years_experience: "",
  linkedin_url: "", motivation: "",
};

function ApplyPage() {
  const submitFn = useServerFn(submitMentorApplication);
  const [form, setForm] = useState<Form>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function bind<K extends keyof Form>(k: K) {
    return {
      value: form[k],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [k]: e.target.value })),
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    const payload = {
      ...form,
      years_experience: form.years_experience ? Number(form.years_experience) : null,
    };
    const { error } = await supabase.from("rp_mentor_applications").insert(payload as any);
    setSubmitting(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
  }

  if (done) {
    return (
      <PlatformShell>
        <Section>
          <div className="max-w-xl mx-auto text-center py-16">
            <CheckCircle2 className="h-14 w-14 text-emerald-600 mx-auto" />
            <h1 className="font-heading text-3xl font-bold mt-6">Application received</h1>
            <p className="text-muted-foreground mt-3">
              Thanks for offering to mentor. Our team will review your application and reach out within 5–7 working days.
            </p>
          </div>
        </Section>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Become a mentor</Eyebrow>
        <h1 className="font-heading text-4xl sm:text-5xl font-bold leading-tight max-w-3xl mt-4">
          Help student teams build <span className="text-brand">safer roads</span>.
        </h1>
        <p className="text-muted-foreground max-w-2xl mt-4">
          Rakshak mentors guide 3–5 student teams through a 6-month road-safety programme — reviewing
          their research, audits, and authority pitches. Commit ~2 hours per week.
        </p>

        <form onSubmit={submit} className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          <Field label="Full name *"><input required {...bind("full_name")} className={inp} /></Field>
          <Field label="Email *"><input required type="email" {...bind("email")} className={inp} /></Field>
          <Field label="Phone"><input {...bind("phone")} className={inp} /></Field>
          <Field label="LinkedIn URL"><input {...bind("linkedin_url")} className={inp} /></Field>
          <Field label="City"><input {...bind("city")} className={inp} /></Field>
          <Field label="State"><input {...bind("state")} className={inp} /></Field>
          <Field label="Organisation"><input {...bind("organization")} className={inp} /></Field>
          <Field label="Designation"><input {...bind("designation")} className={inp} /></Field>
          <Field label="Primary expertise (e.g. urban planning, traffic engineering, public policy)">
            <input {...bind("expertise")} className={inp} />
          </Field>
          <Field label="Years of experience"><input type="number" min={0} {...bind("years_experience")} className={inp} /></Field>
          <Field label="Why do you want to mentor? *" full>
            <textarea required rows={5} {...bind("motivation")} className={inp} />
          </Field>

          {err && <p className="md:col-span-2 text-sm text-red-700">{err}</p>}

          <div className="md:col-span-2">
            <button
              disabled={submitting}
              className="h-12 rounded-full bg-brand px-8 text-sm text-brand-foreground hover:bg-brand/90 inline-flex items-center gap-2 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit application
            </button>
          </div>
        </form>
      </Section>
    </PlatformShell>
  );
}

const inp = "w-full h-11 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
