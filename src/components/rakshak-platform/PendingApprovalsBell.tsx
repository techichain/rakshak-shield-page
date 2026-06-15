import { useEffect, useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { UserCheck, Inbox, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type PendingRow = {
  id: string;
  user_id: string;
  requested_role: string;
  created_at: string;
  email: string | null;
  full_name: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  team_leader: "Team Leader",
  team: "Team Leader",
  mentor: "Mentor",
  evaluator: "Evaluator",
  cfi_admin: "CFI Admin",
  super_admin: "Super Admin",
};

function ageLabel(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(ms / 3600_000);
  if (hrs < 1) {
    const mins = Math.max(1, Math.floor(ms / 60_000));
    return `${mins}m ago`;
  }
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h ago`;
}

export function PendingApprovalsBell() {
  const [items, setItems] = useState<PendingRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const { data: approvals } = await supabase
      .from("rp_role_approvals")
      .select("id, user_id, requested_role, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);
    const rows = (approvals as Array<Omit<PendingRow, "email" | "full_name">>) ?? [];
    if (rows.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profiles } = await supabase
      .from("rp_profiles")
      .select("id, email, full_name")
      .in("id", ids);
    const byId = new Map(
      (profiles ?? []).map((p: any) => [p.id, { email: p.email, full_name: p.full_name }]),
    );
    setItems(
      rows.map((r) => ({
        ...r,
        email: byId.get(r.user_id)?.email ?? null,
        full_name: byId.get(r.user_id)?.full_name ?? null,
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    void load();
    const channel = supabase
      .channel("rp_role_approvals_admin_bell")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rp_role_approvals" },
        () => { if (active) void load(); },
      )
      .subscribe();
    const interval = window.setInterval(() => { if (active) void load(); }, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const overdue = items.filter((r) => Date.now() - new Date(r.created_at).getTime() > 24 * 3600_000).length;
  const count = items.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative h-9 w-9 rounded-full border flex items-center justify-center hover:border-brand/40 ${
          overdue > 0 ? "border-red-400 text-red-600" : "border-border"
        }`}
        aria-label={`Pending approvals${count ? ` (${count})` : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        title={
          count
            ? `${count} pending approval${count === 1 ? "" : "s"}${overdue ? ` — ${overdue} overdue` : ""}`
            : "Pending approvals"
        }
      >
        <UserCheck className="h-4 w-4" />
        {count > 0 && (
          <span
            className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 ${
              overdue > 0 ? "bg-red-600 text-white" : "bg-brand text-brand-foreground"
            }`}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-96 max-h-[28rem] overflow-y-auto rounded-2xl border border-border bg-background shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-heading text-sm font-semibold">Pending approvals</span>
            <span className="text-xs text-muted-foreground">
              {count} total{overdue ? ` · ${overdue} overdue` : ""}
            </span>
          </div>
          {loading ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 flex flex-col items-center text-center text-muted-foreground">
              <Inbox className="h-6 w-6 mb-1.5" aria-hidden />
              <p className="text-sm font-medium text-foreground">No pending requests</p>
              <p className="text-xs mt-0.5">New access requests will appear here.</p>
            </div>
          ) : (
            <ul>
              {items.map((r) => {
                const ageMs = Date.now() - new Date(r.created_at).getTime();
                const isOverdue = ageMs > 24 * 3600_000;
                return (
                  <li
                    key={r.id}
                    className={`border-b border-border last:border-b-0 ${
                      isOverdue ? "bg-red-50 dark:bg-red-950/30" : ""
                    }`}
                  >
                    <Link
                      to="/rakshak-platform/admin/access-requests"
                      onClick={() => setOpen(false)}
                      className="block px-4 py-3 hover:bg-brand-lite/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {r.full_name || r.email || "Unknown user"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {r.email ?? "—"}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isOverdue
                              ? "bg-red-600 text-white"
                              : "bg-brand/10 text-brand"
                          }`}
                        >
                          {ROLE_LABEL[r.requested_role] ?? r.requested_role}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className={isOverdue ? "text-red-700 font-medium inline-flex items-center gap-1" : "text-muted-foreground"}>
                          {isOverdue && <AlertTriangle className="h-3 w-3" />}
                          {ageLabel(r.created_at)}
                          {isOverdue && " · 24h+ overdue"}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            to="/rakshak-platform/admin/access-requests"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-center text-xs text-brand hover:underline border-t border-border"
          >
            Open Pending Approvals panel
          </Link>
        </div>
      )}
    </div>
  );
}
