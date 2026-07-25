import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Copy, KeyRound, Plus, RefreshCw, X } from "lucide-react";

import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import {
  createCredential,
  getCredentialCounts,
  listCredentials,
  resetCredentialPassword,
  suggestNextLoginId,
} from "@/lib/rakshak-platform/admin-credentials.functions";

type Role = "team_leader" | "team_member" | "mentor" | "evaluator";

const ROLE_TABS: Array<{ id: Role; label: string; needsCollege: boolean }> = [
  { id: "mentor", label: "Mentors", needsCollege: false },
  { id: "evaluator", label: "Evaluators", needsCollege: false },
];

export const Route = createFileRoute("/rakshak-platform/admin/credentials")({
  component: AdminCredentialsPage,
});

function genPassword(len = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  } catch {
    toast.error("Copy failed");
  }
}

function AdminCredentialsPage() {
  const navigate = useNavigate();
  const { loading, userId, isAdmin } = useRPAuth();
  const [tab, setTab] = useState<Role>("mentor");

  useEffect(() => {
    if (loading) return;
    if (!userId) navigate({ to: "/rakshak-platform/auth" });
    else if (!isAdmin) navigate({ to: "/rakshak-platform/dashboard" });
  }, [loading, userId, isAdmin, navigate]);

  if (loading || !isAdmin) {
    return (
      <PlatformShell>
        <Section><Loader2 className="h-5 w-5 animate-spin text-brand" /></Section>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell>
      <Section className="!py-8 lg:!py-10">
        <Eyebrow>Admin · Access provisioning</Eyebrow>
        <h1 className="mt-3 font-heading text-3xl sm:text-4xl font-bold tracking-tight">
          Mentor &amp; evaluator credentials
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Create login IDs and passwords for mentors and evaluators. Passwords are shown only once
          at creation — copy and share them securely. Team leader and team member logins are created
          together with the team on the{" "}
          <Link to="/rakshak-platform/admin/teams/new" className="text-brand underline">
            Create a team
          </Link>{" "}
          page.
        </p>

        <CountsHeader />

        <div className="mt-6 inline-flex rounded-full border border-border p-1 text-sm">
          {ROLE_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-full transition ${
                tab === t.id ? "bg-brand text-brand-foreground" : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <RoleTab role={tab} />
      </Section>
    </PlatformShell>
  );
}

/* ------------------------------------------------------------------ */
/* Counts                                                              */
/* ------------------------------------------------------------------ */

function CountsHeader() {
  const getCounts = useServerFn(getCredentialCounts);
  const [state, setState] = useState<{
    counts: Record<Role, number>;
    caps: Record<Role, number>;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    getCounts()
      .then((r: any) => mounted && setState(r))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [getCounts]);

  if (!state) return <div className="mt-6 h-16 rounded-2xl border border-border bg-muted/30 animate-pulse" />;

  return (
    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
      {ROLE_TABS.map((t) => {
        const c = state.counts[t.id] ?? 0;
        const cap = state.caps[t.id];
        const pct = Math.min(100, Math.round((c / cap) * 100));
        return (
          <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {t.label}
            </div>
            <div className="mt-1 text-2xl font-bold">
              {c} <span className="text-sm text-muted-foreground font-normal">/ {cap}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab: create form + roster                                           */
/* ------------------------------------------------------------------ */

type CredItem = {
  user_id: string;
  login_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  role: Role | null;
  roles: string[];
  created_at: string | null;
  last_sign_in_at: string | null;
};

function RoleTab({ role }: { role: Role }) {
  const meta = useMemo(() => ROLE_TABS.find((t) => t.id === role)!, [role]);
  const suggest = useServerFn(suggestNextLoginId);
  const create = useServerFn(createCredential);
  const list = useServerFn(listCredentials);

  const [loginId, setLoginId] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [college, setCollege] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ login_id: string; password: string; email: string } | null>(null);

  const [items, setItems] = useState<CredItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  async function loadSuggestion() {
    try {
      const r: any = await suggest({ data: { role } });
      setLoginId(r.login_id);
    } catch {
      // ignore
    }
  }

  async function loadList() {
    setLoadingList(true);
    try {
      const r: any = await list({ data: { role } });
      setItems(r.items ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    setCreated(null);
    setLoginId("");
    setFullName("");
    setPhone("");
    setEmail("");
    setCollege("");
    setPassword("");
    loadSuggestion();
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !loginId.trim() || !password) {
      toast.error("Login ID, full name, and password are required.");
      return;
    }
    setBusy(true);
    try {
      const r: any = await create({
        data: {
          role,
          login_id: loginId.trim(),
          password,
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          college: meta.needsCollege ? (college.trim() || null) : null,
        },
      });
      setCreated({ login_id: r.login_id, password: r.password, email: r.email });
      toast.success("Credential created");
      setFullName("");
      setPhone("");
      setEmail("");
      setCollege("");
      setPassword("");
      loadSuggestion();
      loadList();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not create");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {created && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-emerald-900">Credential created — copy now</div>
              <div className="mt-2 grid gap-2 text-sm">
                <CopyRow label="Login ID" value={created.login_id} />
                <CopyRow label="Password" value={created.password} mono />
                <CopyRow label="Email" value={created.email} />
              </div>
              <div className="mt-2 text-xs text-emerald-900/70">
                This password will not be shown again. Share it with the user via a secure channel.
              </div>
            </div>
            <button
              onClick={() => setCreated(null)}
              className="text-emerald-900/60 hover:text-emerald-900"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-brand" />
          <div className="font-semibold">Create {meta.label.slice(0, -1)} credential</div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Login ID">
            <div className="flex gap-2">
              <input
                required
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="flex-1 h-11 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={loadSuggestion}
                className="h-11 px-3 rounded-xl border border-border text-xs hover:bg-muted inline-flex items-center gap-1"
                title="Suggest next"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </Field>
          <Field label="Full name">
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:border-brand"
            />
          </Field>
          <Field label="Phone (optional)">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:border-brand"
            />
          </Field>
          <Field label="Email (optional)">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="auto: <login-id>@rakshak.credentials.local"
              className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:border-brand"
            />
          </Field>
          {meta.needsCollege && (
            <Field label="College">
              <input
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:border-brand"
              />
            </Field>
          )}
          <Field label="Password">
            <div className="flex gap-2">
              <input
                required
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                className="flex-1 h-11 rounded-xl border border-border bg-background px-3 text-sm font-mono focus:outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() => setPassword(genPassword())}
                className="h-11 px-3 rounded-xl border border-border text-xs hover:bg-muted"
              >
                Generate
              </button>
            </div>
          </Field>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create credential
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="font-semibold">
            {meta.label} roster{" "}
            <span className="text-sm text-muted-foreground font-normal">({items.length})</span>
          </div>
          <button
            onClick={loadList}
            className="h-8 px-3 rounded-full border border-border text-xs hover:bg-muted inline-flex items-center gap-1"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
        {loadingList ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No credentials yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Login ID</th>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Email</th>
                  <th className="text-left px-4 py-2">Phone</th>
                  {meta.needsCollege && <th className="text-left px-4 py-2">College</th>}
                  <th className="text-left px-4 py-2">Last sign in</th>
                  <th className="text-right px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.user_id} className="border-t border-border">
                    <td className="px-4 py-2 font-mono">{it.login_id}</td>
                    <td className="px-4 py-2">{it.full_name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{it.email}</td>
                    <td className="px-4 py-2 text-muted-foreground">{it.phone ?? "—"}</td>
                    {meta.needsCollege && (
                      <td className="px-4 py-2 text-muted-foreground">{it.organization ?? "—"}</td>
                    )}
                    <td className="px-4 py-2 text-muted-foreground">
                      {it.last_sign_in_at
                        ? new Date(it.last_sign_in_at).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <ResetPasswordButton userId={it.user_id} loginId={it.login_id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ResetPasswordButton({ userId, loginId }: { userId: string; loginId: string }) {
  const reset = useServerFn(resetCredentialPassword);
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function submit() {
    if (pw.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await reset({ data: { user_id: userId, new_password: pw } });
      setDone(pw);
      toast.success("Password reset");
    } catch (e: any) {
      toast.error(e?.message ?? "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setPw(genPassword());
          setDone(null);
        }}
        className="h-8 px-3 rounded-full border border-border text-xs hover:bg-muted inline-flex items-center gap-1"
      >
        <KeyRound className="h-3.5 w-3.5" /> Reset password
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-background p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Reset password · {loginId}</div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {done ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <div className="font-semibold text-emerald-900">New password (copy now):</div>
                <div className="mt-2">
                  <CopyRow label="Password" value={done} mono />
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-3 h-9 px-4 rounded-full bg-brand text-brand-foreground text-sm"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="mt-4 flex gap-2">
                  <input
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    className="flex-1 h-11 rounded-xl border border-border bg-background px-3 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setPw(genPassword())}
                    className="h-11 px-3 rounded-xl border border-border text-xs hover:bg-muted"
                  >
                    Generate
                  </button>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    className="h-9 px-4 rounded-full border border-border text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={busy}
                    className="h-9 px-4 rounded-full bg-brand text-brand-foreground text-sm disabled:opacity-50"
                  >
                    {busy ? "Resetting…" : "Reset password"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium tracking-[0.2em] text-muted-foreground mb-2">
        {label.toUpperCase()}
      </span>
      {children}
    </label>
  );
}

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground w-20 shrink-0">
        {label}
      </span>
      <code className={`flex-1 truncate rounded-md bg-white/70 px-2 py-1 border border-border ${mono ? "font-mono" : ""}`}>
        {value}
      </code>
      <button
        onClick={() => copy(value)}
        className="h-7 w-7 grid place-items-center rounded-md border border-border hover:bg-muted"
        aria-label={`Copy ${label}`}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
