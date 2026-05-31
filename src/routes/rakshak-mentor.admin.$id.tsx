import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  APPLICATION_STATUSES,
  STATUS_META,
  type ApplicationStatus,
} from "@/lib/mentor/constants";
import { StatusBadge } from "./rakshak-mentor.admin.index";

export const Route = createFileRoute("/rakshak-mentor/admin/$id")({
  component: ReviewPage,
});

type AppRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  state: string | null;
  country: string;
  organisation: string | null;
  designation: string | null;
  linkedin_url: string | null;
  years_experience: number | null;
  expertise_domain: string | null;
  status: ApplicationStatus;
  internal_score: number | null;
  decision_notes: string | null;
  track_data: { motivation?: string; relevant_experience?: string } | null;
  submitted_at: string;
};

type FileRow = {
  id: string;
  kind: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  size_bytes: number;
  uploaded_at: string;
};

type ReviewRow = {
  id: string;
  reviewer_id: string;
  score: number | null;
  notes: string | null;
  recommendation: string | null;
  created_at: string;
};

function ReviewPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<AppRow | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // local edit state
  const [status, setStatus] = useState<ApplicationStatus>("submitted");
  const [score, setScore] = useState<string>("");
  const [decision, setDecision] = useState<string>("");
  // new review
  const [revScore, setRevScore] = useState<string>("");
  const [revNotes, setRevNotes] = useState<string>("");
  const [revRecommendation, setRevRecommendation] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setError(null);
    const [{ data: a, error: aErr }, { data: fs }, { data: rs }] = await Promise.all([
      supabase.from("applications").select("*").eq("id", id).maybeSingle(),
      supabase.from("application_files").select("*").eq("application_id", id),
      supabase.from("application_reviews").select("*").eq("application_id", id).order("created_at", { ascending: false }),
    ]);
    if (aErr) setError(aErr.message);
    setApp(a as AppRow | null);
    setFiles((fs as FileRow[]) ?? []);
    setReviews((rs as ReviewRow[]) ?? []);
    if (a) {
      setStatus((a as AppRow).status);
      setScore((a as AppRow).internal_score?.toString() ?? "");
      setDecision((a as AppRow).decision_notes ?? "");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  const saveApplication = async () => {
    if (!app) return;
    setSaving(true);
    try {
      const newScore = score.trim() === "" ? null : Number(score);
      const { error } = await supabase
        .from("applications")
        .update({
          status,
          internal_score: newScore,
          decision_notes: decision || null,
        })
        .eq("id", app.id);
      if (error) throw error;

      if (status !== app.status) {
        const { data: u } = await supabase.auth.getUser();
        await supabase.from("application_status_events").insert({
          application_id: app.id,
          from_status: app.status,
          to_status: status,
          changed_by: u.user?.id ?? null,
        });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addReview = async () => {
    if (!app) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const { error } = await supabase.from("application_reviews").insert({
        application_id: app.id,
        reviewer_id: u.user.id,
        score: revScore.trim() === "" ? null : Number(revScore),
        notes: revNotes || null,
        recommendation: revRecommendation || null,
      });
      if (error) throw error;
      setRevScore(""); setRevNotes(""); setRevRecommendation("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add review");
    } finally {
      setSaving(false);
    }
  };

  const openFile = async (f: FileRow) => {
    const { data, error } = await supabase.storage
      .from(f.storage_bucket)
      .createSignedUrl(f.storage_path, 60 * 10);
    if (error || !data) {
      setError(error?.message ?? "Could not open file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const deleteApp = async () => {
    if (!app) return;
    if (!confirm("Permanently delete this application? This cannot be undone.")) return;
    const { error } = await supabase.from("applications").delete().eq("id", app.id);
    if (error) setError(error.message);
    else navigate({ to: "/rakshak-mentor/admin" });
  };

  if (loading) return <div className="text-sm text-slate-500">Loading…</div>;
  if (!app) return <div className="text-sm text-red-700">Application not found.</div>;

  return (
    <div>
      <Link to="/rakshak-mentor/admin" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to applications
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{app.full_name}</h1>
          <div className="mt-1 text-sm text-slate-500">
            {app.email} · {app.phone}
          </div>
          <div className="mt-2"><StatusBadge status={app.status} /></div>
        </div>
        <button
          onClick={deleteApp}
          className="text-xs text-red-600 hover:underline"
        >
          Delete application
        </button>
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          {error}
        </div>
      )}

      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        {/* LEFT: applicant detail */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Applicant details">
            <Grid>
              <KV k="Organisation" v={app.organisation ?? "—"} />
              <KV k="Designation" v={app.designation ?? "—"} />
              <KV k="Years of experience" v={app.years_experience ?? "—"} />
              <KV k="Expertise" v={app.expertise_domain ?? "—"} />
              <KV k="Location" v={`${app.city}${app.state ? `, ${app.state}` : ""}, ${app.country}`} />
              <KV
                k="LinkedIn"
                v={
                  app.linkedin_url ? (
                    <a className="text-[#4A35FF] underline break-all" href={app.linkedin_url} target="_blank" rel="noopener noreferrer">
                      {app.linkedin_url}
                    </a>
                  ) : "—"
                }
              />
              <KV
                k="Submitted"
                v={new Date(app.submitted_at).toLocaleString("en-IN")}
              />
            </Grid>
          </Card>

          <Card title="Motivation">
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {app.track_data?.motivation || "—"}
            </p>
          </Card>

          <Card title="Relevant experience">
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {app.track_data?.relevant_experience || "—"}
            </p>
          </Card>

          <Card title="Files">
            {files.length === 0 && <div className="text-sm text-slate-500">No files uploaded.</div>}
            <ul className="divide-y divide-slate-100">
              {files.map((f) => (
                <li key={f.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{f.file_name}</div>
                    <div className="text-xs text-slate-500">
                      {f.kind} · {(f.size_bytes / 1024 / 1024).toFixed(2)} MB ·{" "}
                      {new Date(f.uploaded_at).toLocaleString("en-IN")}
                    </div>
                  </div>
                  <button
                    onClick={() => openFile(f)}
                    className="px-3 py-1.5 text-xs rounded-md bg-slate-900 text-white hover:bg-slate-800"
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Reviewer notes & scoring">
            <div className="space-y-3 mb-5">
              {reviews.length === 0 && (
                <div className="text-sm text-slate-500">No reviews yet.</div>
              )}
              {reviews.map((r) => (
                <div key={r.id} className="border border-slate-200 rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      {new Date(r.created_at).toLocaleString("en-IN")}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {r.recommendation && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {r.recommendation}
                        </span>
                      )}
                      {r.score !== null && (
                        <span className="font-semibold text-slate-900">Score: {r.score}</span>
                      )}
                    </div>
                  </div>
                  {r.notes && (
                    <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{r.notes}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="text-xs font-semibold text-slate-700">Add a review</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Score (0–10)</label>
                  <input
                    type="number" min={0} max={10} step={0.5}
                    value={revScore}
                    onChange={(e) => setRevScore(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Recommendation</label>
                  <select
                    value={revRecommendation}
                    onChange={(e) => setRevRecommendation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  >
                    <option value="">—</option>
                    <option value="shortlist">Shortlist</option>
                    <option value="interview">Interview</option>
                    <option value="hold">Hold</option>
                    <option value="reject">Reject</option>
                  </select>
                </div>
              </div>
              <textarea
                rows={3}
                value={revNotes}
                onChange={(e) => setRevNotes(e.target.value)}
                placeholder="Notes…"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
              <button
                onClick={addReview}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-md bg-[#4A35FF] text-white font-semibold hover:bg-[#3A28D9] disabled:opacity-50"
              >
                Add review
              </button>
            </div>
          </Card>
        </div>

        {/* RIGHT: status & internal */}
        <div className="space-y-6">
          <Card title="Status & decision">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                >
                  {APPLICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_META[s].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Internal score</label>
                <input
                  type="number" min={0} max={10} step={0.5}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Decision notes</label>
                <textarea
                  rows={4}
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <button
                onClick={saveApplication}
                disabled={saving}
                className="w-full px-4 py-2 text-sm rounded-md bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-5">
      <h2 className="text-sm font-bold tracking-tight text-slate-900 mb-4">{title}</h2>
      {children}
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">{children}</div>;
}
function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{k}</div>
      <div className="text-slate-900 font-medium">{v}</div>
    </div>
  );
}
