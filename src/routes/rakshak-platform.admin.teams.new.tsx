import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, RefreshCw, Copy, Users, ArrowLeft, Download } from "lucide-react";

import { rpRequireRole } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import {
  createTeamWithCredentials,
  listTeamCreationOptions,
  suggestTeamLoginIds,
} from "@/lib/rakshak-platform/admin-teams.functions";

export const Route = createFileRoute("/rakshak-platform/admin/teams/new")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["cfi_admin", "super_admin"]);
  },
  component: AdminCreateTeamPage,
});

type Person = {
  full_name: string;
  login_id: string;
  password: string;
  phone: string;
  email: string;
  department: string;
  year: string;
};

function emptyPerson(): Person {
  return { full_name: "", login_id: "", password: "", phone: "", email: "", department: "", year: "" };
}

function genPassword(len = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  } catch {
    toast.error("Copy failed");
  }
}

function AdminCreateTeamPage() {
  const navigate = useNavigate();
  const loadOptions = useServerFn(listTeamCreationOptions);
  const suggest = useServerFn(suggestTeamLoginIds);
  const submit = useServerFn(createTeamWithCredentials);

  const [opts, setOpts] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const [teamName, setTeamName] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [college, setCollege] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [mentorId, setMentorId] = useState("");

  const [leader, setLeader] = useState<Person>(emptyPerson());
  const [members, setMembers] = useState<Person[]>([emptyPerson()]);

  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    loadOptions()
      .then((r: any) => {
        setOpts(r);
        const active = (r.cohorts ?? []).find((c: any) => c.status === "active");
        if (active) setCohortId(active.id);
      })
      .catch((e: any) => toast.error(e?.message ?? "Failed to load options"));
  }, [loadOptions]);

  async function autofillIds() {
    try {
      const r: any = await suggest({ data: { leader: 1, members: members.length } });
      setLeader((p) => ({ ...p, login_id: r.leader ?? p.login_id, password: p.password || genPassword() }));
      setMembers((prev) =>
        prev.map((m, i) => ({
          ...m,
          login_id: r.members[i] ?? m.login_id,
          password: m.password || genPassword(),
        })),
      );
      toast.success("Login IDs & passwords filled");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not suggest login IDs");
    }
  }

  function updateMember(i: number, patch: Partial<Person>) {
    setMembers((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  function toPayload(p: Person) {
    return {
      full_name: p.full_name.trim(),
      login_id: p.login_id.trim(),
      password: p.password,
      phone: p.phone.trim() || null,
      email: p.email.trim() || null,
      department: p.department.trim() || null,
      year: p.year.trim() || null,
      college: college.trim() || null,
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const filled = members.filter((m) => m.full_name.trim() || m.login_id.trim());
    if (!teamName.trim()) return toast.error("Team name is required.");
    if (!leader.full_name.trim() || !leader.login_id.trim() || leader.password.length < 8) {
      return toast.error("Leader needs a name, login ID and an 8+ character password.");
    }
    for (const m of filled) {
      if (!m.full_name.trim() || !m.login_id.trim() || m.password.length < 8) {
        return toast.error("Every member row needs a name, login ID and an 8+ character password.");
      }
    }
    setBusy(true);
    try {
      const r: any = await submit({
        data: {
          team_name: teamName.trim(),
          cohort_id: cohortId || null,
          college: college.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          assigned_mentor_id: mentorId || null,
          leader: toPayload(leader),
          members: filled.map(toPayload),
        },
      });
      setResult(r);
      toast.success("Team created with credentials");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not create team");
    } finally {
      setBusy(false);
    }
  }

  function credentialsText(r: any) {
    const lines = [
      `Team: ${r.team_name}`,
      "",
      `Leader: ${r.leader.full_name}`,
      `  Login ID: ${r.leader.login_id}`,
      `  Password: ${r.leader.password}`,
      `  Email:    ${r.leader.email}`,
    ];
    for (const m of r.members ?? []) {
      lines.push("", `Member: ${m.full_name}`, `  Login ID: ${m.login_id}`, `  Password: ${m.password}`, `  Email:    ${m.email}`);
    }
    return lines.join("\n");
  }

  function downloadCsv(r: any) {
    const rows = [
      ["team", "role", "full_name", "login_id", "password", "email"],
      [r.team_name, "team_leader", r.leader.full_name, r.leader.login_id, r.leader.password, r.leader.email],
      ...(r.members ?? []).map((m: any) => [r.team_name, "team_member", m.full_name, m.login_id, m.password, m.email]),
    ];
    const csv = rows.map((row) => row.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${r.team_name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-credentials.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const leftLeader = opts ? opts.caps.team_leader - opts.counts.team_leader : null;
  const leftMember = opts ? opts.caps.team_member - opts.counts.team_member : null;

  return (
    <PlatformShell>
      <Section className="!py-8 lg:!py-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Eyebrow>Admin · Teams</Eyebrow>
            <h1 className="mt-3 font-heading text-3xl sm:text-4xl font-bold tracking-tight">Create a team</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              One step: the team, its leader, and its members — each with a login ID and password you
              hand out directly. Nobody registers themselves and nothing needs approving.
            </p>
          </div>
          <Link to="/rakshak-platform/admin/teams" className="text-sm text-brand hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> All teams
          </Link>
        </div>

        {opts && (
          <div className="mt-4 text-xs text-muted-foreground">
            Capacity left · team leaders <strong className="text-foreground">{leftLeader}</strong> ·
            team members <strong className="text-foreground">{leftMember}</strong>
          </div>
        )}

        {result && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="font-semibold text-emerald-900">
                  “{result.team_name}” created — copy these credentials now
                </div>
                <div className="text-xs text-emerald-900/70 mt-1">
                  Passwords are never shown again. Share them over a secure channel.
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copyText(credentialsText(result))}
                  className="h-9 px-3 rounded-full border border-emerald-300 bg-white text-xs font-semibold inline-flex items-center gap-1"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy all
                </button>
                <button
                  onClick={() => downloadCsv(result)}
                  className="h-9 px-3 rounded-full border border-emerald-300 bg-white text-xs font-semibold inline-flex items-center gap-1"
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
                <Link
                  to="/rakshak-platform/admin/teams/$teamId"
                  params={{ teamId: result.team_id }}
                  className="h-9 px-3 rounded-full bg-emerald-700 text-white text-xs font-semibold inline-flex items-center"
                >
                  Open team
                </Link>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-emerald-900/60">
                  <tr>
                    <th className="text-left py-1">Role</th>
                    <th className="text-left py-1">Name</th>
                    <th className="text-left py-1">Login ID</th>
                    <th className="text-left py-1">Password</th>
                    <th className="text-left py-1">Email</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-emerald-200">
                    <td className="py-1.5">Leader</td>
                    <td className="py-1.5">{result.leader.full_name}</td>
                    <td className="py-1.5 font-mono">{result.leader.login_id}</td>
                    <td className="py-1.5 font-mono">{result.leader.password}</td>
                    <td className="py-1.5 text-emerald-900/70">{result.leader.email}</td>
                  </tr>
                  {(result.members ?? []).map((m: any) => (
                    <tr key={m.login_id} className="border-t border-emerald-200">
                      <td className="py-1.5">Member</td>
                      <td className="py-1.5">{m.full_name}</td>
                      <td className="py-1.5 font-mono">{m.login_id}</td>
                      <td className="py-1.5 font-mono">{m.password}</td>
                      <td className="py-1.5 text-emerald-900/70">{m.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <button
                onClick={() => {
                  setResult(null);
                  setTeamName(""); setCollege(""); setCity(""); setState(""); setMentorId("");
                  setLeader(emptyPerson()); setMembers([emptyPerson()]);
                }}
                className="text-xs font-semibold text-emerald-900 underline"
              >
                Create another team
              </button>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-6">
          {/* Team */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-brand" />
              <div className="font-semibold">Team details</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Team name *">
                <Input value={teamName} onChange={setTeamName} required />
              </Field>
              <Field label="Cohort">
                <select
                  value={cohortId}
                  onChange={(e) => setCohortId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm"
                >
                  <option value="">First active cohort</option>
                  {(opts?.cohorts ?? []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                  ))}
                </select>
              </Field>
              <Field label="College">
                <Input value={college} onChange={setCollege} />
              </Field>
              <Field label="Assigned mentor (optional)">
                <select
                  value={mentorId}
                  onChange={(e) => setMentorId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm"
                >
                  <option value="">Unassigned</option>
                  {(opts?.mentors ?? []).map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}{m.organization ? ` · ${m.organization}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="City"><Input value={city} onChange={setCity} /></Field>
              <Field label="State"><Input value={state} onChange={setState} /></Field>
            </div>
          </div>

          {/* Leader */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="font-semibold">Team leader</div>
              <button
                type="button"
                onClick={autofillIds}
                className="h-9 px-3 rounded-full border border-border text-xs hover:bg-muted inline-flex items-center gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Auto-fill all login IDs & passwords
              </button>
            </div>
            <PersonFields person={leader} onChange={(patch) => setLeader((p) => ({ ...p, ...patch }))} />
          </div>

          {/* Members */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="font-semibold">
                Team members <span className="text-sm text-muted-foreground font-normal">({members.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setMembers((p) => [...p, emptyPerson()])}
                className="h-9 px-3 rounded-full border border-border text-xs hover:bg-muted inline-flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add member
              </button>
            </div>
            <div className="space-y-5">
              {members.map((m, i) => (
                <div key={i} className="rounded-xl border border-border/70 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Member {i + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => setMembers((p) => p.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-red-600"
                      aria-label="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <PersonFields person={m} onChange={(patch) => updateMember(i, patch)} />
                </div>
              ))}
              {members.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No members yet — you can add them now or later from the team page.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate({ to: "/rakshak-platform/admin/teams" })}
              className="h-11 px-5 rounded-full border border-border text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-11 px-6 rounded-full bg-brand text-brand-foreground text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create team & credentials
            </button>
          </div>
        </form>
      </Section>
    </PlatformShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Input({
  value, onChange, required, type = "text", mono, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      required={required}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full h-11 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:border-brand ${mono ? "font-mono" : ""}`}
    />
  );
}

function PersonFields({
  person, onChange,
}: { person: Person; onChange: (patch: Partial<Person>) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Full name *">
        <Input value={person.full_name} onChange={(v) => onChange({ full_name: v })} />
      </Field>
      <Field label="Login ID *">
        <Input value={person.login_id} onChange={(v) => onChange({ login_id: v })} mono />
      </Field>
      <Field label="Password *">
        <div className="flex gap-2">
          <Input value={person.password} onChange={(v) => onChange({ password: v })} mono />
          <button
            type="button"
            onClick={() => onChange({ password: genPassword() })}
            className="h-11 px-3 rounded-xl border border-border text-xs hover:bg-muted shrink-0"
          >
            Generate
          </button>
        </div>
      </Field>
      <Field label="Phone (optional)">
        <Input value={person.phone} onChange={(v) => onChange({ phone: v })} />
      </Field>
      <Field label="Real email (optional)">
        <Input
          value={person.email}
          onChange={(v) => onChange({ email: v })}
          type="email"
          placeholder="auto: <login-id>@rakshak.credentials.local"
        />
      </Field>
      <Field label="Department / Year (optional)">
        <div className="flex gap-2">
          <Input value={person.department} onChange={(v) => onChange({ department: v })} placeholder="Dept" />
          <Input value={person.year} onChange={(v) => onChange({ year: v })} placeholder="Year" />
        </div>
      </Field>
    </div>
  );
}
