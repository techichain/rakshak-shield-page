import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Hit = { kind: "team" | "mentor" | "location" | "submission"; id: string; title: string; subtitle?: string; href: string };

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); return; }
    setBusy(true);
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      const like = `%${term}%`;
      const [teams, mentors, locs, subs] = await Promise.all([
        supabase.from("rp_teams").select("id, team_name, college, city, state").or(`team_name.ilike.${like},college.ilike.${like},city.ilike.${like},state.ilike.${like}`).limit(6),
        supabase.from("rp_mentors").select("id, organization, rp_profiles:rp_profiles_public!profile_id(full_name, email)").limit(20),
        supabase.from("rp_locations").select("id, team_id, location_name, city").ilike("location_name", like).limit(6),
        supabase.from("rp_submissions").select("id, title, team_id, phase_number").ilike("title", like).limit(6),
      ]);
      if (ctl.signal.aborted) return;
      const out: Hit[] = [];
      for (const t of teams.data ?? []) out.push({
        kind: "team", id: t.id, title: t.team_name, subtitle: [t.college, t.city].filter(Boolean).join(" · "),
        href: `/rakshak-platform/reports/${t.id}`,
      });
      for (const m of (mentors.data ?? []) as any[]) {
        const name = m.rp_profiles?.full_name ?? m.rp_profiles?.email ?? "";
        if (name.toLowerCase().includes(term.toLowerCase()) || (m.organization ?? "").toLowerCase().includes(term.toLowerCase())) {
          out.push({ kind: "mentor", id: m.id, title: name, subtitle: m.organization ?? "Mentor", href: "/rakshak-platform/admin" });
        }
      }
      for (const l of locs.data ?? []) out.push({
        kind: "location", id: l.id, title: l.location_name, subtitle: l.city ?? "",
        href: `/rakshak-platform/team/locations/${l.id}`,
      });
      for (const s of subs.data ?? []) out.push({
        kind: "submission", id: s.id, title: s.title, subtitle: `Phase ${s.phase_number}`,
        href: `/rakshak-platform/reports/${s.team_id}`,
      });
      setHits(out);
      setBusy(false);
    }, 250);
    return () => { ctl.abort(); clearTimeout(t); };
  }, [q]);

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 h-10 px-3 rounded-full border border-border bg-background">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search teams, mentors, locations, submissions…"
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
        {q && <button onClick={() => { setQ(""); setHits([]); }}><X className="h-4 w-4 text-muted-foreground" /></button>}
      </div>
      {open && q.length >= 2 && (
        <div className="absolute top-12 left-0 right-0 z-50 bg-popover border border-border rounded-xl shadow-xl max-h-96 overflow-y-auto">
          {busy && <div className="p-4 text-xs text-muted-foreground">Searching…</div>}
          {!busy && hits.length === 0 && <div className="p-4 text-xs text-muted-foreground">No matches.</div>}
          {hits.map((h) => (
            <Link
              key={`${h.kind}-${h.id}`}
              to={h.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 hover:bg-brand-lite border-b border-border last:border-b-0"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{h.title}</div>
                  {h.subtitle && <div className="text-xs text-muted-foreground truncate">{h.subtitle}</div>}
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded-full px-2 py-0.5">{h.kind}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
