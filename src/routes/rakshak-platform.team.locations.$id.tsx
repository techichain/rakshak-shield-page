import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRPAuth, rpRequireRole } from "@/lib/rakshak-platform/auth";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { LocationMap } from "@/components/rakshak-platform/LocationMap";
import { ArrowLeft, Camera, Star, Trash2, Upload, Send, Crosshair } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/team/locations/$id")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole(["team_leader", "team_member"]);
  },
  component: LocationDetail,
});

function LocationDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { loading, userId, isTeam, isAdmin } = useRPAuth();
  const [loc, setLoc] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!userId) { navigate({ to: "/rakshak-platform/auth" }); return; }
    void load();
  }, [loading, userId, id]);

  async function load() {
    const { data: l } = await supabase.from("rp_locations").select("*").eq("id", id).maybeSingle();
    setLoc(l);
    if (!l) return;
    const { data: t } = await supabase.from("rp_teams").select("*").eq("id", l.team_id).maybeSingle();
    setTeam(t);
    const { data: p } = await supabase
      .from("rp_location_photos")
      .select("*")
      .eq("location_id", id)
      .order("created_at", { ascending: false });
    setPhotos(p ?? []);
    // sign URLs
    const sig: Record<string, string> = {};
    await Promise.all(
      (p ?? []).map(async (ph) => {
        const { data } = await supabase.storage.from("rp-submissions").createSignedUrl(ph.storage_path, 60 * 60);
        if (data?.signedUrl) sig[ph.id] = data.signedUrl;
      }),
    );
    setSigned(sig);
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !loc) return;
    const MAX = 100 * 1024 * 1024;
    if (file.size > MAX) {
      setErr(`File too large — max 100 MB (got ${(file.size / 1024 / 1024).toFixed(1)} MB).`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    setErr(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const key = `${crypto.randomUUID()}.${ext}`;
      const path = `locations/${loc.team_id}/${loc.id}/${key}`;
      const { error: upErr } = await supabase.storage
        .from("rp-submissions")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { error: rowErr } = await supabase.from("rp_location_photos").insert({
        location_id: loc.id,
        team_id: loc.team_id,
        file_name: file.name,
        storage_path: path,
        file_size: file.size,
        mime_type: file.type,
        caption: caption.trim() || null,
        latitude: loc.latitude,
        longitude: loc.longitude,
        taken_at: new Date().toISOString(),
        uploaded_by: userId,
      });
      if (rowErr) throw rowErr;
      setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      void load();
    } catch (e: any) {
      setErr(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveDriveLink() {
    if (!loc) return;
    const current = loc.drive_link ?? "";
    const next = prompt("Google Drive link (leave blank to remove):", current);
    if (next === null) return;
    const trimmed = next.trim();
    if (trimmed) {
      try { new URL(trimmed); } catch { alert("Must be a valid URL."); return; }
    }
    await supabase.from("rp_locations").update({ drive_link: trimmed || null }).eq("id", loc.id);
    void load();
  }

  async function removePhoto(ph: any) {
    if (!confirm("Delete this photo?")) return;
    await supabase.storage.from("rp-submissions").remove([ph.storage_path]);
    await supabase.from("rp_location_photos").delete().eq("id", ph.id);
    void load();
  }

  async function toggleFinal() {
    if (!loc) return;
    await supabase.from("rp_locations").update({ is_final_selected: !loc.is_final_selected }).eq("id", loc.id);
    void load();
  }

  async function markSubmittedToAuthority() {
    if (!loc) return;
    const response = prompt("Optional: paste any acknowledgment / reference number from the authority", "") ?? "";
    await supabase.from("rp_locations").update({
      submitted_to_authority_at: new Date().toISOString(),
      authority_response: response || null,
    }).eq("id", loc.id);
    void load();
  }

  if (loading || !loc) {
    return <PlatformShell><Section>Loading…</Section></PlatformShell>;
  }

  const canEdit = isAdmin || isTeam;

  return (
    <PlatformShell>
      <Section>
        <Link to="/rakshak-platform/team/locations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to all locations
        </Link>
        <Eyebrow>{loc.issue_type ?? "Unsafe location"}</Eyebrow>
        <h1 className="mt-6 font-heading text-3xl sm:text-4xl font-bold leading-tight">
          {loc.location_name}
          {loc.is_final_selected && <span className="ml-3 inline-flex items-center gap-1 text-sm align-middle text-brand"><Star className="h-4 w-4" /> Final</span>}
        </h1>
        <p className="mt-2 text-muted-foreground">{[loc.address, loc.city, loc.state].filter(Boolean).join(" · ")}</p>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-3 overflow-hidden">
            <LocationMap
              markers={[{
                id: loc.id,
                lat: Number(loc.latitude),
                lng: Number(loc.longitude),
                title: loc.location_name,
                subtitle: loc.issue_type,
                severity: loc.severity,
                isFinal: loc.is_final_selected,
              }]}
              height="380px"
            />
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <Meta label="Team">{team?.team_name ?? "—"}</Meta>
            <Meta label="Severity"><span className="capitalize">{loc.severity ?? "—"}</span></Meta>
            <Meta label="Phase">{loc.phase_number}</Meta>
            <Meta label="Submitted to authority">
              {loc.submitted_to_authority_at
                ? new Date(loc.submitted_to_authority_at).toLocaleDateString()
                : "Not yet"}
            </Meta>
            {loc.authority_response && <Meta label="Authority response">{loc.authority_response}</Meta>}
            {loc.description && <Meta label="Description"><span className="font-normal text-foreground">{loc.description}</span></Meta>}
            {loc.drive_link && (
              <Meta label="Drive link">
                <a href={loc.drive_link} target="_blank" rel="noopener noreferrer"
                  className="font-normal text-brand hover:underline break-all">
                  {loc.drive_link}
                </a>
              </Meta>
            )}
            {canEdit && (
              <div className="pt-2 flex flex-wrap gap-2">
                <button onClick={toggleFinal}
                  className={`h-10 rounded-full px-4 text-xs inline-flex items-center gap-1 ${loc.is_final_selected ? "bg-brand text-brand-foreground" : "border border-border hover:border-brand/40"}`}>
                  <Star className="h-3.5 w-3.5" /> {loc.is_final_selected ? "Unmark final" : "Mark as final"}
                </button>
                {!loc.submitted_to_authority_at && (
                  <button onClick={markSubmittedToAuthority}
                    className="h-10 rounded-full border border-border px-4 text-xs hover:border-brand/40 inline-flex items-center gap-1">
                    <Send className="h-3.5 w-3.5" /> Log authority submission
                  </button>
                )}
                <button onClick={saveDriveLink}
                  className="h-10 rounded-full border border-border px-4 text-xs hover:border-brand/40 inline-flex items-center gap-1">
                  {loc.drive_link ? "Edit Drive link" : "Add Drive link"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <h2 className="font-heading text-2xl font-bold">
              Photo &amp; video evidence<br /><span className="text-brand">{photos.length} uploaded</span>
            </h2>
            {canEdit && (
              <label className="h-12 rounded-full bg-brand px-7 text-sm text-brand-foreground inline-flex items-center gap-2 hover:bg-brand/90 cursor-pointer">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : "Add photo / video"}
                <input ref={fileRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={upload} disabled={uploading} />
              </label>
            )}
          </div>
          {canEdit && (
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={200}
              placeholder="Optional caption applied to the next file you upload"
              className="rp-input mt-4 max-w-2xl"
            />
          )}
          {err && <div className="mt-3 text-sm text-red-600">{err}</div>}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                <Camera className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                No media yet. Upload geo-tagged photos or short videos of the unsafe condition.
              </div>
            )}
            {photos.map((ph) => {
              const isVideo = typeof ph.mime_type === "string" && ph.mime_type.startsWith("video/");
              return (
                <div key={ph.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                  {signed[ph.id] ? (
                    isVideo ? (
                      <video src={signed[ph.id]} controls className="w-full h-48 object-cover bg-black" />
                    ) : (
                      <img src={signed[ph.id]} alt={ph.caption ?? ph.file_name}
                        className="w-full h-48 object-cover" loading="lazy" />
                    )
                  ) : (
                    <div className="w-full h-48 bg-muted animate-pulse" />
                  )}
                  <div className="p-3">
                    <div className="text-xs text-muted-foreground">
                      {new Date(ph.created_at).toLocaleString()}
                    </div>
                    {ph.caption && <div className="text-sm mt-1">{ph.caption}</div>}
                    {canEdit && (
                      <button onClick={() => removePhoto(ph)}
                        className="mt-2 text-xs text-red-600 inline-flex items-center gap-1 hover:underline">
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Section>
    </PlatformShell>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{children}</div>
    </div>
  );
}
