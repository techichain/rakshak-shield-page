import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown, LogOut, Menu, X,
  MapPin, BookOpen, Trophy, Sparkles, Users, HeartHandshake,
  ShieldCheck, ClipboardCheck, CalendarDays, GraduationCap, UsersRound,
  LayoutDashboard, FileText, UserCog, ScanSearch, Wrench, Wallet,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { useRPAuth, rpSignOut } from "@/lib/rakshak-platform/auth";
import { NotificationBell } from "@/components/rakshak-platform/NotificationBell";
import { GlobalSearch } from "@/components/rakshak-platform/GlobalSearch";

type NavItem = { to: string; label: string; icon?: LucideIcon; desc?: string };

function NavLink({ to, label, icon: Icon }: { to: string; label: string; icon?: LucideIcon }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: false }}
      activeProps={{ className: "text-brand bg-brand-lite font-semibold" }}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-foreground hover:text-brand hover:bg-brand-lite transition-colors"
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </Link>
  );
}

function NavDropdown({
  label,
  icon: Icon,
  items,
  openId,
  setOpenId,
  id,
}: {
  label: string;
  icon?: LucideIcon;
  items: NavItem[];
  openId: string | null;
  setOpenId: (v: string | null) => void;
  id: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const open = openId === id;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpenId(null);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenId(null); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, setOpenId]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpenId(open ? null : id)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors ${
          open ? "text-brand bg-brand-lite font-semibold" : "text-foreground/80 hover:text-brand hover:bg-brand-lite"
        }`}
      >
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 min-w-[14rem] rounded-xl border border-border bg-background shadow-xl shadow-foreground/10 p-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          {items.map((item) => {
            const IIcon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpenId(null)}
                activeProps={{ className: "bg-brand-lite text-brand" }}
                className="flex items-start gap-2.5 rounded-md px-3 py-2 text-sm text-foreground/80 hover:bg-brand-lite hover:text-brand whitespace-nowrap"
              >
                {IIcon && <IIcon className="h-4 w-4 mt-0.5 shrink-0 opacity-70" />}
                <span className="flex flex-col">
                  <span className="leading-tight">{item.label}</span>
                  {item.desc && <span className="text-[11px] text-muted-foreground/70 leading-tight mt-0.5">{item.desc}</span>}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}


export function PlatformShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { userId, fullName, isAdmin, isMentor, isTeam, isEvaluator, isAuthority, isFinance } = useRPAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const lastWidth = useRef(0);
  const [navOverflow, setNavOverflow] = useState(false);

  useEffect(() => {
    let raf = 0;
    const check = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = navRef.current;
        if (!el) return;
        // Skip when nav is display:none — its scrollWidth is 0 and would flap state back.
        if (getComputedStyle(el).display === "none") return;
        if (el.scrollWidth > el.clientWidth + 1) setNavOverflow(true);
      });
    };
    const onResize = () => {
      const w = window.innerWidth;
      // Only retest "fits" when the window grew, so we don't oscillate.
      if (w > lastWidth.current) setNavOverflow(false);
      lastWidth.current = w;
      check();
    };
    lastWidth.current = window.innerWidth;
    check();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [isAdmin, isAuthority, isEvaluator, isFinance, isMentor, isTeam]);


  return (
    <div className="rp-platform min-h-dvh">
      <a href="#rp-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow focus:outline-2 focus:outline-brand">
        Skip to main content
      </a>
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 w-full shadow-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 sm:px-6 md:px-10 h-16 gap-2 min-w-0">
          <Link to="/rakshak-platform" className="flex items-center gap-2 min-w-0 shrink">
            <span className="inline-block h-2 w-2 shrink-0 rounded-sm bg-brand" />
            <span className="font-heading text-base font-bold tracking-tight truncate">
              Crashfree India · Project Rakshak
            </span>
          </Link>
          <nav ref={navRef} className={`hidden items-center gap-0.5 text-sm min-w-0 ${navOverflow ? '' : 'xl:flex'}`}>
            <NavLink to="/rakshak-platform/map" label="Hotspots" icon={MapPin} />
            <NavLink to="/rakshak-platform/knowledge" label="Knowledge" icon={BookOpen} />
            <NavLink to="/rakshak-platform/leaderboard" label="Leaderboard" icon={Trophy} />
            <NavLink to="/rakshak-platform/impact" label="Impact" icon={Sparkles} />
            <NavLink to="/rakshak-platform/mentors" label="Mentors" icon={Users} />
            <NavLink to="/rakshak-platform/sponsor" label="Sponsor" icon={HeartHandshake} />

            {isAuthority && (
              <NavLink to="/rakshak-platform/authority" label="Authority" icon={ShieldCheck} />
            )}
            {isEvaluator && (
              <NavDropdown id="evaluator" label="Evaluator" icon={ClipboardCheck} openId={openDropdown} setOpenId={setOpenDropdown} items={[
                { to: "/rakshak-platform/evaluator", label: "Queue", icon: ClipboardCheck },
                { to: "/rakshak-platform/evaluator/compare", label: "Compare", icon: ScanSearch },
              ]} />
            )}
            {(isMentor || isTeam) && (
              <NavLink to="/rakshak-platform/meetings" label="Meetings" icon={CalendarDays} />
            )}
            {isMentor && (
              <NavDropdown id="mentor" label="Mentor" icon={GraduationCap} openId={openDropdown} setOpenId={setOpenDropdown} items={[
                { to: "/rakshak-platform/mentor", label: "Dashboard", icon: LayoutDashboard },
                { to: "/rakshak-platform/mentor/availability", label: "Availability", icon: CalendarDays },
              ]} />
            )}
            {isTeam && (
              <NavDropdown id="team" label="My Team" icon={UsersRound} openId={openDropdown} setOpenId={setOpenDropdown} items={[
                { to: "/rakshak-platform/team", label: "Overview", icon: LayoutDashboard },
                { to: "/rakshak-platform/team/phases", label: "Phases" },
                { to: "/rakshak-platform/team/locations", label: "Locations", icon: MapPin },
                { to: "/rakshak-platform/team/reports", label: "Reports", icon: FileText },
                { to: "/rakshak-platform/team/ai-check", label: "AI check", icon: ScanSearch },
              ]} />
            )}

            {isAdmin && (
              <>
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                <NavLink to="/rakshak-platform/admin" label="Admin" icon={LayoutDashboard} />
                <NavDropdown id="content" label="Content" icon={FileText} openId={openDropdown} setOpenId={setOpenDropdown} items={[
                  { to: "/rakshak-platform/admin/knowledge", label: "Articles", icon: BookOpen },
                  { to: "/rakshak-platform/admin/certificates", label: "Certificates" },
                  { to: "/rakshak-platform/admin/badges", label: "Badges" },
                  { to: "/rakshak-platform/admin/map", label: "Programme map", icon: MapPin },
                ]} />
                <NavDropdown id="people" label="People" icon={UsersRound} openId={openDropdown} setOpenId={setOpenDropdown} items={[
                  { to: "/rakshak-platform/admin/mentor-applications", label: "Mentor apps", icon: GraduationCap },
                  { to: "/rakshak-platform/admin/cohorts", label: "Cohorts", icon: Users },
                  { to: "/rakshak-platform/admin/roles", label: "Roles", icon: UserCog },
                  { to: "/rakshak-platform/admin/meetings", label: "All meetings", icon: CalendarDays },
                ]} />
                <NavDropdown id="review" label="Review" icon={ClipboardCheck} openId={openDropdown} setOpenId={setOpenDropdown} items={[
                  { to: "/rakshak-platform/admin/evaluator-queue", label: "Evaluator queue", icon: ClipboardCheck },
                  { to: "/rakshak-platform/admin/evaluator-leaderboard", label: "Eval analytics", icon: Trophy },
                  { to: "/rakshak-platform/admin/reviews", label: "Reviews", icon: FileText },
                  { to: "/rakshak-platform/admin/qa", label: "QA", icon: ScanSearch },
                  { to: "/rakshak-platform/admin/qa-checklist", label: "QA checklist", icon: ClipboardCheck },
                ]} />
                <NavDropdown id="ops" label="Operations" icon={Wrench} openId={openDropdown} setOpenId={setOpenDropdown} items={[
                  { to: "/rakshak-platform/admin/analytics", label: "Analytics", icon: Sparkles },
                  { to: "/rakshak-platform/admin/bulk-import", label: "Bulk import" },
                  { to: "/rakshak-platform/admin/exports", label: "Exports" },
                  { to: "/rakshak-platform/admin/audit", label: "Audit log" },
                  { to: "/rakshak-platform/admin/alerts", label: "Alerts" },
                  { to: "/rakshak-platform/admin/cron-health", label: "Cron health" },
                  { to: "/rakshak-platform/admin/integrations", label: "Integrations" },
                  { to: "/rakshak-platform/admin/seed", label: "Seed data" },
                ]} />
              </>
            )}
            {(isAdmin || isFinance) && (
              <NavDropdown id="finance" label="Finance" icon={Wallet} openId={openDropdown} setOpenId={setOpenDropdown} items={[
                { to: "/rakshak-platform/admin/finance", label: "Finance", icon: Wallet },
                { to: "/rakshak-platform/admin/sponsorships", label: "Sponsorships", icon: HeartHandshake },
              ]} />
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
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-brand ${navOverflow ? '' : 'xl:hidden'}`}
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className={`border-t border-border bg-background max-h-[70vh] overflow-y-auto ${navOverflow ? '' : 'xl:hidden'}`}>
            <nav className="mx-auto w-full max-w-7xl px-6 py-4 flex flex-col gap-3 text-sm">
              <Link to="/rakshak-platform/map" onClick={() => setMenuOpen(false)}>Hotspots</Link>
              <Link to="/rakshak-platform/knowledge" onClick={() => setMenuOpen(false)}>Knowledge</Link>
              <Link to="/rakshak-platform/leaderboard" onClick={() => setMenuOpen(false)}>Leaderboard</Link>
              <Link to="/rakshak-platform/impact" onClick={() => setMenuOpen(false)}>Impact</Link>
              <Link to="/rakshak-platform/mentors" onClick={() => setMenuOpen(false)}>Mentors</Link>
              <Link to="/rakshak-platform/sponsor" onClick={() => setMenuOpen(false)}>Sponsor</Link>
              {isAuthority && <Link to="/rakshak-platform/authority" onClick={() => setMenuOpen(false)}>Authority</Link>}
              {isEvaluator && <Link to="/rakshak-platform/evaluator" onClick={() => setMenuOpen(false)}>Evaluator</Link>}
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
                  <Link to="/rakshak-platform/admin/certificates" onClick={() => setMenuOpen(false)}>Certificates</Link>
                  <Link to="/rakshak-platform/admin/knowledge" onClick={() => setMenuOpen(false)}>Articles</Link>
                  <Link to="/rakshak-platform/admin/map" onClick={() => setMenuOpen(false)}>Programme map</Link>
                  <Link to="/rakshak-platform/admin/analytics" onClick={() => setMenuOpen(false)}>Analytics</Link>
                  <Link to="/rakshak-platform/admin/mentor-applications" onClick={() => setMenuOpen(false)}>Mentor applications</Link>
                  <Link to="/rakshak-platform/admin/bulk-import" onClick={() => setMenuOpen(false)}>Bulk import</Link>
                  <Link to="/rakshak-platform/admin/exports" onClick={() => setMenuOpen(false)}>Exports</Link>
                  <Link to="/rakshak-platform/admin/audit" onClick={() => setMenuOpen(false)}>Audit</Link>
                  <Link to="/rakshak-platform/admin/meetings" onClick={() => setMenuOpen(false)}>All meetings</Link>
                  <Link to="/rakshak-platform/admin/cohorts" onClick={() => setMenuOpen(false)}>Cohorts</Link>
                  <Link to="/rakshak-platform/admin/cron-health" onClick={() => setMenuOpen(false)}>Cron health</Link>
                  <Link to="/rakshak-platform/admin/roles" onClick={() => setMenuOpen(false)}>Roles</Link>
                  <Link to="/rakshak-platform/admin/evaluator-queue" onClick={() => setMenuOpen(false)}>Evaluator queue</Link>
                  <Link to="/rakshak-platform/admin/evaluator-leaderboard" onClick={() => setMenuOpen(false)}>Eval analytics</Link>
                  <Link to="/rakshak-platform/admin/alerts" onClick={() => setMenuOpen(false)}>Alerts</Link>
                  <Link to="/rakshak-platform/admin/qa" onClick={() => setMenuOpen(false)}>QA</Link>
                  <Link to="/rakshak-platform/admin/integrations" onClick={() => setMenuOpen(false)}>Integrations</Link>
                  <Link to="/rakshak-platform/admin/qa-checklist" onClick={() => setMenuOpen(false)}>QA checklist</Link>
                  <Link to="/rakshak-platform/admin/reviews" onClick={() => setMenuOpen(false)}>Reviews</Link>
                  <Link to="/rakshak-platform/admin/badges" onClick={() => setMenuOpen(false)}>Badges</Link>
                  <Link to="/rakshak-platform/admin/seed" onClick={() => setMenuOpen(false)}>Seed</Link>
                </>
              )}
            </nav>
          </div>
        )}
      </header>
      <main id="rp-main" tabIndex={-1}>{children}</main>
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
