import { Link } from "@tanstack/react-router";
import { useState } from "react";

export function PublicShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

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
                Project Rakshak · Mentor Portal
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="/rakshak-mentor#role" className="text-slate-700 hover:text-[#4A35FF] font-medium">The Role</a>
            <a href="/rakshak-mentor#assignment" className="text-slate-700 hover:text-[#4A35FF] font-medium">Assignment</a>
            <Link
              to="/rakshak-mentor/apply"
              className="inline-flex items-center px-4 py-2 rounded-md bg-[#4A35FF] text-white font-semibold text-sm hover:bg-[#3A28D9] transition"
            >
              Apply Now
            </Link>
          </nav>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 text-slate-700"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-5 py-4 space-y-3">
            <a href="/rakshak-mentor#role" className="block text-sm text-slate-700 hover:text-[#4A35FF] font-medium" onClick={() => setMenuOpen(false)}>The Role</a>
            <a href="/rakshak-mentor#assignment" className="block text-sm text-slate-700 hover:text-[#4A35FF] font-medium" onClick={() => setMenuOpen(false)}>Assignment</a>
            <Link
              to="/rakshak-mentor/apply"
              className="inline-flex items-center px-4 py-2 rounded-md bg-[#4A35FF] text-white font-semibold text-sm hover:bg-[#3A28D9] transition"
              onClick={() => setMenuOpen(false)}
            >
              Apply Now
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-auto border-t border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} Crashfree India · All rights reserved</span>
          <a className="text-[#4A35FF] hover:underline" href="mailto:rakshak@crashfreeindia.org">
            rakshak@crashfreeindia.org
          </a>
        </div>
      </footer>
    </div>
  );
}
