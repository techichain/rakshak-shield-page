import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/mentor-applications")({
  component: MentorAppsAdmin,
});

type App = {
  id: string; full_name: string; email: string; phone: string | null;
  city: string | null; state: string | null; organization: string | null;
  designation: string | null; expertise: string | null; years_experience: number | null;
  linkedin_url: string | null; motivation: string | null;
  status: string; review_notes: string | null; reviewed_at: string | null;
  created_mentor_id: string | null; created_at: string;
};

const TONE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  shortlisted: "bg-brand-lite text-brand border-brand/25",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

function MentorAppsAdmin() {
  const navigate = useNavigate();
  const { loading, userId, isAdmin } = useRPAuth();
  const [rows, setRows] = useState<App[]>([]);
  const [active, setActive] = useState<App | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isAdmin) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    load();
  }, [loading, userId, isAdmin, navigate]);

  async function load() {
    const { data } = await supabase
      .from("rp_mentor_applications")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as App[]) ?? []);
  }

  const filtered = rows.filter((r) => filter === "all" || r.status === filter);

  async function decide(app: App, status: "approved" | "rejected" | "shortlisted") {
    setBusy(true);
    let createdMentorId: string | null = app.created_mentor_id;

    if (status === "approved" && !createdMentorId) {
      // Try to find an existing rp_profile by email; if found, create rp_mentors row
      const { data: prof } = await supabase
        .from("rp_profiles").select("id").eq("email", app.email).maybeSingle();
      if (prof?.id) {
        const { data: m, error } = await supabase
          .from("rp_mentors")
          .insert({
            profile_id: prof.id,
            expertise: app.expertise,
            organization: app.organization,
          } as any)
          .select("id").single();
        if (!error && m) createdMentorId = m.id;
      }
    }

    await supabase
      .from("rp_mentor_applications")
      .update({
        status,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        created_mentor_id: createdMentorId,
      } as any)
      .eq("id", app.id);

    setBusy(false);
    setActive(null);
    load();
  }

  if (loading || !isAdmin) {
    return <PlatformShell><Section><Loader2 className="h-5 w-5 animate-spin text-brand" /></Section></PlatformShell>;
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Mentor pipeline</Eyebrow>
        <h1 className="font-heading text-4xl font-bold mt-4">Mentor Applications</h1>
        <p className="text-muted-foreground mt-2">{rows.length} total · {filtered.length} shown</p>

        <div className="mt-6 flex gap-2 flex-wrap">
          {(["all", "pending", "shortlisted", "approved", "rejected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-3 py-1.5 text-xs rounded-full border ${filter === f ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-border hover:border-foreground"}`}
            >
              {f === "all" ? `All (${rows.length})` : `${f} (${rows.filter((r) => r.status === f).length})`}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-brand-lite text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Applicant</th>
                <th className="text-left px-4 py-3">Expertise</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-left px-4 py-3">Yrs</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No applications.</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-brand-lite/40">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                    {r.organization && <div className="text-xs text-muted-foreground">{r.organization}{r.designation ? ` · ${r.designation}` : ""}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.expertise ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{[r.city, r.state].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-4 py-3">{r.years_experience ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${TONE[r.status] ?? ""}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setActive(r)} className="text-brand text-sm font-semibold hover:underline">Review →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {active && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setActive(null)}>
            <div className="bg-card rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-heading text-2xl font-bold">{active.full_name}</h2>
                  <p className="text-muted-foreground text-sm">{active.email}{active.phone ? ` · ${active.phone}` : ""}</p>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${TONE[active.status] ?? ""}`}>{active.status}</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Info label="Location" value={[active.city, active.state].filter(Boolean).join(", ")} />
                <Info label="Organisation" value={active.organization} />
                <Info label="Designation" value={active.designation} />
                <Info label="Years experience" value={active.years_experience?.toString()} />
                <Info label="Expertise" value={active.expertise} full />
                {active.linkedin_url && (
                  <Info label="LinkedIn" full value={<a className="text-brand underline" href={active.linkedin_url} target="_blank" rel="noreferrer">{active.linkedin_url}</a>} />
                )}
              </dl>
              {active.motivation && (
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Motivation</div>
                  <p className="mt-1 whitespace-pre-line text-sm">{active.motivation}</p>
                </div>
              )}
              <div className="mt-6 flex gap-2 flex-wrap">
                <button onClick={() => decide(active, "shortlisted")} disabled={busy}
                  className="h-10 px-4 rounded-full border border-border text-sm inline-flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Shortlist
                </button>
                <button onClick={() => decide(active, "approved")} disabled={busy}
                  className="h-10 px-4 rounded-full bg-emerald-600 text-white text-sm inline-flex items-center gap-2 disabled:opacity-50">
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </button>
                <button onClick={() => decide(active, "rejected")} disabled={busy}
                  className="h-10 px-4 rounded-full bg-red-600 text-white text-sm inline-flex items-center gap-2 disabled:opacity-50">
                  <XCircle className="h-4 w-4" /> Reject
                </button>
                <button onClick={() => setActive(null)} className="h-10 px-4 rounded-full text-sm text-muted-foreground ml-auto">Close</button>
              </div>
              {active.status === "approved" && !active.created_mentor_id && (
                <p className="mt-3 text-xs text-amber-700">
                  No platform profile found for {active.email}. Invite them to sign up, then re-approve to auto-create the mentor record.
                </p>
              )}
            </div>
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}

function Info({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value || "—"}</div>
    </div>
  );
}
