import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  const cols = [
    { title: "Product",  links: [["/", "Home"], ["/pricing", "Pricing"], ["/shopping", "Shop"]] },
    { title: "Company",  links: [["/about", "About"], ["/contact", "Contact"], ["/about", "Blog"]] },
    { title: "Legal",    links: [["/privacy", "Privacy"], ["/terms", "Terms"], ["/", "Security"]] },
  ];
  return (
    <footer style={{ background: "#0A0A0F", color: "white", padding: "64px 48px 32px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48, maxWidth: 1100, margin: "0 auto 40px" }}>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 17, fontWeight: 800, background: "linear-gradient(135deg,#9B7EFF,#1FCFA0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 10 }}>Redistribute</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontWeight: 300, lineHeight: 1.65, maxWidth: 220 }}>The simplest way to cross-post your videos across every platform.</div>
        </div>
        {cols.map(col => (
          <div key={col.title}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "rgba(255,255,255,0.25)", marginBottom: 14, fontFamily: "'Syne',sans-serif" }}>{col.title}</div>
            {col.links.map(([to, label]) => (
              <Link key={label} to={to} style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 300, textDecoration: "none", padding: "4px 0", transition: "color 0.14s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "white")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}>
                {label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 24, display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.2)", fontWeight: 300 }}>
        <span>© 2025 Baraa Ammori · Redistribute.io</span>
        <span>Built with React · Node.js · Supabase · Stripe</span>
      </div>
    </footer>
  );
}
