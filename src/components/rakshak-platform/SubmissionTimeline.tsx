import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSubmissionTimeline } from "@/lib/rakshak-platform/submissions.functions";
import {
  History,
  FilePlus2,
  Send,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Event = {
  kind: "status" | "comment";
  id: string;
  at: string;
  actor_name: string;
  actor_role: string | null;
  action: string;
  from_status?: string | null;
  to_status?: string | null;
  text?: string;
  title?: string | null;
};

function iconFor(ev: Event) {
  const a = ev.action;
  if (ev.kind === "comment") return <MessageSquare className="h-3.5 w-3.5" />;
  if (a === "submission_created") return <FilePlus2 className="h-3.5 w-3.5" />;
  if (a.includes("status_submitted") || a.includes("status_resubmitted"))
    return <Send className="h-3.5 w-3.5" />;
  if (a.includes("mentor_approved")) return <ShieldCheck className="h-3.5 w-3.5" />;
  if (a.includes("admin_approved")) return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (a.includes("changes_requested")) return <XCircle className="h-3.5 w-3.5" />;
  return <History className="h-3.5 w-3.5" />;
}

function labelFor(ev: Event) {
  if (ev.kind === "comment") {
    return `${ev.actor_role ?? "Reviewer"} comment`;
  }
  const a = ev.action.replace(/^submission_/, "");
  if (a === "created") return `Created${ev.title ? ` — “${ev.title}”` : ""}`;
  if (a === "status_submitted") return "Submitted for mentor review";
  if (a === "status_resubmitted") return "Resubmitted with revisions";
  if (a === "status_mentor_approved") return "Mentor approved — awaiting admin";
  if (a === "status_admin_approved") return "Admin approved — phase complete";
  if (a === "status_changes_requested") return "Changes requested";
  if (a === "status_completed") return "Phase completed";
  return a.replace(/_/g, " ");
}

export function SubmissionTimeline({ submissionId }: { submissionId: string }) {
  const fn = useServerFn(getSubmissionTimeline);
  const { data, isLoading, error } = useQuery({
    queryKey: ["rp-submission-timeline", submissionId],
    queryFn: () => fn({ data: { submission_id: submissionId } }),
  });

  return (
    <div className="rp-card p-5">
      <h3 className="font-semibold flex items-center gap-2 mb-3">
        <History className="size-4" /> Submission timeline
      </h3>
      {isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading timeline">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{String((error as any).message ?? error)}</p>
      ) : !data?.events?.length ? (
        <div className="flex flex-col items-center text-center py-6 rounded-md border border-dashed border-border">
          <History className="h-6 w-6 text-muted-foreground mb-1.5" aria-hidden />
          <p className="text-sm font-medium">No activity yet</p>
          <p className="text-xs text-muted-foreground mt-0.5">Events will appear here as the submission moves through review.</p>
        </div>
      ) : (
        <ol className="relative space-y-4 pl-5 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-px before:bg-border">
          {data.events.map((ev) => {
            const e = ev as Event;
            return (
              <li key={e.id} className="relative">
                <span className="absolute -left-[18px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-brand-foreground">
                  {iconFor(e)}
                </span>
                <div className="text-sm font-medium leading-snug">{labelFor(e)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {e.actor_name}
                  {e.actor_role ? ` · ${e.actor_role}` : ""} ·{" "}
                  {new Date(e.at).toLocaleString()}
                </div>
                {e.kind === "comment" && e.text && (
                  <p className="text-sm mt-1 whitespace-pre-line border-l-2 border-border pl-3 text-foreground/90">
                    {e.text}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
