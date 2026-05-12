import { useState } from "react";
import type { Location } from "./types";
import { RC, RL } from "./data";

interface Props {
  loc: Location | null;
  onClose: () => void;
}

export function ReportModal({ loc, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [emailErr, setEmailErr] = useState(false);
  const [desc, setDesc] = useState("");
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [petition, setPetition] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  if (!loc) return null;

  function reset() {
    setEmail("");
    setEmailErr(false);
    setDesc("");
    setPhotoName(null);
    setPetition(true);
    setSubmitted(false);
  }
  function close() {
    reset();
    onClose();
  }

  function submit() {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setEmailErr(true);
      return;
    }
    const today = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const sub = encodeURIComponent(
      `[Project Rakshak] Community Report — ${loc!.n}, ${loc!.ci}`
    );
    const body = encodeURIComponent(
      `Community Issue Report — Project Rakshak Platform\n\nDate: ${today}\nReporter: ${trimmed}\nLocation: ${loc!.n}, ${loc!.ci}, ${loc!.st}\nRisk Level: ${RL[loc!.risk]}\n\nExperience / Incident:\n${desc.trim() || "(No description provided)"}\n\nSign Petition: ${petition ? "YES" : "No"}\n\n---\nCrashfree India | info@crashfreeindia.org`
    );
    window.open(`mailto:info@crashfreeindia.org?subject=${sub}&body=${body}`, "_blank");
    setSubmitted(true);
  }

  return (
    <div className="overlay open" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="modal report-modal">
        <div className="m-head">
          <div className="m-title">Report a Road Hazard</div>
          <button className="m-x" onClick={close}>×</button>
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
                    ✅ You've signed the community petition for <strong>{loc.n}</strong>. We'll notify progress at <strong>{email.trim()}</strong>.
                  </>
                )}
                <br /><br />
                Together we can make India's roads safer.
              </div>
            </div>
          ) : (
            <>
              <div className="report-loc">
                <span className="rl-dot" style={{ background: RC[loc.risk] }} />
                <div>
                  <div className="rl-name">{loc.n}</div>
                  <div className="rl-city">{loc.ci}, {loc.st} · {RL[loc.risk]}</div>
                </div>
              </div>
              <p style={{ fontSize: 11, color: "var(--text2)", marginBottom: 11, lineHeight: 1.5 }}>
                Have you witnessed or been affected by a road safety issue here? Report it and optionally sign the community petition demanding action.
              </p>
              <div className="f-field">
                <label className="f-lbl">
                  Your Email <span className="f-req">*</span>
                </label>
                <input
                  className={"f-inp" + (emailErr ? " err" : "")}
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr(false); }}
                />
              </div>
              <div className="f-field">
                <label className="f-lbl">
                  What did you experience?{" "}
                  <span style={{ fontSize: 10, color: "var(--text3)", fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  className="f-ta"
                  placeholder="Describe the incident or road safety issue you witnessed at this location…"
                  maxLength={400}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
                <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 3, textAlign: "right" }}>
                  {desc.length}/400
                </div>
              </div>
              <div className="f-field">
                <label className="f-lbl">
                  Add a photo{" "}
                  <span style={{ fontSize: 10, color: "var(--text3)", fontWeight: 400 }}>(optional)</span>
                </label>
                <label className="f-file-wrap" htmlFor="rPhoto">
                  <div className="f-file-lbl">📷 Tap to upload photo</div>
                  <div className="f-file-sub">{photoName ? `✓ ${photoName}` : "JPG or PNG · max 5MB"}</div>
                </label>
                <input
                  className="f-file-inp"
                  type="file"
                  id="rPhoto"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && setPhotoName(e.target.files[0].name)}
                />
              </div>
              <div className="check-row">
                <input
                  className="c-inp"
                  type="checkbox"
                  id="rPetition"
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
            <button className="btn-p" onClick={close}>Close</button>
          ) : (
            <>
              <button className="btn-p" onClick={submit}>Submit Report</button>
              <button className="btn-o" onClick={close}>Cancel</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
