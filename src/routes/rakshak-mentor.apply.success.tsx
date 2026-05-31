import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { PublicShell } from "@/components/mentor/PublicShell";

const CONTACT_EMAIL = "muskan.yadav@crashfreeindia.org";

export const Route = createFileRoute("/rakshak-mentor/apply/success")({
  validateSearch: (s) => z.object({ ref: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Application Received — Project Rakshak Mentor" },
      {
        name: "description",
        content:
          "Your application for the Project Rakshak Cohort 2 Mentor Panel has been received.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const { ref } = Route.useSearch();

  return (
    <PublicShell>
      <div className="max-w-2xl mx-auto px-5 py-16">
        <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-10 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-700">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Application Received Successfully
              </h1>
              <p className="mt-2 text-sm font-medium text-emerald-700">
                Both your application form and assignment have been received.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-slate-700 leading-relaxed">
            <p>
              Your application for the <strong>Mentor Panel of Project Rakshak Cohort 2</strong> has
              been successfully received and is now under review.
            </p>

            {ref && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  Application Reference
                </div>
                <div className="mt-1 font-mono text-lg font-bold text-slate-900 select-all">
                  {ref}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Please retain this number for any future correspondence.
                </div>
              </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                What happens next
              </div>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700 list-disc pl-5">
                <li>Our team will review your submission and assignment.</li>
                <li>Expected review timeline: <strong>2–3 weeks</strong>.</li>
                <li>
                  Shortlisted candidates will be contacted regarding the next stage of the
                  selection process.
                </li>
              </ul>
            </div>

            <p className="text-sm">
              For queries, contact:{" "}
              <a
                className="text-[#4A35FF] font-semibold underline"
                href={`mailto:${CONTACT_EMAIL}?subject=Project%20Rakshak%20Mentor%20Application${
                  ref ? `%20-%20Ref%20${ref}` : ""
                }`}
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
            <Link
              to="/rakshak-mentor"
              className="text-sm font-semibold text-slate-700 hover:text-[#4A35FF]"
            >
              ← Return to portal
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              Print confirmation
            </button>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
