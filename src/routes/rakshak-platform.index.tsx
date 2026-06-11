import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, MapPin, Users, FileText, Building2, BarChart3, LayoutDashboard } from "lucide-react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/rakshak-platform/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Project Rakshak Automation Platform — Crashfree India" },
      { name: "description", content: "A digital operating system for student-led road safety audits, mentor guidance, and authority-ready infrastructure solutions." },
      { property: "og:title", content: "Project Rakshak Automation Platform" },
      { property: "og:description", content: "Run student cohorts, audit unsafe roads, pitch to authorities — all in one workflow." },
    ],
  }),
});

function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return (
    <PlatformShell>
      {/* HERO */}
      <section className="relative border-t border-border bg-background overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_18%,rgba(74,53,255,0.18),transparent_60%)]" />
        <div className="mx-auto w-full max-w-7xl px-6 md:px-10 pt-24 lg:pt-32 pb-16">
          <Eyebrow><ShieldCheck className="h-3.5 w-3.5" /> Civic-tech for road safety</Eyebrow>
          <h1 className="mt-6 max-w-4xl font-heading text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.02] tracking-tight">
            The proof is already
            <br />
            <span className="text-brand">on the ground.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-muted-foreground">
            Project Rakshak Automation Platform is the operating system Crashfree India uses to run student cohorts —
            from problem identification to authority pitch — at scale.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {signedIn ? (
              <Link
                to="/rakshak-platform/dashboard"
                className="h-12 rounded-full bg-brand px-7 text-base text-brand-foreground shadow-lg shadow-brand/30 hover:bg-brand/90 inline-flex items-center gap-2"
              >
                <LayoutDashboard className="h-4 w-4" /> Go to dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/rakshak-platform/auth"
                  className="h-12 rounded-full bg-brand px-7 text-base text-brand-foreground shadow-lg shadow-brand/30 hover:bg-brand/90 inline-flex items-center gap-2"
                >
                  Sign in <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/rakshak-platform/auth"
                  search={{ mode: "register" } as never}
                  className="h-12 rounded-full border border-border px-7 text-base inline-flex items-center"
                >
                  Register a team
                </Link>
              </>
            )}
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { v: "20+", l: "Active teams" },
              { v: "8", l: "Indian cities" },
              { v: "50+", l: "Locations audited" },
              { v: "5", l: "Phases per cohort" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-border bg-card p-6">
                <div className="font-heading text-4xl font-bold text-brand">{s.v}</div>
                <div className="mt-2 text-sm text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <Section tone="brand-lite">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-6 max-w-4xl font-heading text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight">
          From an unsafe junction
          <br />
          <span className="text-brand">to an approved fix.</span>
        </h2>
        <p className="mt-6 max-w-3xl text-base sm:text-lg leading-relaxed text-muted-foreground">
          Every cohort follows the same five-phase workflow. Teams collect evidence, mentors review,
          admins approve, and authorities receive a pitch-ready dossier.
        </p>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[
            { i: MapPin, t: "Phase 0 — Identify", d: "Teams shortlist 3 unsafe locations and finalise 1 with initial evidence." },
            { i: FileText, t: "Phase 1 — Research", d: "Compile news, accident history, RTI references and authority mapping." },
            { i: Users, t: "Phase 2 — Survey & Audit", d: "Run community surveys and a formal road safety audit on site." },
            { i: BarChart3, t: "Phase 3 — Draft Solution", d: "Analyse comparable case studies and draft a feasible solution." },
            { i: Building2, t: "Phase 4 — Authority Pitch", d: "Submit final report and pitch the relevant authority." },
            { i: ShieldCheck, t: "Impact tracking", d: "Track approvals, implementation status and citizen benefit." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border border-border bg-card p-7 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5 transition">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-heading text-xl font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* WHO IT'S FOR */}
      <Section>
        <Eyebrow>Built for everyone in the loop</Eyebrow>
        <h2 className="mt-6 max-w-4xl font-heading text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight">
          One platform.
          <br />
          <span className="text-brand">Four kinds of users.</span>
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "Student teams", d: "Phase-wise checklist, evidence upload, mentor feedback, recognition." },
            { t: "Mentors", d: "Assigned-team queue, structured rubric scoring, meeting scheduling." },
            { t: "CFI admins", d: "Command centre across cohorts — assign mentors, approve phases, monitor risk." },
            { t: "Authorities", d: "Jurisdiction-scoped map of approved reports with implementation tracking." },
          ].map((r) => (
            <div key={r.t} className="rounded-2xl border border-border bg-card p-6">
              <h3 className="font-heading text-lg font-semibold">{r.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{r.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section tone="brand">
        <h2 className="max-w-4xl font-heading text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight">
          Every unsafe road has a story.
          <br />
          <span className="text-brand-lite">Let's document it together.</span>
        </h2>
        <div className="mt-8 flex flex-wrap gap-3">
          {signedIn ? (
            <Link to="/rakshak-platform/dashboard" className="h-12 rounded-full bg-brand-foreground text-brand px-7 text-base inline-flex items-center gap-2 hover:bg-brand-foreground/90">
              <LayoutDashboard className="h-4 w-4" /> Go to dashboard
            </Link>
          ) : (
            <>
              <Link to="/rakshak-platform/auth" className="h-12 rounded-full bg-brand-foreground text-brand px-7 text-base inline-flex items-center gap-2 hover:bg-brand-foreground/90">
                Sign in <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/rakshak-platform/auth" search={{ mode: "register" } as never} className="h-12 rounded-full border border-brand-foreground/30 px-7 text-base inline-flex items-center">
                Register
              </Link>
            </>
          )}
        </div>
      </Section>
    </PlatformShell>
  );
}
