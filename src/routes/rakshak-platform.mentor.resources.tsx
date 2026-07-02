import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { rpRequireRole, useRPAuth } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { MentorResourcesList } from "@/components/rakshak-platform/MentorResourcesList";
import {
  createMentorResource,
  getMentorResourceUploadUrl,
  listMyMentorResources,
} from "@/lib/rakshak-platform/mentor-resources.functions";
import { deleteMentorResource, getResourceDownloadUrl } from "@/lib/rakshak-platform/mentor-resources.functions";
import { Loader2, Upload, Link as LinkIcon, FileText, Download, Trash2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/mentor/resources")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["mentor"]);
  },
  component: MentorResourcesPage,
});

function MentorResourcesPage() {
  const { loading, userId } = useRPAuth();
  const fetchList = useServerFn(listMyMentorResources);
  const create = useServerFn(createMentorResource);
  const getUpload = useServerFn(getMentorResourceUploadUrl);
  const removeOne = useServerFn(deleteMentorResource);
  const getDownload = useServerFn(getResourceDownloadUrl);

  const [teams, setTeams] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [kind, setKind] = useState<"file" | "link">("file");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teamId, setTeamId] = useState<string>(""); // "" = all teams
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || !userId) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const [{ data: mentor }, res] = await Promise.all([
          supabase.from("rp_mentors").select("id").eq("profile_id", userId).maybeSingle(),
          fetchList({ data: {} } as any),
        ]);
        if (mentor) {
          const { data: t } = await supabase
            .from("rp_teams")
            .select("id, team_name")
            .eq("assigned_mentor_id", mentor.id)
            .order("team_name");
          if (!cancelled) setTeams(t ?? []);
        }
        if (!cancelled) setItems((res as any)?.resources ?? []);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, userId, fetchList, reloadKey]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (!title.trim()) {
      setErr("Title required");
      return;
    }
    if (kind === "link" && !externalUrl.trim()) {
      setErr("Link URL required");
      return;
    }
    if (kind === "file" && !file) {
      setErr("File required");
      return;
    }
    setSubmitting(true);
    try {
      let payload: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        team_id: teamId || null,
        kind,
      };
      if (kind === "link") {
        payload.external_url = externalUrl.trim();
      } else if (file) {
        const { path, token } = (await getUpload({ data: { file_name: file.name } } as any)) as any;
        const { error: upErr } = await supabase.storage
          .from("rp-mentor-resources")
          .uploadToSignedUrl(path, token, file, { contentType: file.type || undefined });
        if (upErr) throw upErr;
        payload.storage_path = path;
        payload.file_name = file.name;
        payload.file_type = file.type || null;
        payload.file_size = file.size;
      }
      await create({ data: payload } as any);
      setOk("Resource shared.");
      setTitle("");
      setDescription("");
      setExternalUrl("");
      setFile(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this resource?")) return;
    try {
      await removeOne({ data: { id } } as any);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function handleDownload(id: string) {
    try {
      const { url } = (await getDownload({ data: { id } } as any)) as any;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Download failed");
    }
  }

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Mentor · Share resources</Eyebrow>
        <div className="mt-4 flex items-center justify-between">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold">Resources you share</h1>
          <Link to="/rakshak-platform/mentor" className="text-sm text-brand hover:underline">
            ← Back to mentor
          </Link>
        </div>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Share reading material, templates, slides or reference links with your assigned teams. Files and links
          become visible to the team leader, team members, and admins.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-5">
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 space-y-4"
          >
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKind("file")}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm inline-flex items-center justify-center gap-1 ${
                  kind === "file" ? "border-brand bg-brand-lite" : "border-border"
                }`}
              >
                <FileText className="h-4 w-4" /> File
              </button>
              <button
                type="button"
                onClick={() => setKind("link")}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm inline-flex items-center justify-center gap-1 ${
                  kind === "link" ? "border-brand bg-brand-lite" : "border-border"
                }`}
              >
                <LinkIcon className="h-4 w-4" /> Link
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="e.g. Phase 2 pre-read"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Short note about what this covers…"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide">Share with</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">All my assigned teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.team_name}
                  </option>
                ))}
              </select>
            </div>

            {kind === "file" ? (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide">File</label>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="mt-1 block w-full text-sm"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv"
                />
                <p className="text-[11px] text-muted-foreground mt-1">PDF, Office docs, images. Max 100 MB.</p>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide">URL</label>
                <input
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="https://…"
                />
              </div>
            )}

            {err && <p className="text-sm text-red-600">{err}</p>}
            {ok && <p className="text-sm text-green-700">{ok}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-brand text-brand-foreground px-4 py-2 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Share resource
            </button>
          </form>

          <div className="lg:col-span-3 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">Your shared resources</h2>
            {busy ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : items.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nothing shared yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {items.map((r) => (
                  <li key={r.id} className="py-3 flex items-start gap-3">
                    <div className="mt-1 h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {r.kind === "file" ? (
                        <FileText className="h-4 w-4 text-brand" />
                      ) : (
                        <LinkIcon className="h-4 w-4 text-brand" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{r.title}</div>
                      {r.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">
                          {r.description}
                        </p>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {r.rp_teams?.team_name ?? "All teams"} · {new Date(r.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.kind === "file" ? (
                        <button
                          onClick={() => handleDownload(r.id)}
                          className="text-xs inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 hover:bg-muted"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                      ) : (
                        <a
                          href={r.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 hover:bg-muted"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-xs inline-flex items-center gap-1 rounded-full border border-red-200 text-red-600 px-2 py-1 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>
    </PlatformShell>
  );
}
