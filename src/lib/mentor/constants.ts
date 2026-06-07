// Project Rakshak Mentor Portal — shared constants

export const TRACKS = {
  mentor: { label: "Mentor", slug: "mentor" },
  auditor: { label: "Road Safety Auditor", slug: "auditor" },
  ngo_partner: { label: "NGO Partner", slug: "ngo_partner" },
  student_team: { label: "Student Team", slug: "student_team" },
} as const;

export type TrackKey = keyof typeof TRACKS;

export const APPLICATION_STATUSES = [
  "submitted",
  "under_review",
  "shortlisted",
  "interview",
  "selected",
  "rejected",
  "withdrawn",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_META: Record<
  ApplicationStatus,
  { label: string; bg: string; fg: string; ring: string }
> = {
  submitted:    { label: "Submitted",    bg: "bg-blue-50",    fg: "text-blue-700",    ring: "ring-blue-200" },
  under_review: { label: "Under Review", bg: "bg-slate-100",  fg: "text-slate-700",   ring: "ring-slate-300" },
  shortlisted:  { label: "Shortlisted",  bg: "bg-indigo-50",  fg: "text-indigo-700",  ring: "ring-indigo-200" },
  interview:    { label: "Interview",    bg: "bg-orange-50",  fg: "text-orange-700",  ring: "ring-orange-200" },
  selected:     { label: "Selected",     bg: "bg-emerald-50", fg: "text-emerald-700", ring: "ring-emerald-200" },
  rejected:     { label: "Rejected",     bg: "bg-red-50",     fg: "text-red-700",     ring: "ring-red-200" },
  withdrawn:    { label: "Withdrawn",    bg: "bg-zinc-100",   fg: "text-zinc-600",    ring: "ring-zinc-200" },
};

// Crashfree India brand tokens
export const BRAND = {
  primary: "#4A35FF",
  alert: "#F10015",
  warn: "#F57C00",
  success: "#00AA44",
  muted: "#777589",
  ink: "#1A1C1C",
  surface: "#EDEEF2",
  primarySoft: "#F3F1FF",
} as const;

// Public document URLs — served from Cloud storage (public-docs bucket)
// so they remain accessible on both preview (auth-gated) and published sites.
// Served from our own origin via /api/docs/* so ad-blockers and corporate
// filters that block "*.supabase.co" (ERR_BLOCKED_BY_CLIENT) don't break
// downloads. The route proxies the file from Cloud storage and sets
// Content-Disposition: attachment so the browser triggers a direct download.
export const DOCUMENTS = {
  mentorJD: "/api/docs/mentor-jd.pdf",
  mentorAssignment: "/api/docs/mentor-assignment.pdf",
} as const;

export const EXPERTISE_DOMAINS = [
  "Urban Planning",
  "Transportation Engineering",
  "Road Safety / Crash Investigation",
  "Public Policy",
  "Civil Engineering",
  "Behavioural Science / Human Factors",
  "Academia / Research",
  "Consulting",
  "Other",
] as const;
