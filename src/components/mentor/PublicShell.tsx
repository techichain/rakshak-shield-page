import { Link } from "@tanstack/react-router";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[#1A1C1C] flex flex-col">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/rakshak-mentor" className="flex items-center gap-3">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#4A35FF]" />
            <div className="leading-tight">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-medium">
                Crashfree India
              </div>
              <div className="text-sm font-bold tracking-tight">
                Project Rakshak · Mentor Application Portal
              </div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="/rakshak-mentor#programme" className="text-slate-700 hover:text-[#4A35FF] font-medium">Programme</a>
            <a href="/rakshak-mentor#role" className="text-slate-700 hover:text-[#4A35FF] font-medium">The Role</a>
            <a href="/rakshak-mentor#assignment" className="text-slate-700 hover:text-[#4A35FF] font-medium">Assignment</a>
            <Link
              to="/rakshak-mentor/apply"
              className="inline-flex items-center px-4 py-2 rounded-md bg-[#4A35FF] text-white font-semibold text-sm hover:bg-[#3A28D9] transition"
            >
              Apply Now
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-20 border-t border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-5 py-10 grid md:grid-cols-3 gap-8 text-sm">
          <div>
            <div className="font-semibold text-slate-900 mb-2">Crashfree India</div>
            <p className="text-slate-600 leading-relaxed">
              Vision Zero Trust — a national initiative for road-safety audit,
              accountability and implementation.
            </p>
          </div>
          <div>
            <div className="font-semibold text-slate-900 mb-2">Programme</div>
            <ul className="space-y-1 text-slate-600">
              <li>Project Rakshak — Cohort 2</li>
              <li>3-month mentor engagement</li>
              <li>4 student teams per mentor</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-slate-900 mb-2">Queries</div>
            <p className="text-slate-600">
              Write to <a className="text-[#4A35FF] underline" href="mailto:rakshak@crashfreeindia.org">rakshak@crashfreeindia.org</a>
            </p>
          </div>
        </div>
        <div className="border-t border-slate-200 py-4 text-xs text-slate-500 text-center">
          © {new Date().getFullYear()} Crashfree India · All rights reserved
        </div>
      </footer>
    </div>
  );
}
