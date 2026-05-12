import { UNIVERSITIES } from '@/data/universities';

export function Footer() {
  return (
    <div className="footer">
      <div className="footer-top">
        <div className="footer-copy">
          © 2025 Crashfree India · Vision Zero Trust · info@crashfreeindia.org
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            justifyContent: 'flex-end',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          <span className="footer-partners-label">Academic Partners</span>
          <div className="footer-logos">
            {UNIVERSITIES.map((u, i) => (
              <div className="uni-item" key={i} title={u.n}>
                {u.url ? (
                  <img className="uni-logo" src={u.url} alt={u.n} />
                ) : (
                  <div className="uni-badge">
                    {u.abbr ||
                      u.n
                        .split(' ')
                        .map((w) => w[0])
                        .join('')
                        .slice(0, 4)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
