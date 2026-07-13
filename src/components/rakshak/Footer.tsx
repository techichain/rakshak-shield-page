import { UNIS, uniLogoUrl } from "./data";

export function Footer() {
  return (
    <div className="footer">
      <div className="footer-top">
        <div className="footer-copy">
          © 2025 Crashfree India · Vision Zero Trust · info@crashfreeindia.org
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            justifyContent: "flex-end",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <span className="footer-partners-label">Academic Partners</span>
          <div className="footer-logos">
            {UNIS.map((u) => {
              const url = u.file ? uniLogoUrl(u.file) : undefined;
              return (
                <div key={u.name} className="uni-item" title={u.name}>
                  {url ? (
                    <img className="uni-logo" src={url} alt={u.name} />
                  ) : (
                    <div className="uni-badge">
                      {u.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 4)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
