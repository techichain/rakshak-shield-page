import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { getAuthorityInbox, recordAuthorityResponse } from "@/lib/rakshak-platform/authority.functions";
import { LocationMap, type MapMarker } from "@/components/rakshak-platform/LocationMap";
import { Inbox, MapPin } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/authority")({
  component: AuthorityDashboard,
});

function AuthorityDashboard() {
  const { loading, userId, roles, isAdmin } = useRPAuth();
  const isAuthority = roles.includes("authority") || isAdmin;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchInbox = useServerFn(getAuthorityInbox);
  const respond = useServerFn(recordAuthorityResponse);

  useEffect(() => {
    if (loading) return;
    if (!userId) navigate({ to: "/rakshak-platform/auth" });
    else if (!isAuthority) navigate({ to: "/rakshak-platform/dashboard" });
  }, [loading, userId, isAuthority, navigate]);

  const { data } = useQuery({
    queryKey: ["rp-authority-inbox"],
    queryFn: () => fetchInbox(),
    enabled: !!userId && isAuthority,
  });

  const reports = data?.reports ?? [];
  const hotspots = data?.hotspots ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => reports.find((r: any) => r.id === selectedId) ?? null, [reports, selectedId]);
  const [responseText, setResponseText] = useState("");
  const [responseStatus, setResponseStatus] = useState<"acknowledged" | "actioned" | "rejected" | "closed">("acknowledged");
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "acknowledged" | "actioned" | "rejected">("all");
  const filteredReports = useMemo(() => {
    if (statusFilter === "all") return reports;
    if (statusFilter === "pending") return reports.filter((r: any) => !r.response_status);
    return reports.filter((r: any) => r.response_status === statusFilter);
  }, [reports, statusFilter]);

  async function submitResponse() {
    if (!selected) return;
    setBusy(true);
    try {
      await respond({
        data: { id: selected.id, response_status: responseStatus, response_text: responseText },
      });
      setResponseText("");
      qc.invalidateQueries({ queryKey: ["rp-authority-inbox"] });
      setSelectedId(null);
    } finally { setBusy(false); }
  }

  const markers: MapMarker[] = hotspots
    .filter((h: any) => h.latitude && h.longitude)
    .map((h: any) => ({
      id: h.id,
      lat: Number(h.latitude),
      lng: Number(h.longitude),
      title: h.location_name,
      subtitle: `${h.issue_type ?? ""} · ${h.city ?? ""}`,
      severity: h.severity,
      isFinal: h.is_final_selected,
    }));

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Authority workspace</Eyebrow>
        <h1 className="mt-6 font-heading text-4xl font-bold leading-tight">
          Hotspots and reports<br/><span className="text-brand">awaiting action.</span>
        </h1>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="text-xs uppercase tracking-wider text-brand flex items-center gap-2"><Inbox className="h-4 w-4" /> Reports</div>
            <div className="mt-4 text-3xl font-bold">{reports.length}</div>
            <div className="text-sm text-muted-foreground">In your inbox</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="text-xs uppercase tracking-wider text-brand flex items-center gap-2"><MapPin className="h-4 w-4" /> Hotspots</div>
            <div className="mt-4 text-3xl font-bold">{hotspots.length}</div>
            <div className="text-sm text-muted-foreground">Programme-wide</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="text-xs uppercase tracking-wider text-brand">Actioned</div>
            <div className="mt-4 text-3xl font-bold">{reports.filter((r: any) => r.response_status === "actioned").length}</div>
            <div className="text-sm text-muted-foreground">Closed loop</div>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card p-3">
          <LocationMap markers={markers} height="420px" />
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.2fr,1fr]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-2xl font-semibold">Report inbox</h2>
              <div className="inline-flex rounded-full border border-border p-1 text-xs">
                {(["all", "pending", "acknowledged", "actioned", "rejected"] as const).map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1 rounded-full capitalize ${statusFilter === s ? "bg-foreground text-background" : "text-muted-foreground"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border divide-y bg-card">
              {filteredReports.length === 0 && <div className="p-6 text-sm text-muted-foreground">No reports in this view.</div>}
              {filteredReports.map((r: any) => {
                const sentAt = r.sent_at ? new Date(r.sent_at) : null;
                const ageDays = sentAt ? Math.floor((Date.now() - sentAt.getTime()) / 86400000) : null;
                const isOpen = !r.response_status || r.response_status === "acknowledged";
                const slaTone = ageDays == null ? "" : isOpen && ageDays >= 14 ? "bg-red-500/10 text-red-600 border-red-500/30" : isOpen && ageDays >= 7 ? "bg-amber-500/10 text-amber-600 border-amber-500/30" : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
                return (
                  <button
                    key={r.id}
                    onClick={() => { setSelectedId(r.id); setResponseText(r.response_text ?? ""); setResponseStatus(r.response_status ?? "acknowledged"); }}
                    className={`w-full text-left p-4 hover:bg-brand-lite/50 ${selectedId === r.id ? "bg-brand-lite/60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{r.subject}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {r.rp_teams?.team_name} · {r.authority_name} ({r.authority_category})
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs px-2 py-1 rounded-full border border-border">{r.response_status ?? r.status}</span>
                        {ageDays != null && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${slaTone}`}>
                            {isOpen ? `${ageDays}d open` : `responded`}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="font-heading text-2xl font-semibold mb-4">Respond</h2>
            {selected ? (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <div>
                  <div className="text-sm font-semibold">{selected.subject}</div>
                  <div className="text-xs text-muted-foreground">{selected.rp_teams?.team_name}</div>
                </div>
                <p className="text-sm whitespace-pre-wrap text-foreground/80">{selected.message}</p>
                {selected.rp_locations && (
                  <div className="text-xs text-muted-foreground">
                    Location: {selected.rp_locations.location_name} · severity {selected.rp_locations.severity}
                  </div>
                )}
                <hr className="border-border" />
                <select className="rp-input w-full" value={responseStatus} onChange={(e) => setResponseStatus(e.target.value as any)}>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="actioned">Actioned</option>
                  <option value="rejected">Rejected</option>
                  <option value="closed">Closed</option>
                </select>
                <textarea
                  className="rp-input w-full min-h-32"
                  placeholder="Response notes (visible to team and Crashfree India)"
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                />
                <button onClick={submitResponse} disabled={busy} className="h-11 rounded-full bg-brand px-6 text-sm text-brand-foreground disabled:opacity-60">
                  {busy ? "Saving…" : "Record response"}
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-sm text-muted-foreground">
                Select a report on the left to record an official response.
              </div>
            )}
          </div>
        </div>
      </Section>
    </PlatformShell>
  );
}
