import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { EXPERTISE_DOMAINS } from "@/lib/mentor/constants";
import { logEvent } from "@/lib/mentor/auth";
import { PublicShell } from "@/components/mentor/PublicShell";

export const Route = createFileRoute("/rakshak-mentor/apply")({
  head: () => ({
    meta: [
      { title: "Apply — Project Rakshak Mentor | Crashfree India" },
      {
        name: "description",
        content:
          "Submit your application to mentor Project Rakshak Cohort 2 student teams.",
      },
    ],
  }),
  component: ApplyPage,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(20),
  city: z.string().trim().min(2, "City is required").max(80),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().min(2).max(80).default("India"),
  organisation: z.string().trim().max(160).optional().or(z.literal("")),
  designation: z.string().trim().max(160).optional().or(z.literal("")),
  linkedin_url: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .max(255)
    .optional()
    .or(z.literal("")),
  years_experience: z.coerce.number().int().min(0).max(60),
  expertise_domain: z.string().min(1, "Select your primary expertise"),
  motivation: z.string().trim().min(80, "At least 80 characters").max(2000),
  relevant_experience: z.string().trim().min(80, "At least 80 characters").max(2000),
  availability_confirm: z.literal(true, {
    errorMap: () => ({ message: "Please confirm availability" }),
  }),
});

type FormState = {
  full_name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  organisation: string;
  designation: string;
  linkedin_url: string;
  years_experience: string;
  expertise_domain: string;
  motivation: string;
  relevant_experience: string;
  availability_confirm: boolean;
};

const initial: FormState = {
  full_name: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  country: "India",
  organisation: "",
  designation: "",
  linkedin_url: "",
  years_experience: "",
  expertise_domain: "",
  motivation: "",
  relevant_experience: "",
  availability_confirm: false,
};

const MAX_FILE_BYTES = 25 * 1024 * 1024;

function getErrorMessage(err: unknown) {
  return (
    (err as { message?: string } | null)?.message ??
    (typeof err === "string" ? err : null) ??
    "Something went wrong. Please try again."
  );
}

async function withTimeout<T>(label: string, promise: PromiseLike<T>, ms = 30000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`${label} timed out. Please check your connection and try again.`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function ApplyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState<FormState>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [resume, setResume] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    logEvent("apply_start", "/rakshak-mentor/apply", "mentor");
  }, []);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const validateDoc = (f: File): string | null => {
    if (f.size > MAX_FILE_BYTES) return "File must be ≤ 25 MB";
    const ok = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ].includes(f.type);
    if (!ok) return "Only PDF or DOC/DOCX allowed";
    return null;
  };

  const onFile = (f: File | null) => {
    setFileError(null);
    if (!f) return setFile(null);
    const err = validateDoc(f);
    if (err) { setFileError(err); return; }
    setFile(f);
  };

  const onResume = (f: File | null) => {
    setResumeError(null);
    if (!f) return setResume(null);
    const err = validateDoc(f);
    if (err) { setResumeError(err); return; }
    setResume(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrors({});
    setSubmitError(null);



    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const eMap: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        eMap[i.path[0] as string] = i.message;
      }
      setErrors(eMap);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!file) {
      setFileError("Please upload your completed assignment");
      return;
    }

    setSubmitting(true);
    try {
      const d = parsed.data;
      const { motivation, relevant_experience, ...rest } = d;
      const applicationId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const applicationRef = applicationId.replaceAll("-", "").slice(0, 8).toUpperCase();

      const { error: insErr } = await withTimeout(
        "Creating the application record",
        supabase.from("applications").insert({
          id: applicationId,
          track: "mentor",
          full_name: rest.full_name,
          email: rest.email.toLowerCase(),
          phone: rest.phone,
          city: rest.city,
          state: rest.state || null,
          country: rest.country,
          organisation: rest.organisation || null,
          designation: rest.designation || null,
          linkedin_url: rest.linkedin_url || null,
          years_experience: rest.years_experience,
          expertise_domain: rest.expertise_domain,
          track_data: { motivation, relevant_experience, application_reference: applicationRef },
        }),
      );

      if (insErr) throw insErr;

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${applicationId}/assignment_${Date.now()}_${safeName}`;

      const { error: upErr } = await withTimeout(
        "Uploading the assignment file",
        supabase.storage
          .from("mentor-applications")
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
          }),
        60000,
      );
      if (upErr) throw upErr;

      const { error: fileErr } = await withTimeout(
        "Recording the assignment upload",
        supabase.from("application_files").insert({
          application_id: applicationId,
          kind: "assignment",
          storage_bucket: "mentor-applications",
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        }),
      );
      if (fileErr) throw fileErr;

      void logEvent("apply_submit", "/rakshak-mentor/apply", "mentor");

      const successUrl = `/rakshak-mentor/apply/success?ref=${encodeURIComponent(applicationRef)}`;
      const redirectFallback = window.setTimeout(() => {
        setSubmitting(false);
        window.location.assign(successUrl);
      }, 1200);

      try {
        await navigate({
          to: "/rakshak-mentor/apply/success",
          search: { ref: applicationRef } as never,
        });
        window.clearTimeout(redirectFallback);
      } catch (navErr) {
        console.error("Application success redirect failed:", navErr);
        window.clearTimeout(redirectFallback);
        setSubmitting(false);
        window.location.assign(successUrl);
      }
    } catch (err) {
      const msg = getErrorMessage(err);
      console.error("Application submission failed:", err);
      setSubmitError(msg);
      setSubmitting(false);
    }
  };

  if (location.pathname.endsWith("/success")) {
    return <Outlet />;
  }

  return (
    <PublicShell>
    <div className="max-w-3xl mx-auto px-5 py-12">
      <div className="mb-8">
        <Link to="/rakshak-mentor" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
          Mentor Application — Cohort 2
        </h1>
        <p className="mt-2 text-slate-600">
          All fields marked with <span className="text-red-600">*</span> are required.
          Plan ~15 minutes once your assignment is ready.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-8 bg-white">
        <Section title="Personal details">
          <Field label="Full name" error={errors.full_name} required>
            <input className={inputCls} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} maxLength={120} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Email" error={errors.email} required>
              <input type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} maxLength={255} />
            </Field>
            <Field label="Phone (with country code)" error={errors.phone} required>
              <input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={20} placeholder="+91 98xxxxxxxx" />
            </Field>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="City" error={errors.city} required>
              <input className={inputCls} value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={80} />
            </Field>
            <Field label="State" error={errors.state}>
              <input className={inputCls} value={form.state} onChange={(e) => set("state", e.target.value)} maxLength={80} />
            </Field>
            <Field label="Country" error={errors.country} required>
              <input className={inputCls} value={form.country} onChange={(e) => set("country", e.target.value)} maxLength={80} />
            </Field>
          </div>
        </Section>

        <Section title="Professional background">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Current organisation" error={errors.organisation}>
              <input className={inputCls} value={form.organisation} onChange={(e) => set("organisation", e.target.value)} maxLength={160} />
            </Field>
            <Field label="Designation" error={errors.designation}>
              <input className={inputCls} value={form.designation} onChange={(e) => set("designation", e.target.value)} maxLength={160} />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Years of experience" error={errors.years_experience} required>
              <input type="number" className={inputCls} value={form.years_experience} onChange={(e) => set("years_experience", e.target.value)} min={0} max={60} />
            </Field>
            <Field label="LinkedIn URL" error={errors.linkedin_url}>
              <input type="url" className={inputCls} value={form.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/…" maxLength={255} />
            </Field>
          </div>
          <Field label="Primary expertise" error={errors.expertise_domain} required>
            <select className={inputCls} value={form.expertise_domain} onChange={(e) => set("expertise_domain", e.target.value)}>
              <option value="">Select…</option>
              {EXPERTISE_DOMAINS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>
        </Section>

        <Section title="Motivation & experience">
          <Field label="Why are you applying to mentor Project Rakshak?" error={errors.motivation} required>
            <textarea className={textareaCls} rows={5} value={form.motivation} onChange={(e) => set("motivation", e.target.value)} maxLength={2000} />
            <CharCount value={form.motivation} max={2000} />
          </Field>
          <Field label="Relevant road safety / mentoring experience" error={errors.relevant_experience} required>
            <textarea className={textareaCls} rows={5} value={form.relevant_experience} onChange={(e) => set("relevant_experience", e.target.value)} maxLength={2000} />
            <CharCount value={form.relevant_experience} max={2000} />
          </Field>
        </Section>

        <Section title="Assignment upload">
          <p className="text-sm text-slate-600">
            Upload your completed assignment as a single PDF or DOC/DOCX. Maximum 25 MB.
          </p>
          <div className="mt-2 border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-[#4A35FF] transition">
            <input
              id="assignment-file"
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            <label htmlFor="assignment-file" className="cursor-pointer">
              <div className="text-sm font-semibold text-slate-900">
                {file ? file.name : "Click to choose file"}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {file
                  ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                  : "PDF or DOC/DOCX · max 25 MB"}
              </div>
            </label>
          </div>
          {fileError && <div className="text-sm text-red-600 mt-2">{fileError}</div>}
        </Section>

        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
          <label className="flex gap-3 items-start text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.availability_confirm}
              onChange={(e) => set("availability_confirm", e.target.checked)}
            />
            <span>
              I confirm I can commit ~4–6 hours per week for a 3-month engagement
              and mentor up to 4 student teams. <span className="text-red-600">*</span>
            </span>
          </label>
          {errors.availability_confirm && (
            <div className="text-sm text-red-600 mt-2">{errors.availability_confirm}</div>
          )}
        </div>

        {submitError && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
            <div className="font-semibold mb-1">Submission failed</div>
            <div>{submitError}</div>
            <div className="mt-1 text-xs text-red-600">
              Your information has been kept. Please try again.
            </div>
          </div>
        )}

        <fieldset disabled={submitting} className="contents">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              By submitting, you agree to your information being used solely for the
              Project Rakshak mentor selection process.
            </p>
            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-[#4A35FF] text-white font-semibold hover:bg-[#3A28D9] disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {submitting && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {submitting ? "Submitting your application…" : "Submit Application"}
            </button>
          </div>
        </fieldset>
      </form>

    </div>
    </PublicShell>
  );
}

const inputCls =
  "w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#4A35FF]/30 focus:border-[#4A35FF]";
const textareaCls = inputCls + " resize-y";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-200">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {children}
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <div className="text-[11px] text-slate-400 mt-1 text-right">
      {value.length} / {max}
    </div>
  );
}
