import { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { EmptyState } from "@/components/rakshak-platform/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  listTeamMedia,
  addTeamMedia,
  updateTeamMedia,
  deleteTeamMedia,
} from "@/lib/rakshak-platform/media.functions";
import { Images, Upload, Trash2, Play, ImageIcon, ExternalLink, Save } from "lucide-react";

const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function prettySize(n?: number | null) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function kindOf(file: File): "photo" | "video" {
  return file.type.startsWith("video/") ? "video" : "photo";
}

/**
 * Site media gallery for one team — photos and videos together.
 * Teams upload and curate; mentors, admins and evaluators pass readOnly.
 */
export function MediaGallery({
  teamId,
  readOnly = false,
  heading = "Site media",
}: {
  teamId: string;
  readOnly?: boolean;
  heading?: string;
}) {
  const listFn = useServerFn(listTeamMedia);
  const addFn = useServerFn(addTeamMedia);
  const updateFn = useServerFn(updateTeamMedia);
  const delFn = useServerFn(deleteTeamMedia);

  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<"all" | "photo" | "video">("all");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  // Upload defaults applied to the next batch.
  const [uploadLocation, setUploadLocation] = useState("");
  const [uploadPhase, setUploadPhase] = useState("");
  const [uploadCaption, setUploadCaption] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await listFn({ data: { team_id: teamId } } as any)) as any;
      setItems(res?.items ?? []);
      setLocations(res?.locations ?? []);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Could not load media");
    } finally {
      setLoading(false);
    }
  }, [listFn, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Signed thumbnails for the photos currently on screen.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const photos = items.filter((i) => i.media_type !== "video");
      const next: Record<string, string> = {};
      for (const p of photos) {
        if (thumbs[p.id]) continue;
        const { data } = await supabase.storage
          .from("rp-submissions")
          .createSignedUrl(p.storage_path, 60 * 60);
        if (data?.signedUrl) next[p.id] = data.signedUrl;
      }
      if (!cancelled && Object.keys(next).length > 0) {
        setThumbs((t) => ({ ...t, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setErr(null);
    try {
      for (const file of Array.from(files)) {
        const media_type = kindOf(file);
        const cap = media_type === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        if (file.size > cap) {
          setErr(
            `${file.name} is larger than ${media_type === "video" ? "50" : "30"} MB and was skipped.`,
          );
          continue;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        // Leading segment must be the team id — the storage rules key on it.
        const path = `${teamId}/media/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("rp-submissions")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        await addFn({
          data: {
            team_id: teamId,
            location_id: uploadLocation || null,
            phase_number: uploadPhase === "" ? null : Number(uploadPhase),
            media_type,
            file_name: file.name,
            storage_path: path,
            mime_type: file.type || null,
            file_size: file.size,
            caption: uploadCaption || null,
          },
        } as any);
      }
      setUploadCaption("");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function open(path: string) {
    const { data, error } = await supabase.storage
      .from("rp-submissions")
      .createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) {
      setErr("Could not open this file.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function saveItem(item: any, patch: Record<string, any>) {
    try {
      await updateFn({ data: { id: item.id, ...patch } } as any);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Could not save");
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this item from the gallery?")) return;
    try {
      await delFn({ data: { id } } as any);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Could not delete");
    }
  }

  const locName = (id: string | null) =>
    locations.find((l) => l.id === id)?.location_name ?? null;

  const shown = items.filter((i) =>
    filter === "all" ? true : filter === "video" ? i.media_type === "video" : i.media_type !== "video",
  );
  const photoCount = items.filter((i) => i.media_type !== "video").length;
  const videoCount = items.filter((i) => i.media_type === "video").length;

  return (
    <div className="rp-card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Images className="size-4 text-brand" aria-hidden />
          <h2 className="font-semibold">{heading}</h2>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {(["all", "photo", "video"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 ${
                filter === f ? "border-brand text-brand" : "border-border text-muted-foreground"
              }`}
            >
              {f === "all"
                ? `All (${items.length})`
                : f === "photo"
                  ? `Photos (${photoCount})`
                  : `Videos (${videoCount})`}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Every photo and video your team has captured on site, in one place. Items uploaded against a
        specific location appear here too.
      </p>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      {!readOnly && (
        <div className="mt-4 rounded-xl border border-border p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium">Link to a location</span>
              <select
                value={uploadLocation}
                onChange={(e) => setUploadLocation(e.target.value)}
                className="rp-input w-full mt-1"
              >
                <option value="">Team-wide (no location)</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.location_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Phase</span>
              <select
                value={uploadPhase}
                onChange={(e) => setUploadPhase(e.target.value)}
                className="rp-input w-full mt-1"
              >
                <option value="">Not linked to a phase</option>
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n} value={String(n)}>
                    Phase {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Caption</span>
              <input
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
                maxLength={2000}
                className="rp-input w-full mt-1"
                placeholder="Optional"
              />
            </label>
          </div>
          <label htmlFor="rp-media-upload-input" className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <span className="rp-btn-primary inline-flex items-center gap-1">
              <Upload className="size-4" />
              {uploading ? "Uploading…" : "Upload photos or videos"}
            </span>
            <input
              id="rp-media-upload-input"
              type="file"
              multiple
              accept="image/*,video/*"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                void upload(e.target.files);
                e.target.value = "";
              }}
            />
            <span className="text-xs text-muted-foreground">
              Images up to 30 MB, videos up to 50 MB
            </span>
          </label>
        </div>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading media…</p>
      ) : shown.length === 0 ? (
        readOnly ? (
          <p className="mt-4 text-sm text-muted-foreground">
            This team has not uploaded any media yet.
          </p>
        ) : (
          <EmptyState
            className="mt-4"
            icon={ImageIcon}
            title="No site media yet"
            description="Upload photos and videos from your audit sites. They'll appear here for mentors and reviewers to see."
            action={{
              label: "Upload media",
              onClick: () =>
                document.getElementById("rp-media-upload-input")?.click(),
            }}
          />
        )
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((m) => (
            <figure key={m.id} className="rounded-xl border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => open(m.storage_path)}
                className="block w-full aspect-video bg-muted relative"
                aria-label={`Open ${m.file_name}`}
              >
                {m.media_type === "video" ? (
                  <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <Play className="size-8" aria-hidden />
                  </span>
                ) : thumbs[m.id] ? (
                  <img
                    src={thumbs[m.id]}
                    alt={m.caption || m.file_name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="size-8" aria-hidden />
                  </span>
                )}
              </button>
              <figcaption className="p-3 space-y-2">
                <div className="text-sm font-medium break-words">{m.caption || m.file_name}</div>
                <div className="text-xs text-muted-foreground">
                  {[
                    m.media_type === "video" ? "Video" : "Photo",
                    prettySize(m.file_size),
                    locName(m.location_id),
                    m.phase_number != null ? `Phase ${m.phase_number}` : null,
                    new Date(m.created_at).toLocaleDateString("en-IN"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => open(m.storage_path)}
                    className="inline-flex items-center gap-1 underline text-brand hover:opacity-80"
                  >
                    <ExternalLink className="size-3" /> Open
                  </button>
                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const c = prompt("Caption", m.caption ?? "");
                          if (c !== null) void saveItem(m, { caption: c });
                        }}
                        className="inline-flex items-center gap-1 underline hover:opacity-80"
                      >
                        <Save className="size-3" /> Caption
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(m.id)}
                        aria-label={`Delete ${m.file_name}`}
                        className="inline-flex items-center gap-1 underline text-red-600 hover:opacity-80"
                      >
                        <Trash2 className="size-3" /> Delete
                      </button>
                    </>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
