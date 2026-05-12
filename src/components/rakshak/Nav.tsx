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
        <button className="nav-btn nav-btn-outline" onClick={onReport}>
          ⚠️ Report a Road Hazard
        </button>
        <button className="nav-btn nav-btn-primary" onClick={onPetition}>
          ✍️ Sign a Petition
        </button>
      </div>
    </nav>
  );
}
