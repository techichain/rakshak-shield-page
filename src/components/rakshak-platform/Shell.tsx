import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Toaster } from "sonner";
import { useRPAuth, rpSignOut } from "@/lib/rakshak-platform/auth";
import { NotificationBell } from "@/components/rakshak-platform/NotificationBell";
import { GlobalSearch } from "@/components/rakshak-platform/GlobalSearch";

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { userId, fullName, isAdmin, isMentor, isTeam, isEvaluator, isAuthority, isFinance } = useRPAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="rp-platform min-h-screen">
      <header className="border-b border-border bg-background sticky top-0 z-40">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 md:px-10 h-16">
          <Link to="/rakshak-platform" className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-sm bg-brand" />
            <span className="font-heading text-base font-bold tracking-tight">
              Crashfree India · Project Rakshak
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link to="/rakshak-platform/map" className="text-muted-foreground hover:text-brand">
              Hotspots
            </Link>
            <Link to="/rakshak-platform/knowledge" className="text-muted-foreground hover:text-brand">
              Knowledge
            </Link>
            <Link to="/rakshak-platform/leaderboard" className="text-muted-foreground hover:text-brand">
              Leaderboard
            </Link>
            <Link to="/rakshak-platform/impact" className="text-muted-foreground hover:text-brand">
              Impact
            </Link>
            <Link to="/rakshak-platform/mentors" className="text-muted-foreground hover:text-brand">
              Mentors
            </Link>
            <Link to="/rakshak-platform/sponsor" className="text-muted-foreground hover:text-brand">
              Sponsor
            </Link>
            {(isAuthority || isAdmin) && (
              <Link to="/rakshak-platform/authority" className="text-muted-foreground hover:text-brand">
                Authority
              </Link>
            )}
            {(isEvaluator || isAdmin) && (
              <Link to="/rakshak-platform/evaluator" className="text-muted-foreground hover:text-brand">
                Evaluator
              </Link>
            )}
            {isAdmin && (
              <>
                <Link to="/rakshak-platform/admin" className="text-muted-foreground hover:text-brand">
                  Admin
                </Link>
                <Link to="/rakshak-platform/admin/certificates" className="text-muted-foreground hover:text-brand">
                  Certificates
                </Link>
                <Link to="/rakshak-platform/admin/knowledge" className="text-muted-foreground hover:text-brand">
                  Articles
                </Link>
                <Link to="/rakshak-platform/admin/map" className="text-muted-foreground hover:text-brand">
                  Programme map
                </Link>
                <Link to="/rakshak-platform/admin/analytics" className="text-muted-foreground hover:text-brand">
                  Analytics
                </Link>
                <Link to="/rakshak-platform/admin/mentor-applications" className="text-muted-foreground hover:text-brand">
                  Mentor apps
                </Link>
                <Link to="/rakshak-platform/admin/bulk-import" className="text-muted-foreground hover:text-brand">
                  Import
                </Link>
                <Link to="/rakshak-platform/admin/exports" className="text-muted-foreground hover:text-brand">
                  Exports
                </Link>
                <Link to="/rakshak-platform/admin/audit" className="text-muted-foreground hover:text-brand">
                  Audit
                </Link>
                <Link to="/rakshak-platform/admin/meetings" className="text-muted-foreground hover:text-brand">
                  Meetings
                </Link>
                <Link to="/rakshak-platform/admin/cohorts" className="text-muted-foreground hover:text-brand">
                  Cohorts
                </Link>
                <Link to="/rakshak-platform/admin/cron-health" className="text-muted-foreground hover:text-brand">
                  Cron
                </Link>
                <Link to="/rakshak-platform/admin/roles" className="text-muted-foreground hover:text-brand">
                  Roles
                </Link>
                <Link to="/rakshak-platform/admin/evaluator-queue" className="text-muted-foreground hover:text-brand">
                  Evaluator queue
                </Link>
                <Link to="/rakshak-platform/admin/evaluator-leaderboard" className="text-muted-foreground hover:text-brand">
                  Eval analytics
                </Link>
                <Link to="/rakshak-platform/admin/alerts" className="text-muted-foreground hover:text-brand">
                  Alerts
                </Link>
                <Link to="/rakshak-platform/admin/qa" className="text-muted-foreground hover:text-brand">
                  QA
                </Link>
                <Link to="/rakshak-platform/admin/integrations" className="text-muted-foreground hover:text-brand">
                  Integrations
                </Link>
                <Link to="/rakshak-platform/admin/seed" className="text-muted-foreground hover:text-brand">
                  Seed
                </Link>
              </>
            )}
            {(isAdmin || isFinance) && (
              <>
                <Link to="/rakshak-platform/admin/finance" className="text-muted-foreground hover:text-brand">
                  Finance
                </Link>
                <Link to="/rakshak-platform/admin/sponsorships" className="text-muted-foreground hover:text-brand">
                  Sponsorships
                </Link>
              </>
            )}
            {(isMentor || isTeam) && (
              <Link to="/rakshak-platform/meetings" className="text-muted-foreground hover:text-brand">
                Meetings
              </Link>
            )}
            {isMentor && (
              <Link to="/rakshak-platform/mentor" className="text-muted-foreground hover:text-brand">
                Mentor
              </Link>
            )}
            {isMentor && (
              <Link to="/rakshak-platform/mentor/availability" className="text-muted-foreground hover:text-brand">
                Availability
              </Link>
            )}
            {isTeam && (
              <>
                <Link to="/rakshak-platform/team" className="text-muted-foreground hover:text-brand">
                  My Team
                </Link>
                <Link to="/rakshak-platform/team/phases" className="text-muted-foreground hover:text-brand">
                  Phases
                </Link>
                <Link to="/rakshak-platform/team/locations" className="text-muted-foreground hover:text-brand">
                  Locations
                </Link>
                <Link to="/rakshak-platform/team/reports" className="text-muted-foreground hover:text-brand">
                  Reports
                </Link>
                <Link to="/rakshak-platform/team/ai-check" className="text-muted-foreground hover:text-brand">
                  AI check
                </Link>
              </>
            )}
          </nav>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <div className="hidden lg:block w-72"><GlobalSearch /></div>
            )}
            {userId ? (
              <>
                <NotificationBell userId={userId} />
                <Link
                  to="/rakshak-platform/profile"
                  className="hidden sm:block text-xs text-muted-foreground hover:text-brand max-w-[10rem] truncate"
                >
                  {fullName}
                </Link>
                <button
                  onClick={async () => {
                    await rpSignOut();
                    navigate({ to: "/rakshak-platform/auth" });
                  }}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-brand"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              </>
            ) : (
              <Link
                to="/rakshak-platform/auth"
                className="h-10 rounded-full bg-brand px-5 text-sm text-brand-foreground inline-flex items-center hover:bg-brand/90"
              >
                Sign in
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle navigation"
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-brand"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <nav className="mx-auto w-full max-w-7xl px-6 py-4 flex flex-col gap-3 text-sm">
              <Link to="/rakshak-platform/map" onClick={() => setMenuOpen(false)}>Hotspots</Link>
              <Link to="/rakshak-platform/knowledge" onClick={() => setMenuOpen(false)}>Knowledge</Link>
              <Link to="/rakshak-platform/leaderboard" onClick={() => setMenuOpen(false)}>Leaderboard</Link>
              <Link to="/rakshak-platform/impact" onClick={() => setMenuOpen(false)}>Impact</Link>
              <Link to="/rakshak-platform/mentors" onClick={() => setMenuOpen(false)}>Mentors</Link>
              <Link to="/rakshak-platform/sponsor" onClick={() => setMenuOpen(false)}>Sponsor</Link>
              {(isAuthority || isAdmin) && <Link to="/rakshak-platform/authority" onClick={() => setMenuOpen(false)}>Authority</Link>}
              {(isEvaluator || isAdmin) && <Link to="/rakshak-platform/evaluator" onClick={() => setMenuOpen(false)}>Evaluator</Link>}
              {(isMentor || isTeam) && <Link to="/rakshak-platform/meetings" onClick={() => setMenuOpen(false)}>Meetings</Link>}
              {isMentor && <Link to="/rakshak-platform/mentor" onClick={() => setMenuOpen(false)}>Mentor</Link>}
              {isTeam && (
                <>
                  <Link to="/rakshak-platform/team" onClick={() => setMenuOpen(false)}>My Team</Link>
                  <Link to="/rakshak-platform/team/locations" onClick={() => setMenuOpen(false)}>Locations</Link>
                  <Link to="/rakshak-platform/team/reports" onClick={() => setMenuOpen(false)}>Reports</Link>
                  <Link to="/rakshak-platform/team/ai-check" onClick={() => setMenuOpen(false)}>AI check</Link>
                </>
              )}
              {(isAdmin || isFinance) && (
                <>
                  <Link to="/rakshak-platform/admin/finance" onClick={() => setMenuOpen(false)}>Finance</Link>
                  <Link to="/rakshak-platform/admin/sponsorships" onClick={() => setMenuOpen(false)}>Sponsorships</Link>
                </>
              )}
              {isAdmin && (
                <>
                  <Link to="/rakshak-platform/admin" onClick={() => setMenuOpen(false)}>Admin</Link>
                  <Link to="/rakshak-platform/admin/analytics" onClick={() => setMenuOpen(false)}>Analytics</Link>
                  <Link to="/rakshak-platform/admin/mentor-applications" onClick={() => setMenuOpen(false)}>Mentor applications</Link>
                  <Link to="/rakshak-platform/admin/bulk-import" onClick={() => setMenuOpen(false)}>Bulk import</Link>
                  <Link to="/rakshak-platform/admin/exports" onClick={() => setMenuOpen(false)}>Exports</Link>
                  <Link to="/rakshak-platform/admin/audit" onClick={() => setMenuOpen(false)}>Audit</Link>
                  <Link to="/rakshak-platform/admin/meetings" onClick={() => setMenuOpen(false)}>All meetings</Link>
                  <Link to="/rakshak-platform/admin/seed" onClick={() => setMenuOpen(false)}>Seed</Link>
                </>
              )}
            </nav>
          </div>
        )}
      </header>
      {children}
      <footer className="border-t border-border bg-brand text-brand-foreground">
        <div className="mx-auto w-full max-w-7xl px-6 md:px-10 py-12 grid gap-8 md:grid-cols-3">
          <div>
            <div className="font-heading text-lg font-bold">Crashfree India</div>
            <p className="mt-3 text-sm text-brand-foreground/70">
              Project Rakshak is a youth-led road safety audit programme run across Indian cities.
            </p>
          </div>
          <div className="text-sm text-brand-foreground/70">
            <div className="font-semibold text-brand-foreground mb-2">Platform</div>
            <ul className="space-y-1">
              <li><Link to="/rakshak-platform/auth">Sign in</Link></li>
              <li><Link to="/rakshak-platform/map">Hotspot map</Link></li>
              <li><Link to="/rakshak-platform/knowledge">Knowledge hub</Link></li>
              <li><Link to="/rakshak-platform/leaderboard">Leaderboard</Link></li>
              <li><Link to="/rakshak-platform/impact">Impact</Link></li>
              <li><Link to="/rakshak-platform/mentors">Mentor network</Link></li>
              <li><Link to="/rakshak-platform/sponsor">Sponsor</Link></li>
              <li><Link to="/rakshak-platform/mentor-apply">Become a mentor</Link></li>
              <li><Link to="/rakshak-platform">How it works</Link></li>
            </ul>
          </div>
          <div className="text-sm text-brand-foreground/70">
            <div className="font-semibold text-brand-foreground mb-2">Contact</div>
            <p>hello@crashfreeindia.org</p>
          </div>
        </div>
      </footer>
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}

export function Section({
  tone = "background",
  children,
  className = "",
}: {
  tone?: "background" | "brand-lite" | "brand";
  children: React.ReactNode;
  className?: string;
}) {
  const bg =
    tone === "brand"
      ? "bg-brand text-brand-foreground"
      : tone === "brand-lite"
      ? "bg-brand-lite"
      : "bg-background";
  return (
    <section className={`border-t border-border ${bg}`}>
      <div className={`mx-auto w-full max-w-7xl px-6 md:px-10 py-24 lg:py-32 ${className}`}>
        {children}
      </div>
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.25em] text-brand">
      {children}
    </span>
  );
}
