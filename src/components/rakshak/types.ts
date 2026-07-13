export type Risk = "high" | "medium" | "low";
export type StatusKey =
  | "in_audit"
  | "audit_complete"
  | "submitted"
  | "in_principle_approval"
  | "implementation_ongoing"
  | "implemented"
  | "stalled";

export interface Solution { i: string; c: string }
export interface Authority { n: string; r: string; p?: boolean }

export interface Location {
  id: number;
  n: string;       // name
  ci: string;      // city
  st: string;      // state
  lat: number;
  lng: number;
  risk: Risk;
  auth: string;    // category key
  type: string;
  status: StatusKey;
  crash: string;
  findings: string[];
  sols: Solution[];
  impact: string;
  auths: Authority[];
  why: string;
  team: string;
  pto: string;
  pmail: string;
}

export interface StatusMeta {
  l: string; c: string; bg: string; i: string; s: number;
}

export interface FiltersState {
  auth: string;
  status: string;
  state: string;
  search: string;
}
