import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";

export const Route = createFileRoute("/rakshak-platform/admin/audit")({
  component: AuditLogPage,
  errorComponent: ({ error }) => {
    if (String(error).includes("Forbidden") || String(error).includes("Unauthorized")) {
      throw redirect({ to: "/rakshak-platform/auth" });
    }
    return <PlatformShell><Section><p>{String(error)}</p></Section></PlatformShell>;
  },
  notFoundComponent: () => <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>,
});

function AuditLogPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("rp_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (!active) return;
        setRows(data ?? []);
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = filter
    ? rows.filter((r) =>
        [r.action, r.entity_type, r.actor_role].some((v) => String(v ?? "").toLowerCase().includes(filter.toLowerCase())))
    : rows;

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Audit log</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Every action,<br /><span className="text-brand">tracked.</span>
        </h1>

        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by action, entity, or role…"
          className="rp-input mt-8 max-w-md"
        />

        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-brand-lite text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor role</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No audit entries.</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">{r.actor_role ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.action}</td>
                  <td className="px-4 py-3 text-xs">{r.entity_type ?? "—"}{r.entity_id ? ` · ${String(r.entity_id).slice(0, 8)}` : ""}</td>
                  <td className="px-4 py-3 text-xs max-w-md">
                    {r.new_value ? (
                      <details>
                        <summary className="cursor-pointer text-brand">View diff</summary>
                        <pre className="mt-2 overflow-x-auto rounded bg-muted/40 p-2 text-[10px]">{JSON.stringify({ old: r.old_value, new: r.new_value }, null, 2)}</pre>
                      </details>
                    ) : "—"}
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
