import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { useRPAuth, rpRequireRole } from "@/lib/rakshak-platform/auth";
import { listTeamReports, upsertAuthorityReport } from "@/lib/rakshak-platform/authority.functions";
import { FileText, Send, Plus, Printer } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/team/reports/")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["team_leader", "team_member"]);
  },
  component: TeamReports,
});

const CATEGORIES = [
  { v: "nhai", l: "NHAI" },
  { v: "state_pwd", l: "State PWD" },
  { v: "municipal", l: "Municipal Corp" },
  { v: "dev_auth", l: "Dev. Authority" },
  { v: "police", l: "Traffic Police" },
  { v: "other", l: "Other" },
];

function TeamReports() {
  const { loading, userId, isTeam } = useRPAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchReports = useServerFn(listTeamReports);
  const save = useServerFn(upsertAuthorityReport);

  const [team, setTeam] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    location_id: "" as string,
    authority_name: "",
    authority_category: "municipal" as any,
    contact_person: "",
    contact_email: "",
    contact_phone: "",
    subject: "",
    message: "",
    status: "draft" as "draft" | "sent",
  });

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isTeam) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    (async () => {
      const { data: mem } = await supabase.from("rp_team_members").select("team_id").eq("profile_id", userId).maybeSingle();
      const { data: ld } = await supabase.from("rp_teams").select("id, team_name, city, state").eq("team_leader_id", userId).maybeSingle();
      const teamId = mem?.team_id ?? ld?.id;
      if (!teamId) return;
      const { data: t } = await supabase.from("rp_teams").select("id, team_name, city, state").eq("id", teamId).maybeSingle();
      setTeam(t);
      const { data: locs } = await supabase.from("rp_locations").select("id, location_name, city, severity").eq("team_id", teamId).order("created_at", { ascending: false });
      setLocations(locs ?? []);
    })();
  }, [loading, userId, isTeam, navigate]);

  const { data } = useQuery({
    queryKey: ["rp-team-reports", team?.id],
    queryFn: () => fetchReports({ data: { teamId: team!.id } }),
    enabled: !!team?.id,
  });
  const reports = data?.reports ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!team) return;
    setBusy(true);
    try {
      await save({
        data: {
          team_id: team.id,
          location_id: form.location_id || null,
          authority_name: form.authority_name,
          authority_category: form.authority_category,
          contact_person: form.contact_person || null,
          contact_email: form.contact_email || null,
          contact_phone: form.contact_phone || null,
          subject: form.subject,
          message: form.message,
          status: form.status,
        },
      });
      setShowForm(false);
      setForm({ ...form, authority_name: "", subject: "", message: "" });
      qc.invalidateQueries({ queryKey: ["rp-team-reports", team.id] });
    } finally { setBusy(false); }
  }

  const stats = useMemo(() => ({
    sent: reports.filter((r: any) => r.status !== "draft").length,
    responded: reports.filter((r: any) => r.response_status).length,
    draft: reports.filter((r: any) => r.status === "draft").length,
  }), [reports]);

  return (
    <PlatformShell>
      <Section>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>Authority reports</Eyebrow>
            <h1 className="mt-6 font-heading text-3xl sm:text-4xl font-bold leading-tight">
              Letters and responses<br/><span className="text-brand">to public authorities.</span>
            </h1>
            {team && <p className="mt-3 text-sm text-muted-foreground">{team.team_name} · {team.city}</p>}
          </div>
          {team && (
            <div className="flex flex-wrap gap-2">
              <Link
                to="/rakshak-platform/reports/$teamId"
                params={{ teamId: team.id }}
                className="h-11 inline-flex items-center gap-2 rounded-full border border-border px-5 text-sm hover:border-brand/40"
              >
                <Printer className="h-4 w-4" /> Printable report
              </Link>
              <button onClick={() => setShowForm(!showForm)} className="h-11 inline-flex items-center gap-2 rounded-full bg-brand px-5 text-sm text-brand-foreground">
                <Plus className="h-4 w-4" /> New letter
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Drafts", stats.draft],
            ["Sent", stats.sent],
            ["Responded", stats.responded],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-2xl border border-border bg-card p-5">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{l}</div>
              <div className="text-3xl font-bold mt-2">{v}</div>
            </div>
          ))}
        </div>

        {showForm && (
          <form onSubmit={submit} className="mt-10 rounded-2xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-heading text-xl font-semibold">New authority letter</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="rp-input" placeholder="Authority name" value={form.authority_name} onChange={(e) => setForm({ ...form, authority_name: e.target.value })} required />
              <select className="rp-input" value={form.authority_category} onChange={(e) => setForm({ ...form, authority_category: e.target.value as any })}>
                {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
              <input className="rp-input" placeholder="Contact person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
              <input className="rp-input" placeholder="Email" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
              <input className="rp-input" placeholder="Phone" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
              <select className="rp-input" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })}>
                <option value="">— Linked location (optional) —</option>
                {locations.map((l: any) => <option key={l.id} value={l.id}>{l.location_name} ({l.severity})</option>)}
              </select>
            </div>
            <input className="rp-input w-full" placeholder="Subject line" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
            <textarea className="rp-input w-full min-h-40" placeholder="Body of the letter" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            <div className="flex flex-wrap items-center gap-3">
              <button disabled={busy} type="submit" onClick={() => setForm((f) => ({ ...f, status: "draft" }))} className="h-11 rounded-full border border-border px-5 text-sm">
                Save draft
              </button>
              <button disabled={busy} type="submit" onClick={() => setForm((f) => ({ ...f, status: "sent" }))} className="h-11 inline-flex items-center gap-2 rounded-full bg-brand px-5 text-sm text-brand-foreground">
                <Send className="h-4 w-4" /> Mark as sent
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-muted-foreground">Cancel</button>
            </div>
          </form>
        )}

        <div className="mt-10 space-y-3">
          {reports.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              <FileText className="mx-auto h-8 w-8 mb-3 text-brand" />
              No authority letters yet. Start one to track responses.
            </div>
          )}
          {reports.map((r: any) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{r.subject}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    To: {r.authority_name} · {r.authority_category}
                    {r.sent_at && ` · sent ${new Date(r.sent_at).toLocaleDateString()}`}
                  </div>
                </div>
                <span className="text-xs px-3 py-1 rounded-full border border-border">{r.response_status ?? r.status}</span>
              </div>
              {r.message && <p className="mt-3 text-sm text-foreground/80 whitespace-pre-wrap line-clamp-4">{r.message}</p>}
              {r.response_text && (
                <div className="mt-4 rounded-xl bg-brand-lite p-4 text-sm">
                  <div className="text-xs text-brand uppercase tracking-wider mb-1">Authority response · {r.response_status}</div>
                  <p className="whitespace-pre-wrap">{r.response_text}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </PlatformShell>
  );
}
