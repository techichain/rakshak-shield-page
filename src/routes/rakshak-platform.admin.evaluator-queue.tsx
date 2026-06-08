import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { Loader2, Check, X } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/admin/evaluator-queue")({
  component: EvaluatorQueuePage,
});

type Row = {
  id: string;
  user_id: string;
  requested_role: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  notes: string | null;
  profile?: { full_name: string | null; email: string | null } | null;
};

function EvaluatorQueuePage() {
  const navigate = useNavigate();
  const { loading, userId, isAdmin } = useRPAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    let q = supabase
      .from("rp_role_approvals")
      .select("id, user_id, requested_role, status, requested_at, reviewed_at, notes")
      .order("requested_at", { ascending: false })
      .limit(200);
    if (tab !== "all") q = q.eq("status", tab);
    const { data } = await q;
    const list = (data ?? []) as Row[];
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("rp_profiles")
        .select("id, full_name, email")
        .in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      list.forEach((r) => { r.profile = (map.get(r.user_id) as any) ?? null; });
    }
    setRows(list);
  }, [tab]);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    if (!isAdmin) { navigate({ to: "/rakshak-platform/dashboard" }); return; }
    load();
  }, [loading, userId, isAdmin, navigate, load]);

  async function decide(row: Row, status: "approved" | "rejected") {
    setBusy(row.id);
    setError(null);
    try {
      if (status === "approved") {
        const { error: rerr } = await supabase
          .from("rp_user_roles")
          .insert({ user_id: row.user_id, role: row.requested_role as any });
        if (rerr && !String(rerr.message).includes("duplicate")) throw rerr;
      }
      const { error: uerr } = await supabase
        .from("rp_role_approvals")
        .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: userId })
        .eq("id", row.id);
      if (uerr) throw uerr;
      await supabase.from("rp_notifications").insert({
        recipient_id: row.user_id,
        title: status === "approved" ? `Your ${row.requested_role} access was approved` : `Your ${row.requested_role} access was rejected`,
        message: status === "approved" ? "You can now access the role's features." : "Contact a super admin if you believe this is a mistake.",
        type: "role_" + status,
        related_entity_type: "rp_role_approvals",
        related_entity_id: row.id,
        action_link: "/rakshak-platform/dashboard",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <PlatformShell><Section><Loader2 className="animate-spin" /></Section></PlatformShell>;

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Evaluator & Admin queue</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Approve who gets the keys.<br />
          <span className="text-brand">Evaluator & CFI Admin requests.</span>
        </h1>

        <div className="mt-8 inline-flex rounded-full border border-border p-1 text-sm">
          {(["pending", "approved", "rejected", "all"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full capitalize ${tab === t ? "bg-foreground text-background" : "text-muted-foreground"}`}>
              {t}
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Requested</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No requests in this tab.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3">
                    <div className="font-medium">{r.profile?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.profile?.email ?? r.user_id.slice(0, 8)}</div>
                  </td>
                  <td className="p-3"><span className="rounded-full bg-brand/10 text-brand px-2 py-0.5 text-xs">{r.requested_role}</span></td>
                  <td className="p-3 text-muted-foreground">{new Date(r.requested_at).toLocaleString()}</td>
                  <td className="p-3 capitalize">{r.status}</td>
                  <td className="p-3 text-right">
                    {r.status === "pending" ? (
                      <div className="inline-flex gap-2">
                        <button disabled={busy === r.id} onClick={() => decide(r, "approved")}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50">
                          <Check className="h-3 w-3" /> Approve
                        </button>
                        <button disabled={busy === r.id} onClick={() => decide(r, "rejected")}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50">
                          <X className="h-3 w-3" /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{r.reviewed_at ? `Reviewed ${new Date(r.reviewed_at).toLocaleDateString()}` : "—"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </PlatformShell>
  );
}
