import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { useRPAuth } from "@/lib/rakshak-platform/auth";
import { listAllArticlesAdmin, upsertArticle } from "@/lib/rakshak-platform/knowledge.functions";

export const Route = createFileRoute("/rakshak-platform/admin/knowledge")({
  component: AdminKnowledge,
});

const blank = {
  id: undefined as string | undefined,
  slug: "",
  title: "",
  category: "foundations",
  excerpt: "",
  body_md: "",
  hero_image_url: "",
  tags: [] as string[],
  is_published: false,
};

function AdminKnowledge() {
  const { loading, userId, isAdmin } = useRPAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchAll = useServerFn(listAllArticlesAdmin);
  const save = useServerFn(upsertArticle);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!userId) navigate({ to: "/rakshak-platform/auth" });
    else if (!isAdmin) navigate({ to: "/rakshak-platform/dashboard" });
  }, [loading, userId, isAdmin, navigate]);

  const { data } = useQuery({
    queryKey: ["rp-admin-articles"],
    queryFn: () => fetchAll(),
    enabled: !!userId && isAdmin,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const payload: any = {
        ...form,
        hero_image_url: form.hero_image_url || null,
        excerpt: form.excerpt || null,
      };
      if (!payload.id) delete payload.id;
      await save({ data: payload });
      setMsg("Saved.");
      setForm(blank);
      qc.invalidateQueries({ queryKey: ["rp-admin-articles"] });
      qc.invalidateQueries({ queryKey: ["rp-articles"] });
    } catch (err: any) {
      setMsg(err?.message || "Save failed");
    } finally { setBusy(false); }
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Admin · Knowledge Hub</Eyebrow>
        <h1 className="mt-6 font-heading text-3xl sm:text-4xl font-bold">Manage articles</h1>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr,1.2fr]">
          <div>
            <h2 className="font-heading text-xl font-semibold mb-4">Existing</h2>
            <div className="rounded-2xl border border-border divide-y">
              {(data?.articles ?? []).map((a: any) => (
                <button
                  key={a.id}
                  onClick={() => setForm({ ...blank, id: a.id, slug: a.slug, title: a.title, category: a.category, is_published: a.is_published })}
                  className="w-full text-left p-4 hover:bg-brand-lite/50"
                >
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">/{a.slug} · {a.category} · {a.is_published ? "Published" : "Draft"}</div>
                </button>
              ))}
              {(data?.articles ?? []).length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">No articles yet.</div>
              )}
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-heading text-xl font-semibold">{form.id ? "Edit" : "New"} article</h2>
            <input className="rp-input w-full" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <input className="rp-input w-full" placeholder="slug-with-dashes" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required pattern="[a-z0-9-]+" />
            <input className="rp-input w-full" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
            <input className="rp-input w-full" placeholder="Hero image URL (optional)" value={form.hero_image_url} onChange={(e) => setForm({ ...form, hero_image_url: e.target.value })} />
            <textarea className="rp-input w-full min-h-20" placeholder="Excerpt" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
            <textarea className="rp-input w-full min-h-64 font-mono text-sm" placeholder="# Markdown body" value={form.body_md} onChange={(e) => setForm({ ...form, body_md: e.target.value })} required />
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
              Published
            </label>
            <div className="flex gap-3">
              <button disabled={busy} className="h-11 rounded-full bg-brand px-6 text-sm text-brand-foreground disabled:opacity-60">
                {busy ? "Saving…" : "Save article"}
              </button>
              {form.id && (
                <button type="button" onClick={() => setForm(blank)} className="h-11 rounded-full border border-border px-6 text-sm">
                  New
                </button>
              )}
            </div>
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          </form>
        </div>
      </Section>
    </PlatformShell>
  );
}
