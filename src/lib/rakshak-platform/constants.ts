export type RPRole =
  | "super_admin"
  | "cfi_admin"
  | "team_leader"
  | "team_member"
  | "mentor"
  | "evaluator"
  | "authority"
  | "finance"
  | "leadership_viewer";

export type PhaseStatus =
  | "not_started"
  | "draft"
  | "submitted"
  | "under_mentor_review"
  | "changes_requested"
  | "resubmitted"
  | "mentor_approved"
  | "under_admin_review"
  | "admin_approved"
  | "rejected"
  | "completed";

export type TeamStatus =
  | "pending_approval"
  | "approved"
  | "active"
  | "delayed"
  | "at_risk"
  | "completed"
  | "dropped"
  | "disqualified"
  | "archived";

export type RiskStatus = "on_track" | "attention" | "at_risk";
export type Severity = "low" | "medium" | "high" | "critical";

export const PHASE_TITLES: Record<number, string> = {
  0: "Problem Identification",
  1: "Research & Evidence",
  2: "Survey & Road Safety Audit",
  3: "Case Study & Draft Solution",
  4: "Final Report & Authority Pitch",
};

export const STATUS_META: Record<PhaseStatus, { label: string; tone: string }> = {
  not_started:         { label: "Not started",        tone: "bg-muted text-muted-foreground border-border" },
  draft:               { label: "Draft",              tone: "bg-muted text-muted-foreground border-border" },
  submitted:           { label: "Submitted",          tone: "bg-brand-lite text-brand border-brand/25" },
  under_mentor_review: { label: "Mentor reviewing",   tone: "bg-brand-lite text-brand border-brand/25" },
  changes_requested:   { label: "Changes requested",  tone: "bg-orange-50 text-orange-700 border-orange-200" },
  resubmitted:         { label: "Resubmitted",        tone: "bg-brand-lite text-brand border-brand/25" },
  mentor_approved:     { label: "Mentor approved",    tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  under_admin_review:  { label: "Admin reviewing",    tone: "bg-amber-50 text-amber-700 border-amber-200" },
  admin_approved:      { label: "Admin approved",     tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected:            { label: "Rejected",           tone: "bg-red-50 text-red-700 border-red-200" },
  completed:           { label: "Completed",          tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export const TEAM_STATUS_META: Record<TeamStatus, { label: string; tone: string }> = {
  pending_approval: { label: "Pending approval", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  approved:         { label: "Approved",         tone: "bg-brand-lite text-brand border-brand/25" },
  active:           { label: "Active",           tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  delayed:          { label: "Delayed",          tone: "bg-orange-50 text-orange-700 border-orange-200" },
  at_risk:          { label: "At risk",          tone: "bg-red-50 text-red-700 border-red-200" },
  completed:        { label: "Completed",        tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  dropped:          { label: "Dropped",          tone: "bg-muted text-muted-foreground border-border" },
  disqualified:     { label: "Disqualified",     tone: "bg-red-50 text-red-700 border-red-200" },
  archived:         { label: "Archived",         tone: "bg-muted text-muted-foreground border-border" },
};

export const RISK_META: Record<RiskStatus, { label: string; tone: string; dot: string }> = {
  on_track:  { label: "On track",  tone: "text-emerald-700",       dot: "bg-emerald-500" },
  attention: { label: "Attention", tone: "text-amber-700",         dot: "bg-amber-500" },
  at_risk:   { label: "At risk",   tone: "text-red-700",           dot: "bg-red-500" },
};

export const RUBRIC_CATEGORIES = [
  "Problem clarity",
  "Evidence quality",
  "Road safety relevance",
  "Community survey quality",
  "Feasibility of solution",
  "Authority readiness",
  "Report quality",
  "Innovation",
] as const;
