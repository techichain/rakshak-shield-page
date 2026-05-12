import { useState } from 'react';
import { LOCATIONS } from '@/data/locations';
import { useRakshakStore } from '@/store/rakshakStore';
import { RISK_COLORS, RISK_LABELS } from '@/data/constants';

export function ReportModal() {
  const open = useRakshakStore((s) => s.reportOpen);
  const close = useRakshakStore((s) => s.closeReport);
  const locId = useRakshakStore((s) => s.reportLocId);
  const loc = locId ? LOCATIONS.find((l) => l.id === locId) : null;

  const [email, setEmail] = useState('');
  const [desc, setDesc] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [petition, setPetition] = useState(true);
  const [emailErr, setEmailErr] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleClose = () => {
    setEmail(''); setDesc(''); setPhotoName(''); setPetition(true);
    setEmailErr(false); setSubmitted(false);
    close();
  };

  const submit = () => {
    if (!email.includes('@')) { setEmailErr(true); return; }
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const sub = `[Project Rakshak] Community Report — ${loc ? `${loc.n}, ${loc.ci}` : 'Location Report'}`;
    const body = `Community Issue Report — Project Rakshak Platform

Date: ${today}
Reporter: ${email}
Location: ${loc ? `${loc.n}, ${loc.ci}, ${loc.st}` : '—'}
Risk Level: ${loc ? RISK_LABELS[loc.risk] : ''}

Experience / Incident:
${desc || '(No description provided)'}

Sign Petition: ${petition ? 'YES' : 'No'}

---
Crashfree India | info@crashfreeindia.org`;
    window.open(`mailto:info@crashfreeindia.org?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`, '_blank');
    setSubmitted(true);
  };

  if (!loc) return null;

  return (
    <div className={`overlay${open ? ' open' : ''}`} onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal report-modal">
        <div className="m-head">
          <div className="m-title">Report a Road Hazard</div>
          <button className="m-x" onClick={handleClose}>×</button>
        </div>
        <div className="m-body">
          {submitted ? (
            <div className="success-state">
              <div className="s-icon">🙏</div>
              <div className="s-title">Thank you for reporting!</div>
              <div className="s-sub">
                Your experience has been shared with the Crashfree India team.
                {petition && (
                  <>
                    <br /><br />
                    ✅ You've signed the community petition for <strong>{loc.n}</strong>. We'll notify progress at <strong>{email}</strong>.
                  </>
                )}
                <br /><br />
                Together we can make India's roads safer.
              </div>
            </div>
          ) : (
            <>
              <div className="report-loc">
                <span className="rl-dot" style={{ background: RISK_COLORS[loc.risk] }} />
                <div>
                  <div className="rl-name">{loc.n}</div>
                  <div className="rl-city">{loc.ci}, {loc.st} · {RISK_LABELS[loc.risk]}</div>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 11, lineHeight: 1.5 }}>
                Have you witnessed or been affected by a road safety issue here? Report it and optionally sign the community petition demanding action.
              </p>
              <div className="f-field">
                <label className="f-lbl">Your Email <span className="f-req">*</span></label>
                <input
                  className={`f-inp${emailErr ? ' err' : ''}`}
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailErr(false); }}
                  placeholder="your@email.com"
                />
              </div>
              <div className="f-field">
                <label className="f-lbl">What did you experience? <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
                <textarea
                  className="f-ta"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Describe the incident or road safety issue you witnessed at this location…"
                  maxLength={400}
                />
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3, textAlign: 'right' }}>
                  {desc.length}/400
                </div>
              </div>
              <div className="f-field">
                <label className="f-lbl">Add a photo <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
                <label className="f-file-wrap" htmlFor="rPhoto">
                  <div className="f-file-lbl">📷 Tap to upload photo</div>
                  <div className="f-file-sub">{photoName ? `✓ ${photoName}` : 'JPG or PNG · max 5MB'}</div>
                </label>
                <input
                  id="rPhoto"
                  className="f-file-inp"
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && setPhotoName(e.target.files[0].name)}
                />
              </div>
              <div className="check-row">
                <input
                  id="rPetition"
                  className="c-inp"
                  type="checkbox"
                  checked={petition}
                  onChange={(e) => setPetition(e.target.checked)}
                />
                <label className="c-lbl" htmlFor="rPetition">
                  ✅ I also want to sign the community petition for this location — demanding action from responsible authorities
                </label>
              </div>
            </>
          )}
        </div>
        <div className="m-foot">
          {submitted ? (
            <button className="btn-p" onClick={handleClose}>Close</button>
          ) : (
            <>
              <button className="btn-p" onClick={submit}>Submit Report</button>
              <button className="btn-o" onClick={handleClose}>Cancel</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
