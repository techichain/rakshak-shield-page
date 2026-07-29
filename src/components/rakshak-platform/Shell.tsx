import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown, LogOut, Menu, X,
  MapPin, BookOpen, Trophy, Sparkles, Users,
  ShieldCheck, ClipboardCheck, CalendarDays, GraduationCap, UsersRound,
  LayoutDashboard, FileText, UserCog, Wrench, Wallet, BellRing,
  Mail, FolderOpen, Images,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { useRPAuth, rpSignOut } from "@/lib/rakshak-platform/auth";
import { NotificationBell } from "@/components/rakshak-platform/NotificationBell";

import { GlobalSearch } from "@/components/rakshak-platform/GlobalSearch";
import cfiLogoPrimary from "@/assets/brand/cfi-logo-primary.svg";
import cfiLogoWhite from "@/assets/brand/cfi-logo-white.svg";


type NavItem = { to: string; label: string; icon?: LucideIcon; desc?: string };

/** Every destination reachable from the shell nav — used to pick the single
 *  best (longest) match for the current route so only one entry highlights. */
const NAV_PATHS = [
  "/rakshak-platform/map",
  "/rakshak-platform/knowledge",
  "/rakshak-platform/leaderboard",
  "/rakshak-platform/impact",
  "/rakshak-platform/mentors",
  "/rakshak-platform/mails",
  "/rakshak-platform/authority",
  "/rakshak-platform/evaluator",
  "/rakshak-platform/mentor",
  "/rakshak-platform/mentor/resources",
  "/rakshak-platform/team",
  "/rakshak-platform/team/phases",
  "/rakshak-platform/team/locations",
  "/rakshak-platform/team/evidence",
  "/rakshak-platform/team/media",
  "/rakshak-platform/team/updates",
  "/rakshak-platform/team/book-admin",
  "/rakshak-platform/admin",
  "/rakshak-platform/admin/certificates",
  "/rakshak-platform/admin/teams",
  "/rakshak-platform/admin/teams/new",
  "/rakshak-platform/admin/credentials",
  "/rakshak-platform/admin/meetings",
  "/rakshak-platform/admin/rubrics",
  "/rakshak-platform/admin/sessions",
  "/rakshak-platform/admin/evaluator-leaderboard",
  "/rakshak-platform/admin/ranks",
  "/rakshak-platform/admin/reviews",
  "/rakshak-platform/admin/analytics",
  "/rakshak-platform/admin/data",
  "/rakshak-platform/admin/integrations",
];

function bestNavMatch(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  let best: string | null = null;
  for (const p of NAV_PATHS) {
    if (clean === p || clean.startsWith(p + "/")) {
      if (!best || p.length > best.length) best = p;
    }
  }
  return best;
}

function useIsActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const best = bestNavMatch(pathname);
  return (to: string) => best === to.replace(/\/+$/, "");
}

function NavLink({ to, label, icon: Icon }: { to: string; label: React.ReactNode; icon?: LucideIcon }) {
  const isActive = useIsActive();
  const active = isActive(to);
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all ${
        active
          ? "text-brand bg-white shadow-sm font-semibold ring-1 ring-brand/20"
          : "text-slate-700 hover:text-brand hover:bg-white hover:shadow-sm"
      }`}
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
  const isActive = useIsActive();
  const navMatch = items.find((i) => isActive(i.to))?.to ?? null;


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
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all ${
          open ? "text-brand bg-white shadow-sm font-semibold ring-1 ring-brand/20" : "text-slate-700 hover:text-brand hover:bg-white hover:shadow-sm"
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
            const itemActive = navMatch === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpenId(null)}
                className={`flex items-start gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-brand-lite hover:text-brand whitespace-nowrap ${
                  itemActive ? "bg-brand-lite text-brand" : "text-foreground"
                }`}
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

function MobileGroup({
  label,
  items,
  onPick,
}: {
  label: string;
  items: NavItem[];
  onPick: () => void;
}) {
  const isActive = useIsActive();
  return (
    <div>
      <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="grid gap-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onPick}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted/60 ${
                active ? "bg-brand-lite text-brand font-semibold" : "text-foreground"
              }`}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0 opacity-70" />}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}



export function PlatformShell({
  children,
  hideMenu = false,
}: {
  children: React.ReactNode;
  /** Hides the hamburger/side menu entirely. Defaults to existing behaviour. */
  hideMenu?: boolean;
}) {
  const navigate = useNavigate();
  const { userId, isAdmin, isMentor, isTeam, isEvaluator, isAuthority, isFinance } = useRPAuth();
  const evaluatorOnly = isEvaluator && !isAdmin && !isMentor && !isTeam && !isAuthority && !isFinance;
  const mentorOnly = isMentor && !isAdmin && !isTeam && !isAuthority && !isFinance;
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
      <header className="border-b border-border/80 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 backdrop-blur supports-[backdrop-filter]:bg-white/85 sticky top-0 z-40 w-full shadow-[0_2px_8px_-2px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/60">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 sm:px-6 md:px-8 h-16 gap-4 min-w-0">
          <div className="flex items-center gap-4 min-w-0 shrink">
            {!hideMenu && (
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Toggle navigation"
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-brand ${navOverflow ? '' : 'xl:hidden'}`}
              >
                {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            )}
            <a
              href="https://crashfreeindia.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 min-w-0 shrink py-2"
              title="Crashfree India — main website"
            >
              <img
                src={cfiLogoPrimary}
                alt="Crashfree India"
                className="h-7 w-auto min-w-[180px] object-contain dark:hidden"
              />
              <img
                src={cfiLogoWhite}
                alt="Crashfree India"
                className="h-7 w-auto min-w-[180px] object-contain hidden dark:block"
              />
              <span className="sr-only">Crashfree India · Project Rakshak</span>
            </a>
          </div>

          <nav ref={navRef} className={`hidden items-center gap-0.5 text-sm min-w-0 rounded-full bg-slate-100/70 border border-slate-200/80 px-1.5 py-1 shadow-inner ${navOverflow ? '' : 'xl:flex'}`}>
            {!evaluatorOnly && (
              <>
                {!mentorOnly && (
                  <NavLink
                    to="/rakshak-platform/map"
                    icon={MapPin}
                    label={
                      <>
                        <span className="lg:hidden">Unsafe locations</span>
                        <span className="hidden lg:inline">Unsafe Road Locations</span>
                      </>
                    }
                  />
                )}

                {!mentorOnly && <NavLink to="/rakshak-platform/knowledge" label="Knowledge" icon={BookOpen} />}
                <NavLink to="/rakshak-platform/leaderboard" label="Leaderboard" icon={Trophy} />
                <NavLink to="/rakshak-platform/impact" label="Impact" icon={Sparkles} />
                {(isAdmin || isEvaluator) && <NavLink to="/rakshak-platform/mentors" label="Mentors" icon={Users} />}
              </>
            )}

            {(isTeam || isMentor || isAdmin || isEvaluator) && (
              <NavLink to="/rakshak-platform/mails" label="Mails" icon={Mail} />
            )}

            {isAuthority && (
              <NavLink to="/rakshak-platform/authority" label="Authority" icon={ShieldCheck} />
            )}
            {isEvaluator && (
              <NavDropdown id="evaluator" label="Evaluator" icon={ClipboardCheck} openId={openDropdown} setOpenId={setOpenDropdown} items={[
                { to: "/rakshak-platform/evaluator", label: "Queue", icon: ClipboardCheck },
              ]} />
            )}
            {isMentor && (
              <NavDropdown id="mentor" label="Mentor" icon={GraduationCap} openId={openDropdown} setOpenId={setOpenDropdown} items={[
                { to: "/rakshak-platform/mentor", label: "Dashboard", icon: LayoutDashboard },
                { to: "/rakshak-platform/mentor/resources", label: "Resources", icon: BookOpen, desc: "Share files & links with your teams" },
              ]} />
            )}
            {isTeam && (
              <NavDropdown id="team" label="My Team" icon={UsersRound} openId={openDropdown} setOpenId={setOpenDropdown} items={[
                { to: "/rakshak-platform/team", label: "Overview", icon: LayoutDashboard },
                { to: "/rakshak-platform/team/phases", label: "Phases" },
                { to: "/rakshak-platform/team/locations", label: "Locations", icon: MapPin },
                { to: "/rakshak-platform/team/evidence", label: "Evidence & records", icon: FolderOpen },
                { to: "/rakshak-platform/team/media", label: "Site media", icon: Images },
                { to: "/rakshak-platform/team/updates", label: "Share with us", icon: CalendarDays },
                { to: "/rakshak-platform/team/book-admin", label: "Book programme team", icon: CalendarDays },

              ]} />
            )}

            {isAdmin && (
              <>
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                <NavLink to="/rakshak-platform/admin" label="Admin" icon={LayoutDashboard} />
                <NavDropdown id="content" label="Content" icon={FileText} openId={openDropdown} setOpenId={setOpenDropdown} items={[
                  { to: "/rakshak-platform/admin/certificates", label: "Certificates" },
                ]} />
                <NavDropdown id="people" label="People" icon={UsersRound} openId={openDropdown} setOpenId={setOpenDropdown} items={[
                  { to: "/rakshak-platform/admin/teams/new", label: "Create a team", icon: UserCog, desc: "Team + leader + members, with login credentials" },
                  { to: "/rakshak-platform/admin/teams", label: "Teams", icon: UsersRound, desc: "Per-team hub: submissions, feedback, resources, meetings" },
                  { to: "/rakshak-platform/admin/credentials", label: "Mentor & evaluator logins", icon: BellRing, desc: "Provision login IDs & passwords" },
                  { to: "/rakshak-platform/admin/profiles", label: "Profiles", icon: UserCog, desc: "Contact, bank & completion details for everyone" },

                  { to: "/rakshak-platform/admin/meetings", label: "All meetings", icon: CalendarDays },
                  { to: "/rakshak-platform/admin/sessions", label: "My slots & announcements", icon: CalendarDays, desc: "Let teams book you, or announce to all teams" },
                ]} />
                <NavDropdown id="review" label="Review" icon={ClipboardCheck} openId={openDropdown} setOpenId={setOpenDropdown} items={[
                  { to: "/rakshak-platform/admin/rubrics", label: "Scoring rubrics", icon: ClipboardCheck, desc: "Per-phase evaluation criteria" },
                  { to: "/rakshak-platform/admin/evaluator-leaderboard", label: "Evaluator activity", icon: Trophy },
                  { to: "/rakshak-platform/admin/ranks", label: "Phase ranks", icon: Trophy, desc: "Publish global per-phase team ranks" },
                  { to: "/rakshak-platform/admin/reviews", label: "Reviews", icon: FileText },
                ]} />
                <NavDropdown id="ops" label="Operations" icon={Wrench} openId={openDropdown} setOpenId={setOpenDropdown} items={[
                  { to: "/rakshak-platform/admin/analytics", label: "Analytics", icon: Sparkles },
                  { to: "/rakshak-platform/admin/data", label: "Import & export" },
                  { to: "/rakshak-platform/admin/integrations", label: "Integrations" },
                  
                ]} />
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
                  className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-brand max-w-[12rem] truncate"
                >
                  <UserCog className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">My profile</span>
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
          </div>
        </div>
        {menuOpen && !hideMenu && (
          <div className={`border-t border-border bg-background max-h-[75vh] overflow-y-auto ${navOverflow ? '' : 'xl:hidden'}`}>
            <nav className="mx-auto w-full max-w-7xl px-5 py-5 flex flex-col gap-5 text-sm">
              {!evaluatorOnly && (
                <MobileGroup
                  label="Explore"
                  items={[
                    ...(!mentorOnly ? [{ to: "/rakshak-platform/map", label: "Unsafe Road Locations", icon: MapPin }] : []),
                    ...(!mentorOnly ? [{ to: "/rakshak-platform/knowledge", label: "Knowledge", icon: BookOpen }] : []),
                    { to: "/rakshak-platform/leaderboard", label: "Leaderboard", icon: Trophy },
                    { to: "/rakshak-platform/impact", label: "Impact", icon: Sparkles },
                    ...(isAdmin || isEvaluator ? [{ to: "/rakshak-platform/mentors", label: "Mentors", icon: Users }] : []),
                  ]}
                  onPick={() => setMenuOpen(false)}
                />
              )}

              {isAuthority && (
                <MobileGroup label="Authority" items={[
                  { to: "/rakshak-platform/authority", label: "Authority dashboard", icon: ShieldCheck },
                ]} onPick={() => setMenuOpen(false)} />
              )}

              {isEvaluator && (
                <MobileGroup label="Evaluator" items={[
                  { to: "/rakshak-platform/evaluator", label: "Queue", icon: ClipboardCheck },
                ]} onPick={() => setMenuOpen(false)} />
              )}

              {isMentor && (
                <MobileGroup label="Mentor" items={[
                  { to: "/rakshak-platform/mentor", label: "Dashboard", icon: LayoutDashboard },
                  { to: "/rakshak-platform/mentor/resources", label: "Resources", icon: BookOpen },
                ]} onPick={() => setMenuOpen(false)} />
              )}

              {isTeam && (
                <MobileGroup label="My Team" items={[
                  { to: "/rakshak-platform/team", label: "Overview", icon: LayoutDashboard },
                  { to: "/rakshak-platform/team/phases", label: "Phases", icon: ClipboardCheck },
                  { to: "/rakshak-platform/team/locations", label: "Locations", icon: MapPin },
                  { to: "/rakshak-platform/team/evidence", label: "Evidence & records", icon: FolderOpen },
                  { to: "/rakshak-platform/team/media", label: "Site media", icon: Images },
                  { to: "/rakshak-platform/team/updates", label: "Share with us", icon: CalendarDays },
                  { to: "/rakshak-platform/team/book-admin", label: "Book programme team", icon: CalendarDays },

                ]} onPick={() => setMenuOpen(false)} />
              )}

              {isAdmin && (
                <>
                  <MobileGroup label="Admin" items={[
                    { to: "/rakshak-platform/admin", label: "Overview", icon: LayoutDashboard },
                  ]} onPick={() => setMenuOpen(false)} />
                  <MobileGroup label="People" items={[
                    { to: "/rakshak-platform/admin/teams/new", label: "Create a team", icon: UserCog },
                    { to: "/rakshak-platform/admin/teams", label: "Teams", icon: UsersRound },
                    { to: "/rakshak-platform/admin/profiles", label: "Profiles", icon: UserCog },
                    { to: "/rakshak-platform/admin/credentials", label: "Mentor & evaluator logins", icon: BellRing },
                    { to: "/rakshak-platform/admin/meetings", label: "All meetings", icon: CalendarDays },
                    { to: "/rakshak-platform/admin/rubrics", label: "Scoring rubrics", icon: ClipboardCheck },
                    { to: "/rakshak-platform/admin/sessions", label: "My slots & announcements", icon: CalendarDays },
                  ]} onPick={() => setMenuOpen(false)} />
                  <MobileGroup label="Content" items={[
                    { to: "/rakshak-platform/admin/certificates", label: "Certificates", icon: FileText },
                  ]} onPick={() => setMenuOpen(false)} />
                  <MobileGroup label="Review" items={[
                    { to: "/rakshak-platform/admin/evaluator-leaderboard", label: "Evaluator activity", icon: Trophy },
                    { to: "/rakshak-platform/admin/ranks", label: "Phase ranks", icon: Trophy },
                    { to: "/rakshak-platform/admin/reviews", label: "Reviews", icon: FileText },
                  ]} onPick={() => setMenuOpen(false)} />
                  <MobileGroup label="Operations" items={[
                    { to: "/rakshak-platform/admin/analytics", label: "Analytics", icon: Sparkles },
                    { to: "/rakshak-platform/admin/data", label: "Import & export", icon: FileText },
                    { to: "/rakshak-platform/admin/integrations", label: "Integrations", icon: Wrench },
                    
                  ]} onPick={() => setMenuOpen(false)} />
                </>
              )}
            </nav>
          </div>
        )}
      </header>
      <main id="rp-main" tabIndex={-1}>{children}</main>
      <footer className="border-t border-border bg-brand text-brand-foreground">
        <div className="mx-auto w-full max-w-7xl px-6 md:px-8 py-16 grid gap-8 md:grid-cols-3">
          <div>
            <a
              href="https://crashfreeindia.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block font-heading text-lg font-bold hover:underline"
              title="Crashfree India — main website"
            >
              Crashfree India
            </a>
            <p className="mt-4 text-sm text-brand-foreground/70">
              Project Rakshak is a youth-led road safety audit programme run across Indian cities.
            </p>
          </div>
          <div className="text-sm text-brand-foreground/70">
            <div className="font-semibold text-brand-foreground mb-2">Platform</div>
            <ul className="space-y-2">
              <li><Link to="/rakshak-platform/auth">Sign in</Link></li>
              <li><Link to="/rakshak-platform/map">Hotspot map</Link></li>
              <li><Link to="/rakshak-platform/knowledge">Knowledge hub</Link></li>
              <li><Link to="/rakshak-platform/leaderboard">Leaderboard</Link></li>
              <li><Link to="/rakshak-platform/impact">Impact</Link></li>
              
              <li><Link to="/rakshak-platform/mentor-apply">Become a mentor</Link></li>
              <li><Link to="/rakshak-platform">How it works</Link></li>
            </ul>
          </div>
          <div className="text-sm text-brand-foreground/70">
            <div className="font-semibold text-brand-foreground mb-2">Contact</div>
            <p>project.rakshak@crashfreeindia.org</p>
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
      <div className={`mx-auto w-full max-w-7xl px-6 md:px-8 py-16 lg:py-24 ${className}`}>
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
