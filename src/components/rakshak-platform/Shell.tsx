import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown, LogOut, Menu, X,
  MapPin, BookOpen, Trophy, Sparkles, Users,
  ShieldCheck, ClipboardCheck, CalendarDays, GraduationCap, UsersRound,
  LayoutDashboard, FileText, UserCog, Wrench, Wallet, BellRing,
  Mail,
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
      activeProps={{ className: "!text-brand !bg-white shadow-sm font-semibold ring-1 ring-brand/20" }}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-slate-700 hover:text-brand hover:bg-white hover:shadow-sm transition-all"
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
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpenId(null)}
                activeProps={{ className: "bg-brand-lite text-brand" }}
                className="flex items-start gap-2.5 rounded-md px-3 py-2 text-sm text-foreground hover:bg-brand-lite hover:text-brand whitespace-nowrap"
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
  return (
    <div>
      <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="grid gap-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onPick}
              activeOptions={{ exact: false }}
              activeProps={{ className: "!bg-brand-lite !text-brand font-semibold" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted/60"
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


export function PlatformShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { userId, fullName, isAdmin, isMentor, isTeam, isEvaluator, isAuthority, isFinance } = useRPAuth();
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

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // tick every second so time is always accurate on first render
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);
  const tz = "Asia/Kolkata";
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: tz });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: tz });

  return (
    <div className="rp-platform min-h-dvh">
      <a href="#rp-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow focus:outline-2 focus:outline-brand">
        Skip to main content
      </a>
      <header className="border-b border-border/80 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 backdrop-blur supports-[backdrop-filter]:bg-white/85 sticky top-0 z-40 w-full shadow-[0_2px_8px_-2px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/60">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 sm:px-6 md:px-10 h-16 gap-2 min-w-0">
          <Link to="/rakshak-platform" className="flex items-center gap-2 min-w-0 shrink">
            <span className="inline-block h-2 w-2 shrink-0 rounded-sm bg-brand" />
            <span className="font-heading text-base font-bold tracking-tight truncate">
              Crashfree India · Project Rakshak
            </span>
          </Link>
          <nav ref={navRef} className={`hidden items-center gap-0.5 text-sm min-w-0 rounded-full bg-slate-100/70 border border-slate-200/80 px-1.5 py-1 shadow-inner ${navOverflow ? '' : 'xl:flex'}`}>
            {!evaluatorOnly && (
              <>
                {!mentorOnly && <NavLink to="/rakshak-platform/map" label="Hotspots" icon={MapPin} />}
                {!mentorOnly && <NavLink to="/rakshak-platform/knowledge" label="Knowledge" icon={BookOpen} />}
                <NavLink to="/rakshak-platform/leaderboard" label="Leaderboard" icon={Trophy} />
                <NavLink to="/rakshak-platform/impact" label="Impact" icon={Sparkles} />
                {!mentorOnly && !isTeam && <NavLink to="/rakshak-platform/mentors" label="Mentors" icon={Users} />}
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
                  { to: "/rakshak-platform/admin/meetings", label: "All meetings", icon: CalendarDays },
                ]} />
                <NavDropdown id="review" label="Review" icon={ClipboardCheck} openId={openDropdown} setOpenId={setOpenDropdown} items={[
                  { to: "/rakshak-platform/admin/evaluator-leaderboard", label: "Eval analytics", icon: Trophy },
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
            <div className="hidden sm:flex items-center gap-2 shrink-0" title={`Timezone: India Standard Time (${tz})`}>
              <div className="hidden md:block h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
              <div className="flex items-center gap-1.5 leading-none rounded-lg bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 shadow-sm">
                <div className="flex flex-col items-end">
                  <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-100 tabular-nums">{timeStr}</span>
                  <span className="hidden md:block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{dateStr}</span>
                </div>
                <span className="text-[9px] font-semibold tracking-wide text-brand bg-brand/10 rounded px-1 py-0.5">IST</span>
              </div>
            </div>
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
          <div className={`border-t border-border bg-background max-h-[75vh] overflow-y-auto ${navOverflow ? '' : 'xl:hidden'}`}>
            <nav className="mx-auto w-full max-w-7xl px-5 py-5 flex flex-col gap-5 text-sm">
              {!evaluatorOnly && (
                <MobileGroup
                  label="Explore"
                  items={[
                    ...(!mentorOnly ? [{ to: "/rakshak-platform/map", label: "Hotspots", icon: MapPin }] : []),
                    ...(!mentorOnly ? [{ to: "/rakshak-platform/knowledge", label: "Knowledge", icon: BookOpen }] : []),
                    { to: "/rakshak-platform/leaderboard", label: "Leaderboard", icon: Trophy },
                    { to: "/rakshak-platform/impact", label: "Impact", icon: Sparkles },
                    ...(!mentorOnly && !isTeam ? [{ to: "/rakshak-platform/mentors", label: "Mentors", icon: Users }] : []),
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
                    { to: "/rakshak-platform/admin/credentials", label: "Mentor & evaluator logins", icon: BellRing },
                    { to: "/rakshak-platform/admin/meetings", label: "All meetings", icon: CalendarDays },
                  ]} onPick={() => setMenuOpen(false)} />
                  <MobileGroup label="Content" items={[
                    { to: "/rakshak-platform/admin/certificates", label: "Certificates", icon: FileText },
                  ]} onPick={() => setMenuOpen(false)} />
                  <MobileGroup label="Review" items={[
                    { to: "/rakshak-platform/admin/evaluator-leaderboard", label: "Eval analytics", icon: Trophy },
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
