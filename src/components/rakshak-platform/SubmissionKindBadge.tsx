import { BadgeCheck, ClipboardList, FileText, File } from "lucide-react";

const TYPE_META: Record<string, { label: string; icon: typeof FileText }> = {
  questionnaire: { label: "Questionnaire", icon: ClipboardList },
  report: { label: "Report", icon: FileText },
  other: { label: "Other", icon: File },
};

/**
 * Shows what kind of document a submission is (questionnaire / report / other)
 * and whether it is the team's final submission for the phase.
 * Display-only — it does not affect any review action.
 */
export function SubmissionKindBadge({
  documentType,
  isFinal,
  className = "",
}: {
  documentType?: string | null;
  isFinal?: boolean | null;
  className?: string;
}) {
  const meta = TYPE_META[documentType ?? "report"] ?? TYPE_META.report;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden /> {meta.label}
      </span>
      {isFinal ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-brand">
          <BadgeCheck className="h-3 w-3" aria-hidden /> Final
        </span>
      ) : (
        <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full border border-border px-2 py-0.5 text-muted-foreground">
          Draft
        </span>
      )}
    </span>
  );
}
