import { ClipboardCheck, FileSearch, Send, ShieldCheck, Hammer, CheckCircle2, AlertOctagon, Info } from "lucide-react";
import { ST } from "./data";
import type { StatusKey } from "./types";

const ICON: Record<StatusKey, typeof Info> = {
  in_audit: FileSearch,
  audit_complete: ClipboardCheck,
  submitted: Send,
  in_principle_approval: ShieldCheck,
  implementation_ongoing: Hammer,
  implemented: CheckCircle2,
  stalled: AlertOctagon,
};

const DESC: Record<StatusKey, string> = {
  in_audit: "Team is currently auditing this site and collecting evidence.",
  audit_complete: "Audit is finished; report is being prepared.",
  submitted: "Report submitted to the responsible authority for review.",
  in_principle_approval: "Authority has approved the proposed intervention.",
  implementation_ongoing: "Civil work or remediation is actively in progress.",
  implemented: "Fix is completed and verified on the ground.",
  stalled: "No response from authority — escalation required.",
};

export function StatusLegend({ compact = false }: { compact?: boolean }) {
  const keys = Object.keys(ST) as StatusKey[];
  return (
    <div
      className="rounded-lg border border-[#e5e7eb] bg-white p-3"
      role="region"
      aria-label="Status legend"
    >
      <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
        <Info size={12} strokeWidth={2} /> Status legend
      </div>
      <ul className={compact ? "grid grid-cols-2 gap-1.5" : "space-y-1.5"}>
        {keys.map((k) => {
          const s = ST[k];
          const Icon = ICON[k] ?? Info;
          return (
            <li
              key={k}
              className="flex items-start gap-2 text-[11.5px]"
              title={DESC[k]}
            >
              <span
                aria-hidden
                className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                style={{ background: s.bg, color: s.c, border: `1px solid ${s.c}40` }}
              >
                <Icon size={10} strokeWidth={2.25} />
              </span>
              <span className="leading-snug">
                <span className="font-medium" style={{ color: s.c }}>{s.l}</span>
                {!compact && (
                  <span className="block text-[#6B7280]">{DESC[k]}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { DESC as STATUS_DESCRIPTIONS };
