import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { DOCUMENTS } from "@/lib/mentor/constants";
import { logEvent } from "@/lib/mentor/auth";
import { PublicShell } from "@/components/mentor/PublicShell";

export const Route = createFileRoute("/rakshak-mentor/")({
  head: () => ({
    meta: [
      { title: "Project Rakshak — Mentor Application Portal | Crashfree India" },
      {
        name: "description",
        content:
          "Apply to mentor the next cohort of Project Rakshak: a national road safety and infrastructure initiative by Crashfree India.",
      },
      { property: "og:title", content: "Project Rakshak — Mentor Application Portal" },
      {
        property: "og:description",
        content:
          "Senior road safety professionals: guide 4 student teams over a 3-month engagement.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  useEffect(() => {
    logEvent("page_view", "/rakshak-mentor", "mentor");
  }, []);

  return (
    <PublicShell>
      <div>
      {/* HERO */}
      <section className="border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-24 grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-7">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#4A35FF] font-semibold mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4A35FF]" />
              Cohort 2 · Mentor Recruitment Open
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1] text-slate-900">
              Mentor the next generation of road safety leaders.
            </h1>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed max-w-2xl">
              Project Rakshak is a youth-anchored road safety and infrastructure initiative by Crashfree India. The programme enables students to identify and assess high-risk locations, engage government and community stakeholders, and develop implementation-oriented recommendations to improve road safety outcomes.
            </p>
            <p className="mt-3 text-lg text-slate-600 leading-relaxed max-w-2xl">
              We are recruiting senior professionals to guide{" "}
              <strong className="text-slate-900">4 student teams</strong> each
              over a <strong className="text-slate-900">3-month engagement</strong>.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/rakshak-mentor/apply"
                className="inline-flex items-center px-6 py-3 rounded-md bg-[#4A35FF] text-white font-semibold hover:bg-[#3A28D9] transition"
              >
                Start Application
              </Link>
              <a
                href="#role"
                className="inline-flex items-center px-6 py-3 rounded-md border border-slate-300 text-slate-800 font-semibold hover:border-slate-900 transition"
              >
                Read the Role
              </a>
            </div>
          </div>

          <aside className="md:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-4">
              At a glance
            </div>
            <dl className="space-y-4 text-sm">
              <Fact label="Engagement" value="3 months" />
              <Fact label="Teams per mentor" value="4 student teams" />
              <Fact label="Time commitment" value="~4–6 hrs / week" />
              <Fact label="Format" value="Remote · structured milestones" />
              <Fact label="Honorarium" value="As per CFI mentor policy" />
            </dl>
          </aside>
        </div>
      </section>

      {/* THE ROLE */}
      <section id="role" className="border-b border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-5 py-16 grid md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Role & Responsibilities
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              Mentors are central to programme quality. You will guide four
              student teams from intake through final presentation, review
              milestone deliverables, and evaluate the rigour of their field
              assessment process and recommendations.
            </p>
            <a
              href={DOCUMENTS.mentorJD}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => logEvent("jd_download", "/rakshak-mentor", "mentor")}
              className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-md border-2 border-slate-900 text-slate-900 font-semibold hover:bg-slate-900 hover:text-white transition"
            >
              <DownloadIcon /> Download Mentor JD (PDF, 149 KB)
            </a>
          </div>
          <div className="md:col-span-7">
            <ul className="space-y-3 text-sm">
              {[
                "Conduct structured intake interviews with each assigned student team",
                "Review milestone deliverables: literature review, field plan, field assessment findings, recommendations",
                "Provide technical guidance grounded in road-safety standards and Indian context",
                "Evaluate the final presentation and contribute to programme-level reporting",
                "Participate in periodic mentor convenings with the CFI core team",
              ].map((item, i) => (
                <li key={i} className="flex gap-3 bg-white rounded-md p-4 border border-slate-200">
                  <span className="text-[#4A35FF] font-bold">▸</span>
                  <span className="text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ASSIGNMENT */}
      <section id="assignment" className="border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-5 py-16">
          <div className="grid md:grid-cols-12 gap-10 items-start">
            <div className="md:col-span-7">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                Assessment Exercise
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed">
                As part of the selection process, applicants are required to
                complete a short assessment exercise demonstrating their
                observation, analysis, and road safety review capabilities. Plan
                for roughly <strong>3–4 hours</strong> of focused work.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-slate-700">
                <li>· Read the brief carefully before starting</li>
                <li>· Submit as a single PDF or DOC, ≤ 25 MB</li>
                <li>· File name format: <code className="bg-slate-100 px-1.5 py-0.5 rounded">Lastname_Firstname_Rakshak_Assessment.pdf</code></li>
              </ul>
            </div>
            <div className="md:col-span-5 bg-[#F3F1FF] border border-[#4A35FF]/20 rounded-2xl p-6">
              <div className="text-xs uppercase tracking-wider text-[#4A35FF] font-semibold">
                Assessment Brief
              </div>
              <div className="mt-2 font-bold text-slate-900">
                Project Rakshak — Assessment Exercise
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Download the brief, complete the assessment exercise, and
                upload it with your application.
              </p>
              <a
                href={DOCUMENTS.mentorAssignment}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => logEvent("assignment_download", "/rakshak-mentor", "mentor")}
                className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-md bg-[#4A35FF] text-white font-semibold hover:bg-[#3A28D9] transition"
              >
                <DownloadIcon /> Download Exercise (PDF, 98 KB)
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="max-w-6xl mx-auto px-5 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Ready to apply?
          </h2>
          <p className="mt-3 text-slate-600 max-w-xl mx-auto">
            The form takes about 15 minutes once you have the assignment ready.
          </p>
          <Link
            to="/rakshak-mentor/apply"
            className="mt-7 inline-flex items-center px-8 py-3.5 rounded-md bg-slate-900 text-white font-semibold hover:bg-slate-800 transition"
          >
            Begin application →
          </Link>
        </div>
      </section>
      </div>
    </PublicShell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-200 pb-3 last:border-0 last:pb-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900 font-semibold text-right">{value}</dd>
    </div>
  );
}


function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
