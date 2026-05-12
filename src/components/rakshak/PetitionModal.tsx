import { useMemo, useState } from "react";
import type { Location } from "./types";
import { getAuthShort } from "./data";

interface Props {
  loc: Location | null;
  onClose: () => void;
}

function buildLetter(loc: Location) {
  const today = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const drscEmail = loc.pmail || "[drsc-email@nic.in]";
  const ccParts = loc.auths.filter((a) => !a.p).map((a) => a.n);
  return `Date: ${today}

To,
${loc.pto}

Subject: Road Safety Petition — ${loc.n}, ${loc.ci}

Respected Sir/Madam,

This is a formal petition regarding a critical road safety concern at ${loc.n}, ${loc.ci}, ${loc.st}, identified under Project Rakshak, a large-scale youth-led road safety infrastructure audit by Crashfree India with academic oversight from IIT Delhi and IIT Kharagpur.

KEY PROBLEMS IDENTIFIED:
${loc.findings.map((f, i) => `  ${i + 1}. ${f}`).join("\n")}

RECOMMENDED INTERVENTIONS:
${loc.sols.map((s, i) => `  ${i + 1}. ${s.i}`).join("\n")}

ESTIMATED IMPACT: ${loc.impact}

We respectfully request your office to:
  1. Acknowledge this petition and assign a nodal officer
  2. Commission a site inspection within 30 days
  3. Include recommended interventions in the next budget cycle
  4. Provide a written response with a proposed implementation timeline

Under the Motor Vehicles (Amendment) Act 2019, Section 215B, the District Road Safety Committee is mandated to act on identified crash-prone locations.

Yours faithfully,
[Your Name]
[Your Address & Contact]

cc: District Road Safety Committee (DRSC), ${loc.ci} — ${drscEmail}
${ccParts.map((c) => `    ${c}`).join("\n")}
    Crashfree India | info@crashfreeindia.org`;
}

export function PetitionModal({ loc, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const letter = useMemo(() => (loc ? buildLetter(loc) : ""), [loc]);

  if (!loc) return null;
  const primary = loc.auths.find((a) => a.p);
  const authShort = primary ? getAuthShort(primary.n) : "Authority";

  function copy() {
    navigator.clipboard.writeText(letter).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }
  function download() {
    const blob = new Blob([letter], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Petition_${loc!.n.replace(/[^a-zA-Z0-9]/g, "_")}_${loc!.ci}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function email() {
    const sub = encodeURIComponent(`Road Safety Petition — ${loc!.n}, ${loc!.ci}`);
    const body = encodeURIComponent(letter);
    window.open(`mailto:${loc!.pmail}?subject=${sub}&body=${body}`, "_blank");
  }

  return (
    <div className="overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="m-head">
          <div className="m-title">Write to {authShort}</div>
          <button className="m-x" onClick={onClose}>×</button>
        </div>
        <div className="m-body">
          <div className="m-to">Addressed to: <strong>{loc.pto}</strong></div>
          <div className="m-to" style={{ marginTop: 3 }}>
            Re: <strong>Road Safety Petition — {loc.n}, {loc.ci}</strong>
          </div>
          <div className="letter">{letter}</div>
        </div>
        <div className="m-foot">
          <button className="btn-p" onClick={copy}>Copy Letter</button>
          <button className="btn-o" onClick={email}>Send via Email ↗</button>
          <button className="btn-o" onClick={download}>Download .txt</button>
          <span className={"copied" + (copied ? " show" : "")}>Copied ✓</span>
        </div>
      </div>
    </div>
  );
}
