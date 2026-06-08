import { BarChart3, AlertTriangle, PenLine, LogIn } from "lucide-react";
import { LOGO_DATA_URI } from "@/data/logo";

interface Props {
  onReport: () => void;
  onPetition: () => void;
}

const ICON_PROPS = { size: 14, strokeWidth: 2.25, style: { marginRight: 6, verticalAlign: -2 } } as const;

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
          aria-label="View Project Rakshak impact dashboard"
          title="View impact metrics"
        >
          <BarChart3 {...ICON_PROPS} aria-hidden />
          Impact
        </a>
        <button
          type="button"
          className="nav-btn nav-btn-outline"
          onClick={onReport}
          aria-label="Report a road hazard"
          title="Report a road hazard"
        >
          <AlertTriangle {...ICON_PROPS} aria-hidden />
          Report a Road Hazard
        </button>
        <button
          type="button"
          className="nav-btn nav-btn-primary"
          onClick={onPetition}
          aria-label="Sign a petition"
          title="Sign a petition"
        >
          <PenLine {...ICON_PROPS} aria-hidden />
          Sign a Petition
        </button>
        <a
          className="nav-btn nav-btn-primary"
          href="/rakshak-platform/auth"
          aria-label="Sign in to the Rakshak portal"
          title="Portal sign in"
          style={{ background: "#4A35FF", color: "#fff" }}
        >
          <LogIn {...ICON_PROPS} aria-hidden />
          Portal Sign In
        </a>
      </div>
    </nav>
  );
}
