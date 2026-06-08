import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listMentorPendingReviews,
  listAdminPendingReviews,
  mentorReviewSubmission,
  adminReviewSubmission,
} from "@/lib/rakshak-platform/submissions.functions";
import { PHASE_TITLES } from "@/lib/rakshak-platform/constants";
import { CheckCircle2, XCircle, Loader2, History } from "lucide-react";
import { SubmissionTimeline } from "@/components/rakshak-platform/SubmissionTimeline";

type Role = "mentor" | "admin";

export function ReviewPanel({ role }: { role: Role }) {
  const qc = useQueryClient();
  const listFn = useServerFn(
    role === "mentor" ? listMentorPendingReviews : listAdminPendingReviews,
  );
  const reviewFn = useServerFn(
    role === "mentor" ? mentorReviewSubmission : adminReviewSubmission,
  );
  const queryKey = ["rp-pending-reviews", role];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => listFn(),
  });

  const items: any[] = (data as any)?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold">
          Pending {role === "mentor" ? "mentor" : "admin"} reviews
        </h2>
        <span className="text-xs text-muted-foreground">{items.length} awaiting</span>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing waiting. You're all caught up.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((s) => (
            <ReviewRow
              key={s.id}
              sub={s}
              onReview={async (decision, comment) => {
                try {
                  await reviewFn({ data: { submission_id: s.id, decision, comment } });
                  toast.success(
                    decision === "approve" ? "Approved" : "Changes requested",
                  );
                  await qc.invalidateQueries({ queryKey });
                } catch (e: any) {
                  toast.error(e?.message ?? "Failed");
                }
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewRow({
  sub,
  onReview,
}: {
  sub: any;
  onReview: (decision: "approve" | "request_changes", comment?: string) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const teamName = sub.team_name ?? sub.rp_teams?.team_name ?? "Team";
  return (
    <li className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Phase {sub.phase_number} · {PHASE_TITLES[sub.phase_number]}
          </div>
          <div className="font-heading text-lg font-semibold">{sub.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {teamName} · rev {sub.revision_number}
            {sub.submitted_at && ` · submitted ${new Date(sub.submitted_at).toLocaleString()}`}
          </div>
        </div>
      </div>
      {sub.summary && (
        <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{sub.summary}</p>
      )}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment for the team…"
        className="w-full rounded-lg border border-border bg-background p-2 text-sm mb-3"
        rows={2}
      />
      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onReview("approve", comment.trim() || undefined);
            setBusy(false);
          }}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" /> Approve
        </button>
        <button
          disabled={busy || !comment.trim()}
          onClick={async () => {
            setBusy(true);
            await onReview("request_changes", comment.trim());
            setBusy(false);
          }}
          title={!comment.trim() ? "Add a comment to request changes" : ""}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <XCircle className="h-4 w-4" /> Request changes
        </button>
        <button
          onClick={() => setShowTimeline((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted"
        >
          <History className="h-4 w-4" /> {showTimeline ? "Hide" : "Timeline"}
        </button>
      </div>
      {showTimeline && (
        <div className="mt-4">
          <SubmissionTimeline submissionId={sub.id} />
        </div>
      )}
    </li>
  );
}
