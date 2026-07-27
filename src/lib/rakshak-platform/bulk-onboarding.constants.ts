/**
 * Bulk onboarding — CSV templates and shared column definitions.
 * Used by both the admin upload UI and the server-side validator so the
 * preview always reflects exactly what the creation run will do.
 */

export type BulkKind = "teams" | "mentors" | "evaluators";

export const BULK_KINDS: Array<{ id: BulkKind; label: string; blurb: string }> = [
  { id: "teams", label: "Teams", blurb: "Team, its leader and members — one row per person." },
  { id: "mentors", label: "Mentors", blurb: "One row per mentor." },
  { id: "evaluators", label: "Evaluators", blurb: "One row per evaluator." },
];

export const BULK_COLUMNS: Record<BulkKind, string[]> = {
  teams: [
    "team_name",
    "cohort_name",
    "college",
    "city",
    "state",
    "role",
    "full_name",
    "email",
    "phone",
  ],
  mentors: ["full_name", "email", "phone"],
  evaluators: ["full_name", "email", "phone"],
};

/** Columns that must be non-empty on every row. */
export const BULK_REQUIRED_COLUMNS: Record<BulkKind, string[]> = {
  teams: ["team_name", "cohort_name", "role", "full_name", "email"],
  mentors: ["full_name", "email"],
  evaluators: ["full_name", "email"],
};

/** Team-level fields that must be identical across every row of a team. */
export const TEAM_LEVEL_COLUMNS = ["cohort_name", "college", "city", "state"] as const;

const TEAMS_TEMPLATE = `team_name,cohort_name,college,city,state,role,full_name,email,phone
Rakshak Team Alpha,Rakshak Cohort 2026,IIT Delhi,New Delhi,Delhi,leader,Asha Verma,asha.verma@example.com,9876543210
Rakshak Team Alpha,Rakshak Cohort 2026,IIT Delhi,New Delhi,Delhi,member,Rohit Nair,rohit.nair@example.com,9876543211
`;

const MENTORS_TEMPLATE = `full_name,email,phone
Dr. Meera Iyer,meera.iyer@example.com,9876543212
`;

const EVALUATORS_TEMPLATE = `full_name,email,phone
Sanjay Kulkarni,sanjay.kulkarni@example.com,9876543213
`;

export const BULK_TEMPLATES: Record<BulkKind, string> = {
  teams: TEAMS_TEMPLATE,
  mentors: MENTORS_TEMPLATE,
  evaluators: EVALUATORS_TEMPLATE,
};

/** CSV text for the given kind (used by the template download button). */
export function getBulkTemplateCsv(kind: BulkKind): string {
  return BULK_TEMPLATES[kind];
}

/** Suggested filename for the downloaded template. */
export function getBulkTemplateFilename(kind: BulkKind): string {
  return `rakshak-bulk-${kind}-template.csv`;
}
