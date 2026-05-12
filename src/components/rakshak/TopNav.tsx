import { useRakshakStore } from '@/store/rakshakStore';
import logo from '/rakshak-logo.png?url';

export function TopNav() {
  const openPetition = useRakshakStore((s) => s.openPetition);
  const openReport = useRakshakStore((s) => s.openReport);
  const activeId = useRakshakStore((s) => s.activeId);
  return (
    <nav className="nav">
      <div className="nav-left">
        <img className="nav-logo-img" src={logo} alt="Crashfree India" />
      </div>
      <div className="nav-center">
        <div className="nav-title">Project Rakshak</div>
        <div className="nav-tagline">Crashfree India · Road Safety Audit Platform</div>
      </div>
      <div className="nav-right">
        <button className="nav-btn nav-btn-outline" onClick={() => openReport(activeId ?? 1)}>
          ⚠️ Report Issue
        </button>
        <button className="nav-btn nav-btn-primary" onClick={() => openPetition()}>
          ✊ Sign Petition
        </button>
      </div>
    </nav>
  );
}
