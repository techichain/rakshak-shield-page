import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Link as LinkIcon, Loader2, Download, ExternalLink, Trash2 } from "lucide-react";
import {
  listTeamResourcesForViewer,
  listTeamResourcesAdmin,
  getResourceDownloadUrl,
  deleteMentorResource,
} from "@/lib/rakshak-platform/mentor-resources.functions";

type Resource = {
  id: string;
  title: string;
  description: string | null;
  kind: "file" | "link";
  external_url: string | null;
  file_name: string | null;
  file_size: number | null;
  storage_path: string | null;
  team_id: string | null;
  mentor_id: string;
  source?: "mentor" | "admin";
  created_at: string;
  rp_profiles?: { full_name: string | null } | null;
  rp_teams?: { id: string; team_name: string } | null;
};


function fmtSize(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function MentorResourcesList({
  mode,
  teamId,
  canDelete = false,
  onChanged,
}: {
  mode: "viewer" | "admin";
  teamId?: string;
  canDelete?: boolean;
  onChanged?: () => void;
}) {
  const fetchViewer = useServerFn(listTeamResourcesForViewer);
  const fetchAdmin = useServerFn(listTeamResourcesAdmin);
  const fetchDownload = useServerFn(getResourceDownloadUrl);
  const removeResource = useServerFn(deleteMentorResource);
  const [items, setItems] = useState<Resource[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      setErr(null);
      try {
        const res =
          mode === "admin" && teamId
            ? await fetchAdmin({ data: { team_id: teamId } } as any)
            : await fetchViewer({ data: teamId ? { team_id: teamId } : {} } as any);
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
  }, [mode, teamId, fetchAdmin, fetchViewer, reloadKey]);

  async function handleDownload(r: Resource) {
    setDownloadingId(r.id);
    try {
      const { url } = (await fetchDownload({ data: { id: r.id } } as any)) as any;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(r: Resource) {
    if (!confirm(`Delete "${r.title}"?`)) return;
    try {
      await removeResource({ data: { id: r.id } } as any);
      setReloadKey((k) => k + 1);
      onChanged?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  }

  if (busy) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading resources…
      </div>
    );
  }

  if (err) {
    return <p className="text-sm text-red-600 py-2">{err}</p>;
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No resources shared yet. Your mentor will share reading material, templates or reference links here.
      </p>
    );
  }

  return (
    <ul className="mt-2 divide-y divide-border">
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
            <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {r.rp_profiles?.full_name && <span>By {r.rp_profiles.full_name}</span>}
              {r.rp_teams?.team_name && <span>· {r.rp_teams.team_name}</span>}
              {!r.team_id && <span>· All teams</span>}
              <span>· {new Date(r.created_at).toLocaleDateString()}</span>
              {r.kind === "file" && r.file_size ? <span>· {fmtSize(r.file_size)}</span> : null}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {r.kind === "file" ? (
              <button
                onClick={() => handleDownload(r)}
                disabled={downloadingId === r.id}
                className="text-xs inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 hover:bg-muted disabled:opacity-50"
              >
                {downloadingId === r.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                Download
              </button>
            ) : (
              <a
                href={r.external_url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 hover:bg-muted"
              >
                <ExternalLink className="h-3 w-3" />
                Open
              </a>
            )}
            {canDelete && (
              <button
                onClick={() => handleDelete(r)}
                className="text-xs inline-flex items-center gap-1 rounded-full border border-red-200 text-red-600 px-2 py-1 hover:bg-red-50"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
