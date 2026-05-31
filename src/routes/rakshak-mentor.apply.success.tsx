import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/rakshak-mentor/apply/success")({
  validateSearch: (s) => z.object({ ref: z.string().optional() }).parse(s),
  head: () => ({
    meta: [{ title: "Application Submitted — Project Rakshak" }],
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const { ref } = Route.useSearch();
  return (
    <div className="max-w-2xl mx-auto px-5 py-20 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mb-6">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Application received.
      </h1>
      <p className="mt-3 text-slate-600">
        Thank you for applying to mentor Project Rakshak Cohort 2.
        Our team will review your submission and assignment, and we will
        respond within <strong>2–3 weeks</strong>.
      </p>
      {ref && (
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-100 border border-slate-200 text-sm">
          <span className="text-slate-500">Reference</span>
          <span className="font-mono font-bold text-slate-900">{ref}</span>
        </div>
      )}
      <div className="mt-10 text-sm text-slate-600">
        Questions? Write to{" "}
        <a className="text-[#4A35FF] underline" href="mailto:rakshak@crashfreeindia.org">
          rakshak@crashfreeindia.org
        </a>
      </div>
      <Link
        to="/rakshak-mentor"
        className="mt-10 inline-flex items-center text-sm font-semibold text-slate-700 hover:text-[#4A35FF]"
      >
        ← Return to portal
      </Link>
    </div>
  );
}
