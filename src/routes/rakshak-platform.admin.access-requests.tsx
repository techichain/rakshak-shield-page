import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import {
  Loader2, Mail, Check, X, BellRing, UserPlus, Clock, Shield, ArrowLeft,
  GraduationCap, Briefcase, MapPin,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/rakshak-platform/admin/access-requests")({
  component: AccessRequestsPage,
});

type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
  note: string | null;
  created_at: string;
  invited_by: string | null;
};

type Pending = {
  id: string;
  user_id: string;
  requested_role: string;
  requested_at: string;
  notes: string | null;
  full_name: string | null;
  email: string | null;
};

type MentorApp = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  organization: string | null;
  designation: string | null;
  expertise: string | null;
  years_experience: number | null;
  linkedin_url: string | null;
  motivation: string | null;
  status: string;
  created_at: string;
};

function AccessRequestsPage() {
  const navigate = useNavigate();
  const { loading, userId, isAdmin } = useRPAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [mentorApps, setMentorApps] = useState<MentorApp[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"requests" | "mentor-apps" | "invites">("requests");

  const load = useCallback(async () => {
    const [{ data: inv }, { data: pend }, { data: apps }] = await Promise.all([
      supabase.from("rp_role_invites")
        .select("id, email, role, status, note, created_at, invited_by")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("rp_role_approvals")
        .select("id, user_id, requested_role, requested_at, notes")
        .eq("status", "pending")
        .order("requested_at", { ascending: false }),
      supabase.from("rp_mentor_applications")
        .select("id, full_name, email, phone, city, state, organization, designation, expertise, years_experience, linkedin_url, motivation, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    setInvites((inv ?? []) as any);
    setMentorApps((apps ?? []) as any);

    const ids = Array.from(new Set((pend ?? []).map((p: any) => p.user_id)));
    let profileMap = new Map<string, any>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("rp_profiles")
        .select("id, full_name, email")
        .in("id", ids);
      profileMap = new Map((profs ?? []).map((p) => [p.id, p]));
    }
    setPending((pend ?? []).map((p: any) => {
      const prof = profileMap.get(p.user_id);
      return {
        id: p.id,
        user_id: p.user_id,
        requested_role: p.requested_role,
        requested_at: p.requested_at,
        notes: p.notes,
        full_name: prof?.full_name ?? null,
        email: prof?.email ?? null,
      };
    }));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isAdmin) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    load();
  }, [loading, userId, isAdmin, navigate, load]);

  async function approvePending(row: Pending) {
    setBusy("ap" + row.id);
    const { error: insErr } = await supabase
      .from("rp_user_roles")
      .insert({ user_id: row.user_id, role: row.requested_role as any });
    if (insErr && !String(insErr.message).includes("duplicate")) {
      toast.error(insErr.message); setBusy(null); return;
    }
    await supabase.from("rp_role_approvals")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: userId })
      .eq("id", row.id);
    toast.success(`Granted ${row.requested_role}`);
    await load();
    setBusy(null);
  }

  async function rejectPending(row: Pending) {
    if (!confirm(`Reject ${row.requested_role} request from ${row.email ?? row.user_id}?`)) return;
    setBusy("rj" + row.id);
    await supabase.from("rp_role_approvals")
      .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: userId })
      .eq("id", row.id);
    toast.success("Rejected");
    await load();
    setBusy(null);
  }

  async function revokeInvite(inv: Invite) {
    if (!confirm(`Revoke invite to ${inv.email}?`)) return;
    setBusy("rv" + inv.id);
    await supabase.from("rp_role_invites")
      .update({ status: "revoked", reviewed_at: new Date().toISOString(), reviewed_by: userId })
      .eq("id", inv.id);
    toast.success("Invite revoked");
    await load();
    setBusy(null);
  }

  async function resendInvite(inv: Invite) {
    // Simply touch updated_at so admin sees latest; real email sending uses existing email flow if configured.
    setBusy("rs" + inv.id);
    await supabase.from("rp_role_invites")
      .update({ status: "pending", reviewed_at: null })
      .eq("id", inv.id);
    toast.success(`Invite refreshed for ${inv.email}`);
    await load();
    setBusy(null);
  }

  if (loading || !isAdmin) {
    return <PlatformShell><Section><Loader2 className="h-5 w-5 animate-spin text-brand" /></Section></PlatformShell>;
  }

  const pendingInvites = invites.filter((i) => i.status === "pending");
  const otherInvites = invites.filter((i) => i.status !== "pending");

  return (
    <PlatformShell>
      <Section className="!py-8 lg:!py-10">
        <Link to="/rakshak-platform/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to admin
        </Link>
        <Eyebrow>Access requests</Eyebrow>
        <h1 className="mt-3 font-heading text-3xl sm:text-4xl font-bold tracking-tight">
          Approve mentor & evaluator access
        </h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Review notifications from people requesting roles, and manage the email invites you've sent out.
        </p>

        {/* Notification-style summary */}
        <div className="mt-6 grid sm:grid-cols-3 gap-4">
          <SummaryCard icon={<BellRing className="h-5 w-5" />} label="Pending requests" value={pending.length} tone="amber" />
          <SummaryCard icon={<Mail className="h-5 w-5" />} label="Open invites" value={pendingInvites.length} tone="brand" />
          <SummaryCard icon={<Shield className="h-5 w-5" />} label="Total invites" value={invites.length} tone="muted" />
        </div>

        {/* Tabs */}
        <div className="mt-8 flex items-center gap-1 border-b border-border">
          {([
            ["requests", `Notifications (${pending.length})`, <BellRing className="h-4 w-4" key="i1" />],
            ["invites", `Email invites (${invites.length})`, <Mail className="h-4 w-4" key="i2" />],
          ] as const).map(([id, label, icon]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  active ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {icon}{label}
              </button>
            );
          })}
        </div>

        {/* Notifications */}
        {tab === "requests" && (
          <div className="mt-6 space-y-3">
            {pending.length === 0 ? (
              <EmptyNote icon={<BellRing className="h-8 w-8 text-brand" />} title="All caught up" subtitle="No pending role requests right now." />
            ) : (
              pending.map((p) => (
                <div key={p.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 grid place-items-center shrink-0">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-semibold">{p.full_name ?? p.email ?? "User"}</span>{" "}
                      <span className="text-muted-foreground">requested</span>{" "}
                      <span className="inline-flex items-center rounded-full bg-brand/10 text-brand px-2 py-0.5 text-xs font-medium">
                        {p.requested_role}
                      </span>{" "}
                      <span className="text-muted-foreground">access</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">{p.email}</div>
                    {p.notes && <div className="text-xs text-muted-foreground mt-1 italic">"{p.notes}"</div>}
                    <div className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {new Date(p.requested_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => approvePending(p)}
                      disabled={busy === "ap" + p.id}
                      className="inline-flex items-center gap-1 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {busy === "ap" + p.id ? "Approving…" : "Approve"}
                    </button>
                    <button
                      onClick={() => rejectPending(p)}
                      disabled={busy === "rj" + p.id}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Invites */}
        {tab === "invites" && (
          <div className="mt-6 space-y-6">
            <InviteSection
              title="Pending invites"
              rows={pendingInvites}
              empty="No open invites. Use the + button on the admin dashboard to add Gmail IDs."
              busy={busy}
              onRevoke={revokeInvite}
              onResend={null}
            />
            <InviteSection
              title="History"
              rows={otherInvites}
              empty="No past invites yet."
              busy={busy}
              onRevoke={null}
              onResend={resendInvite}
            />
          </div>
        )}
      </Section>
    </PlatformShell>
  );
}

function SummaryCard({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: number; tone: "amber" | "brand" | "muted" }) {
  const tones = {
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    brand: "bg-brand/10 text-brand border-brand/20",
    muted: "bg-muted text-muted-foreground border-border",
  } as const;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl grid place-items-center border ${tones[tone]}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  );
}

function EmptyNote({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-brand/10 grid place-items-center">{icon}</div>
      <div className="mt-3 font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground">{subtitle}</div>
    </div>
  );
}

function InviteSection({
  title, rows, empty, busy, onRevoke, onResend,
}: {
  title: string;
  rows: Invite[];
  empty: string;
  busy: string | null;
  onRevoke: ((i: Invite) => void) | null;
  onResend: ((i: Invite) => void) | null;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h3>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
          {empty}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Sent</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-t border-border align-top">
                  <td className="p-3">
                    <div className="font-medium">{i.email}</div>
                    {i.note && <div className="text-xs text-muted-foreground italic mt-1">{i.note}</div>}
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center rounded-full bg-brand/10 text-brand px-2 py-0.5 text-xs">{i.role}</span>
                  </td>
                  <td className="p-3">
                    <StatusBadge status={i.status} />
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString()}</td>
                  <td className="p-3 text-right">
                    {onRevoke && i.status === "pending" && (
                      <button
                        onClick={() => onRevoke(i)}
                        disabled={busy === "rv" + i.id}
                        className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    )}
                    {onResend && i.status === "revoked" && (
                      <button
                        onClick={() => onResend(i)}
                        disabled={busy === "rs" + i.id}
                        className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
                      >
                        Re-open
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "accepted" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
    "bg-muted text-muted-foreground border-border";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${tone}`}>{status}</span>;
}
