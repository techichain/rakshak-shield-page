import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { Loader2, Calendar, CheckCircle2, Upload, FileText } from "lucide-react";
import {
  getMyProfile,
  updateMyProfile,
  getProfileUploadUrl,
  getProfileFileUrl,
  BLOOD_GROUPS,
} from "@/lib/rakshak-platform/profile.functions";
import {
  getCalendarStatus,
  getCalendarAuthUrl,
  disconnectCalendar,
} from "@/lib/rakshak-platform/google-calendar.functions";

export const Route = createFileRoute("/rakshak-platform/profile")({
  ssr: false,
  component: ProfilePage,
});

const FIELD_LABELS: Record<string, string> = {
  full_name: "Full name",
  email: "Email",
  phone: "Phone",
  blood_group: "Blood group",
  address: "Address",
  college: "College",
  organization: "Organization",
  bank_account_number: "Bank account number",
  bank_ifsc: "IFSC code",
};

type FormState = {
  full_name: string;
  phone: string;
  blood_group: string;
  address: string;
  college: string;
  organization: string;
  city: string;
  state: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_branch: string;
};

const EMPTY: FormState = {
  full_name: "", phone: "", blood_group: "", address: "", college: "",
  organization: "", city: "", state: "", bank_account_name: "",
  bank_account_number: "", bank_ifsc: "", bank_branch: "",
};

function initials(name: string, email: string) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function maskAccount(v: string) {
  const s = v.trim();
  if (s.length <= 4) return s;
  return "•".repeat(Math.max(0, s.length - 4)) + s.slice(-4);
}

function ProfilePage() {
  const navigate = useNavigate();
  const { loading, userId, email } = useRPAuth();

  const load = useServerFn(getMyProfile);
  const save = useServerFn(updateMyProfile);
  const uploadUrl = useServerFn(getProfileUploadUrl);
  const fileUrl = useServerFn(getProfileFileUrl);

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [roles, setRoles] = useState<string[]>([]);
  const [pct, setPct] = useState(0);
  const [missing, setMissing] = useState<string[]>([]);
  const [chequePath, setChequePath] = useState<string | null>(null);
  const [maskAcct, setMaskAcct] = useState(true);
  const [newPwd, setNewPwd] = useState("");

  // Google Calendar (kept from the previous profile page)
  const [cal, setCal] = useState<{ connected: boolean; email: string | null } | null>(null);
  const [calBusy, setCalBusy] = useState(false);
  const fetchCalStatus = useServerFn(getCalendarStatus);
  const fetchCalAuthUrl = useServerFn(getCalendarAuthUrl);
  const fetchCalDisconnect = useServerFn(disconnectCalendar);

  const applyResult = useCallback((r: any) => {
    const p = r.profile ?? {};
    setForm({
      full_name: p.full_name ?? "",
      phone: p.phone ?? "",
      blood_group: p.blood_group ?? "",
      address: p.address ?? "",
      college: p.college ?? "",
      organization: p.organization ?? "",
      city: p.city ?? "",
      state: p.state ?? "",
      bank_account_name: p.bank_account_name ?? "",
      bank_account_number: p.bank_account_number ?? "",
      bank_ifsc: p.bank_ifsc ?? "",
      bank_branch: p.bank_branch ?? "",
    });
    setChequePath(p.cancelled_cheque_path ?? null);
    setRoles(r.roles ?? []);
    setPct(r.percentage ?? 0);
    setMissing(r.missing_fields ?? []);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    load()
      .then((r) => { applyResult(r); setReady(true); })
      .catch((e: any) => { setErr(e?.message ?? "Could not load your profile."); setReady(true); });
    fetchCalStatus()
      .then((s) => setCal({ connected: s.connected, email: s.email }))
      .catch(() => setCal({ connected: false, email: null }));
  }, [loading, userId, navigate, load, applyResult, fetchCalStatus]);

  const isTeamRole = useMemo(
    () => roles.some((r) => r === "team_leader" || r === "team_member"),
    [roles],
  );
  const isMentorRole = useMemo(
    () => roles.some((r) => r === "mentor" || r === "evaluator"),
    [roles],
  );

  function set<K extends keyof FormState>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await save({ data: { ...form, blood_group: (form.blood_group || null) as any } });
      applyResult(r);
      toast.success(`Profile updated — ${r.percentage}% complete`);
    } catch (e: any) {
      setErr(e?.message ?? "Could not save your profile.");
      toast.error("Could not save your profile");
    } finally {
      setBusy(false);
    }
  }

  async function onChequeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) { toast.error("File must be under 30MB"); return; }
    setBusy(true); setErr(null);
    try {
      const { path, token } = await uploadUrl({
        data: { file_name: file.name, mime_type: file.type || undefined },
      });
      const { error } = await supabase.storage
        .from("rp-submissions")
        .uploadToSignedUrl(path, token, file);
      if (error) throw error;
      const r = await save({ data: { cancelled_cheque_path: path } });
      applyResult(r);
      toast.success("Cancelled cheque uploaded");
    } catch (e2: any) {
      setErr(e2?.message ?? "Upload failed.");
      toast.error("Upload failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function viewCheque() {
    if (!chequePath) return;
    try {
      const { url } = await fileUrl({ data: { path: chequePath } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open the file");
    }
  }

  async function connectCalendar() {
    setCalBusy(true); setErr(null);
    try {
      const { url } = await fetchCalAuthUrl({ data: { origin: window.location.origin } });
      window.location.href = url;
    } catch (e: any) {
      setErr(e?.message ?? "Failed to start Google Calendar connection.");
      setCalBusy(false);
    }
  }
  async function disconnectCal() {
    setCalBusy(true); setErr(null);
    try {
      await fetchCalDisconnect();
      setCal({ connected: false, email: null });
      toast.success("Google Calendar disconnected.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to disconnect.");
    } finally {
      setCalBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 6) { setErr("Password must be at least 6 characters."); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) setErr(error.message);
    else { toast.success("Password updated."); setNewPwd(""); }
    setBusy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/rakshak-platform/auth" });
  }

  if (loading || !ready) {
    return <PlatformShell><Section><Loader2 className="animate-spin" /></Section></PlatformShell>;
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>My profile</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          {form.full_name || <span className="text-brand">Complete your profile</span>}
        </h1>

        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand text-3xl font-semibold text-brand-foreground">
            {initials(form.full_name, email ?? "")}
          </div>
          <div className="text-sm text-muted-foreground">{email}</div>
          {roles.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {roles.map((r) => (
                <span key={r} className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
                  {ROLE_LABELS[r] ?? r}
                </span>
              ))}
            </div>
          )}
          {isTeamRole && (teamName || form.college) && (
            <div className="text-sm text-muted-foreground">
              {[teamName, form.college].filter(Boolean).join(" · ")}
            </div>
          )}

        </div>

        {/* Completion */}
        <div className="mt-8 max-w-3xl rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Profile completion</span>
            <span className="font-semibold text-brand">{pct}%</span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
          </div>
          {missing.length > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Still needed: {missing.map((m) => FIELD_LABELS[m] ?? m).join(", ")}
            </p>
          ) : (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> All required details are filled in.
            </p>
          )}
        </div>

        {err && (
          <p className="mt-4 max-w-3xl rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">{err}</p>
        )}

        <form onSubmit={onSave} className="mt-10 max-w-3xl space-y-10">
          {/* Personal */}
          <div>
            <h2 className="font-heading text-2xl tracking-tight">Personal details</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Full name">
                <Input value={form.full_name} onChange={(v) => set("full_name", v)} required />
              </Field>
              <Field label="Email">
                <input
                  type="email" value={email ?? ""} readOnly disabled
                  className="h-11 w-full rounded-xl border border-border bg-muted px-4 text-sm text-muted-foreground"
                />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={(v) => set("phone", v)} />
              </Field>
              <Field label="Blood group">
                <select
                  value={form.blood_group}
                  onChange={(e) => set("blood_group", e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm focus:border-brand focus:outline-none"
                >
                  <option value="">Select…</option>
                  {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Address">
                  <textarea
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-brand focus:outline-none"
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Role-specific */}
          {(isTeamRole || isMentorRole) && (
            <div>
              <h2 className="font-heading text-2xl tracking-tight">
                {isTeamRole ? "Institution" : "Professional details"}
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {isTeamRole && (
                  <Field label="College">
                    <Input value={form.college} onChange={(v) => set("college", v)} />
                  </Field>
                )}
                {isMentorRole && (
                  <Field label="Organization">
                    <Input value={form.organization} onChange={(v) => set("organization", v)} />
                  </Field>
                )}
                <Field label="City"><Input value={form.city} onChange={(v) => set("city", v)} /></Field>
                <Field label="State"><Input value={form.state} onChange={(v) => set("state", v)} /></Field>
              </div>
            </div>
          )}

          {/* Bank */}
          <div>
            <h2 className="font-heading text-2xl tracking-tight">Bank details</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Used only for reimbursements. Visible to you and programme admins — never to
              mentors, evaluators or other teams.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Account holder name">
                <Input value={form.bank_account_name} onChange={(v) => set("bank_account_name", v)} />
              </Field>
              <Field label="Account number">
                <input
                  type="text"
                  value={maskAcct && form.bank_account_number ? maskAccount(form.bank_account_number) : form.bank_account_number}
                  onFocus={() => setMaskAcct(false)}
                  onBlur={() => setMaskAcct(true)}
                  onChange={(e) => set("bank_account_number", e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm focus:border-brand focus:outline-none"
                />
              </Field>
              <Field label="IFSC code">
                <Input value={form.bank_ifsc} onChange={(v) => set("bank_ifsc", v.toUpperCase())} />
              </Field>
              <Field label="Branch">
                <Input value={form.bank_branch} onChange={(v) => set("bank_branch", v)} />
              </Field>
              <div className="md:col-span-2">
                <span className="mb-2 block text-xs font-medium tracking-[0.2em] text-muted-foreground">
                  CANCELLED CHEQUE
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-5 text-sm hover:bg-muted">
                    <Upload className="h-4 w-4" />
                    {chequePath ? "Replace file" : "Upload cancelled cheque"}
                    <input type="file" className="hidden" onChange={onChequeChange} disabled={busy} />
                  </label>
                  {chequePath && (
                    <button
                      type="button"
                      onClick={viewCheque}
                      className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
                    >
                      <FileText className="h-4 w-4" /> View cheque
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-full bg-brand px-6 text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </form>

        <h2 className="mt-16 font-heading text-2xl tracking-tight">Change password</h2>
        <form onSubmit={changePassword} className="mt-4 flex max-w-xl flex-wrap items-end gap-3">
          <Field label="New password">
            <Input type="password" value={newPwd} onChange={setNewPwd} />
          </Field>
          <button
            type="submit"
            disabled={busy || newPwd.length < 6}
            className="h-11 rounded-full border border-border px-6 hover:bg-muted disabled:opacity-50"
          >
            Update password
          </button>
        </form>

        <h2 className="mt-16 font-heading text-2xl tracking-tight">Google Calendar</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Connect your Google Calendar so Rakshak meetings are added automatically.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {cal?.connected ? (
            <>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Connected{cal.email ? ` as ${cal.email}` : ""}
              </span>
              <button
                onClick={disconnectCal}
                disabled={calBusy}
                className="h-10 rounded-full border border-border px-5 text-sm hover:bg-muted disabled:opacity-50"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={connectCalendar}
              disabled={calBusy || !cal}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              <Calendar className="h-4 w-4" />
              {calBusy ? "Connecting…" : "Connect Google Calendar"}
            </button>
          )}
        </div>

        <h2 className="mt-16 font-heading text-2xl tracking-tight">Session</h2>
        <button
          onClick={signOut}
          className="mt-4 h-11 rounded-full border border-red-500/40 px-6 text-red-600 hover:bg-red-500/10"
        >
          Sign out
        </button>
      </Section>
    </PlatformShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium tracking-[0.2em] text-muted-foreground">
        {label.toUpperCase()}
      </span>
      {children}
    </label>
  );
}

function Input({
  value, onChange, type = "text", required,
}: { value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <input
      type={type}
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm focus:border-brand focus:outline-none"
    />
  );
}
