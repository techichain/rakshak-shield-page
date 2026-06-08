import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, LogOut } from "lucide-react";
import { useRPAuth, rpSignOut } from "@/lib/rakshak-platform/auth";

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { userId, fullName, isAdmin, isMentor, isTeam, isEvaluator, isAuthority, isFinance } = useRPAuth();

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
            {isMentor && (
              <Link to="/rakshak-platform/mentor" className="text-muted-foreground hover:text-brand">
                Mentor
              </Link>
            )}
            {isTeam && (
              <>
                <Link to="/rakshak-platform/team" className="text-muted-foreground hover:text-brand">
                  My Team
                </Link>
                <Link to="/rakshak-platform/team/locations" className="text-muted-foreground hover:text-brand">
                  Locations
                </Link>
                <Link to="/rakshak-platform/team/reports" className="text-muted-foreground hover:text-brand">
                  Reports
                </Link>
              </>
            )}
          </nav>
          <div className="flex items-center gap-3">
            {userId ? (
              <>
                <button
                  className="relative h-9 w-9 rounded-full border border-border flex items-center justify-center hover:border-brand/40"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                </button>
                <span className="hidden sm:block text-xs text-muted-foreground max-w-[10rem] truncate">
                  {fullName}
                </span>
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
          </div>
        </div>
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
              <li><Link to="/rakshak-platform">How it works</Link></li>
            </ul>
          </div>
          <div className="text-sm text-brand-foreground/70">
            <div className="font-semibold text-brand-foreground mb-2">Contact</div>
            <p>hello@crashfreeindia.org</p>
          </div>
        </div>
      </footer>
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
