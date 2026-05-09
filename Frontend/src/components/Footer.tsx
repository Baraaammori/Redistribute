import React from 'react';
import { Link } from 'react-router-dom';

const COLS = [
  { title: 'Product', links: [['/', 'Home'], ['/pricing', 'Pricing'], ['/dashboard', 'Dashboard']] },
  { title: 'Company', links: [['/about', 'About'], ['/contact', 'Contact']] },
  { title: 'Legal',   links: [['/privacy', 'Privacy'], ['/terms', 'Terms']] },
];

export default function Footer() {
  return (
    <footer style={{ background: '#0C0B09', color: '#F0EFF8' }}>
      <div className="max-w-6xl mx-auto" style={{ padding: '56px 56px 40px' }}>
        <div className="grid gap-12" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
          {/* Brand */}
          <div>
            <div className="font-display font-extrabold mb-3" style={{ fontSize: 17, letterSpacing: '-0.03em', color: '#F0EFF8' }}>
              Redistribute
            </div>
            <p className="font-sans m-0" style={{ fontSize: 13, color: 'rgba(240,239,248,0.50)', lineHeight: 1.65, maxWidth: 260 }}>
              Post once. Everywhere. Cross-platform video distribution for creators.
            </p>
          </div>
          {/* Link columns */}
          {COLS.map(col => (
            <div key={col.title}>
              <div className="font-sans font-semibold uppercase mb-4" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'rgba(240,239,248,0.25)' }}>
                {col.title}
              </div>
              <div className="flex flex-col gap-2.5">
                {col.links.map(([to, label]) => (
                  <Link
                    key={to}
                    to={to}
                    className="font-sans transition-colors"
                    style={{ fontSize: 13, color: 'rgba(240,239,248,0.50)', textDecoration: 'none' }}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="font-sans" style={{ fontSize: 12, color: 'rgba(240,239,248,0.25)' }}>
            © {new Date().getFullYear()} Redistribute.io
          </span>
          <span className="font-mono" style={{ fontSize: 11, color: 'rgba(240,239,248,0.18)' }}>
            Built for creators
          </span>
        </div>
      </div>
    </footer>
  );
}
