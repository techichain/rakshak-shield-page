import { LOGO_DATA_URI } from "@/data/logo";

interface Props {
  onReport: () => void;
  onPetition: () => void;
}

export function Nav({ onReport, onPetition }: Props) {
  return (
    <nav className="nav">
      <div className="nav-left">
        <img
          className="nav-logo-img"
          src={LOGO_DATA_URI}
          alt="Crashfree India"
          title="Crashfree India — A Cars24 Commitment"
        />
      </div>
      <div className="nav-center">
        <div className="nav-title">Project Rakshak</div>
        <div className="nav-tagline">
          Documenting risks · Demanding accountability · Saving lives
        </div>
      </div>
      <div className="nav-right">
        <a
          className="nav-btn nav-btn-outline"
          href="/rakshak-platform/impact"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6, verticalAlign: "-2px" }}>
            <path d="M18 20V10M12 20V4M6 20v-6"/>
          </svg>
          Impact
        </a>
        <button className="nav-btn nav-btn-outline" onClick={onReport}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6, verticalAlign: "-2px" }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/>
          </svg>
          Report a Road Hazard
        </button>
        <button className="nav-btn nav-btn-primary" onClick={onPetition}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6, verticalAlign: "-2px" }}>
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          Sign a Petition
        </button>
        <a
          className="nav-btn nav-btn-primary"
          href="/rakshak-platform/auth"
          style={{ background: "#4A35FF", color: "#fff" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6, verticalAlign: "-2px" }}>
            <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3"/>
          </svg>
          Portal Sign In
        </a>
      </div>
    </nav>
  );
}
