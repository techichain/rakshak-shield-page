export type Risk = 'high' | 'medium' | 'low';

export type StatusKey =
  | 'in_audit'
  | 'audit_complete'
  | 'submitted'
  | 'in_principle_approval'
  | 'implementation_ongoing'
  | 'implemented'
  | 'stalled';

export type AuthKey = 'nhai' | 'state_pwd' | 'municipal' | 'dev_auth';

export interface Authority {
  n: string;
  r: string;
  p?: boolean;
}

export interface Solution {
  i: string;
  c: string;
}

export interface Location {
  id: number;
  n: string;
  ci: string;
  st: string;
  lat: number;
  lng: number;
  risk: Risk;
  auth: AuthKey;
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
