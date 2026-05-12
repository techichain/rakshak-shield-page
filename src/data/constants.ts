import type { Risk, StatusKey, AuthKey } from '@/types/rakshak';

export const RISK_COLORS: Record<Risk, string> = {
  high: '#C8201A',
  medium: '#C45D0A',
  low: '#1A6E3A',
};

export const RISK_LABELS: Record<Risk, string> = {
  high: 'High Risk',
  medium: 'Medium Risk',
  low: 'Lower Risk',
};

export interface StatusInfo {
  l: string;
  c: string;
  bg: string;
  i: string;
  s: number;
}

export const STATUS: Record<StatusKey, StatusInfo> = {
  in_audit: { l: 'In Audit', c: '#9333EA', bg: '#F5F3FF', i: '🔍', s: 1 },
  audit_complete: { l: 'Audited', c: '#6B7280', bg: '#F3F4F6', i: '✓', s: 2 },
  submitted: { l: 'Report Submitted', c: '#2563EB', bg: '#EFF6FF', i: '📤', s: 3 },
  in_principle_approval: { l: 'Approved', c: '#7C3AED', bg: '#F5F3FF', i: '✅', s: 4 },
  implementation_ongoing: { l: 'In Progress', c: '#D97706', bg: '#FFFBEB', i: '🔨', s: 5 },
  implemented: { l: 'Implemented', c: '#059669', bg: '#ECFDF5', i: '🎉', s: 6 },
  stalled: { l: 'Stalled', c: '#DC2626', bg: '#FEF2F2', i: '⚠️', s: -1 },
};

export const PROGRESS_STEPS: { k: StatusKey; l: string }[] = [
  { k: 'in_audit', l: 'In Audit' },
  { k: 'audit_complete', l: 'Audited' },
  { k: 'submitted', l: 'Submitted' },
  { k: 'in_principle_approval', l: 'Approved' },
  { k: 'implementation_ongoing', l: 'In Progress' },
  { k: 'implemented', l: 'Implemented' },
];

export const AUTH_CATS: { k: AuthKey; l: string; d: string }[] = [
  { k: 'nhai', l: 'NHAI', d: 'National Highway Authority' },
  { k: 'state_pwd', l: 'State PWD', d: 'Public Works Dept' },
  { k: 'municipal', l: 'Municipal Corp', d: 'Urban Local Body' },
  { k: 'dev_auth', l: 'Dev. Authority', d: 'Special Authority' },
];

export const STATE_BOUNDS: Record<string, [[number, number], [number, number]]> = {
  Kerala: [[8.07, 74.85], [12.78, 77.42]],
  'Madhya Pradesh': [[21.08, 74.03], [26.87, 82.82]],
  Assam: [[24.11, 89.72], [27.98, 96.02]],
  'Uttar Pradesh': [[23.87, 77.08], [30.42, 84.64]],
  Delhi: [[28.4, 76.84], [28.88, 77.35]],
  Uttarakhand: [[28.44, 77.57], [31.45, 81.03]],
  Maharashtra: [[15.61, 72.66], [22.03, 80.9]],
  'Andhra Pradesh': [[12.62, 76.76], [19.9, 84.76]],
  'Arunachal Pradesh': [[26.65, 91.5], [29.45, 97.41]],
  'Tamil Nadu': [[8.07, 76.23], [13.57, 80.36]],
  'West Bengal': [[21.44, 85.82], [27.22, 89.89]],
  Gujarat: [[20.11, 68.1], [24.71, 74.46]],
  Punjab: [[29.54, 73.88], [32.5, 76.91]],
};

export const GEO_NAME_MAP: Record<string, string> = {
  'NCT of Delhi': 'Delhi',
  Uttaranchal: 'Uttarakhand',
};

export function getAuthShort(authStr?: string): string {
  if (!authStr) return 'Authority';
  if (authStr.includes('NHAI')) return 'NHAI';
  const m = authStr.match(/\(([A-Z]{2,6})\)/);
  if (m) return m[1];
  const s = authStr.split(',')[0].split('(')[0].trim();
  return s.length > 24 ? s.substring(0, 24) + '…' : s;
}
