import { useMemo, useState } from 'react';
import { LOCATIONS } from '@/data/locations';
import { useRakshakStore } from '@/store/rakshakStore';
import { getAuthShort } from '@/data/constants';

export function PetitionModal() {
  const open = useRakshakStore((s) => s.petitionOpen);
  const close = useRakshakStore((s) => s.closePetition);
  const activeId = useRakshakStore((s) => s.activeId);
  const [copied, setCopied] = useState(false);
  const loc = activeId ? LOCATIONS.find((l) => l.id === activeId) : LOCATIONS[0];

  const { letter, authShort, subject } = useMemo(() => {
    if (!loc) return { letter: '', authShort: '', subject: '' };
    const p = loc.auths.find((a) => a.p);
    const authShort = p ? getAuthShort(p.n) : 'Authority';
    const today = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const drscEmail = loc.pmail || '[drsc-email@nic.in]';
    const ccParts = loc.auths.filter((a) => !a.p).map((a) => a.n);
    const subject = `Road Safety Petition — ${loc.n}, ${loc.ci}`;
    const letter = `Date: ${today}

To,
${loc.pto}

Subject: ${subject}

Respected Sir/Madam,

This is a formal petition regarding a critical road safety concern at ${loc.n}, ${loc.ci}, ${loc.st}, identified under Project Rakshak, a large-scale youth-led road safety infrastructure audit by Crashfree India with academic oversight from IIT Delhi and IIT Kharagpur.

KEY PROBLEMS IDENTIFIED:
${loc.findings.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}

RECOMMENDED INTERVENTIONS:
${loc.sols.map((s, i) => `  ${i + 1}. ${s.i}`).join('\n')}

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
${ccParts.map((c) => `    ${c}`).join('\n')}
    Crashfree India | info@crashfreeindia.org`;
    return { letter, authShort, subject };
  }, [loc]);

  if (!loc) return null;

  const copy = () => {
    navigator.clipboard.writeText(letter).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };
  const email = () => {
    window.open(
      `mailto:${loc.pmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(letter)}`,
      '_blank'
    );
  };
  const download = () => {
    const blob = new Blob([letter], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Petition_${loc.n.replace(/[^a-zA-Z0-9]/g, '_')}_${loc.ci}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className={`overlay${open ? ' open' : ''}`} onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="modal">
        <div className="m-head">
          <div className="m-title">Write to {authShort}</div>
          <button className="m-x" onClick={close}>×</button>
        </div>
        <div className="m-body">
          <div className="m-to">Addressed to: <strong>{loc.pto}</strong></div>
          <div className="m-to" style={{ marginTop: 3 }}>Re: <strong>{subject}</strong></div>
          <div className="letter">{letter}</div>
        </div>
        <div className="m-foot">
          <button className="btn-p" onClick={copy}>Copy Letter</button>
          <button className="btn-o" onClick={email}>Send via Email ↗</button>
          <button className="btn-o" onClick={download}>Download .txt</button>
          <span className={`copied${copied ? ' show' : ''}`}>Copied ✓</span>
        </div>
      </div>
    </div>
  );
}
