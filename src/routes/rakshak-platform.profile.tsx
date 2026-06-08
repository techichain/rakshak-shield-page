import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { loading, userId, email, roles } = useRPAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "", phone: "", city: "", state: "", organization: "", avatar_url: "",
  });
  const [newPwd, setNewPwd] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    (async () => {
      const { data } = await supabase.from("rp_profiles").select("*").eq("id", userId).maybeSingle();
      if (data) setForm({
        full_name: data.full_name ?? "",
        phone: data.phone ?? "",
        city: data.city ?? "",
        state: data.state ?? "",
        organization: data.organization ?? "",
        avatar_url: data.avatar_url ?? "",
      });
    })();
  }, [loading, userId, navigate]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true); setMsg(null); setErr(null);
    const { error } = await supabase.from("rp_profiles").upsert({
      id: userId,
      email: email ?? "",
      ...form,
    });
    if (error) setErr(error.message); else setMsg("Profile saved.");
    setBusy(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 6) { setErr("Password must be at least 6 characters."); return; }
    setBusy(true); setMsg(null); setErr(null);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) setErr(error.message); else { setMsg("Password updated."); setNewPwd(""); }
    setBusy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/rakshak-platform/auth" });
  }

  if (loading) return <PlatformShell><Section><Loader2 className="animate-spin" /></Section></PlatformShell>;

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Your account</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Profile &<br /><span className="text-brand">account settings.</span>
        </h1>

        <div className="mt-3 text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{email}</span>
          {roles.length > 0 && (
            <span className="ml-2">·{" "}
              {roles.map((r) => <span key={r} className="ml-1 rounded-full bg-brand/10 text-brand px-2 py-0.5 text-xs">{r}</span>)}
            </span>
          )}
        </div>

        {msg && <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">{msg}</p>}
        {err && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">{err}</p>}

        <form onSubmit={save} className="mt-8 grid gap-4 md:grid-cols-2 max-w-3xl">
          <Field label="Full name"><Input value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} required /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} /></Field>
          <Field label="City"><Input value={form.city} onChange={(v) => setForm({ ...form, city: v })} /></Field>
          <Field label="State"><Input value={form.state} onChange={(v) => setForm({ ...form, state: v })} /></Field>
          <Field label="Organization"><Input value={form.organization} onChange={(v) => setForm({ ...form, organization: v })} /></Field>
          <Field label="Avatar URL"><Input value={form.avatar_url} onChange={(v) => setForm({ ...form, avatar_url: v })} /></Field>
          <div className="md:col-span-2">
            <button type="submit" disabled={busy} className="h-11 px-6 rounded-full bg-brand text-brand-foreground hover:bg-brand/90 disabled:opacity-50">
              {busy ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>

        <h2 className="mt-16 font-heading text-2xl tracking-tight">Change password</h2>
        <form onSubmit={changePassword} className="mt-4 flex flex-wrap items-end gap-3 max-w-xl">
          <Field label="New password">
            <Input type="password" value={newPwd} onChange={setNewPwd} />
          </Field>
          <button type="submit" disabled={busy || newPwd.length < 6} className="h-11 px-6 rounded-full border border-border hover:bg-muted disabled:opacity-50">
            Update password
          </button>
        </form>

        <h2 className="mt-16 font-heading text-2xl tracking-tight">Session</h2>
        <button onClick={signOut} className="mt-4 h-11 px-6 rounded-full border border-red-500/40 text-red-600 hover:bg-red-500/10">
          Sign out
        </button>
      </Section>
    </PlatformShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium tracking-[0.2em] text-muted-foreground mb-2">{label.toUpperCase()}</span>
      {children}
    </label>
  );
}

function Input({ value, onChange, type = "text", required }: { value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <input
      type={type}
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-11 rounded-xl border border-border bg-card px-4 text-sm focus:outline-none focus:border-brand"
    />
  );
}
