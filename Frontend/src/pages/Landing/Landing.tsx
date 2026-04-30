import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import Footer from "../../components/Footer";

// Shared hero image — inline SVG-based diagram (no external file needed)
function HeroDiagram() {
  const dots: [number, number, string][] = [
    [580, 80, "#7C5CFC"],
    [620, 160, "#1FCFA0"],
    [540, 400, "#F0C94A"],
    [650, 320, "#7C5CFC"],
    [600, 450, "#1FCFA0"],
    [660, 220, "#F0C94A"],
    [490, 440, "#7C5CFC"],
    [640, 380, "#1FCFA0"],
  ];

  return (
    <div style={{ width: "100%", height: "100%", background: "#06060B", position: "relative", overflow: "hidden" }}>
      {/* Grid */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.06 }}>
        <defs>
          <pattern id="grid" width="52" height="52" patternUnits="userSpaceOnUse">
            <path d="M 52 0 L 0 0 0 52" fill="none" stroke="white" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      {/* Glow orbs */}
      <div style={{ position: "absolute", top: -80, left: -80, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(100,68,210,0.35) 0%, transparent 70%)" }} />
      <div style={{ position: "absolute", bottom: -60, right: -60, width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(18,195,135,0.3) 0%, transparent 70%)" }} />
      {/* Platform nodes */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }} viewBox="0 0 700 500" preserveAspectRatio="xMidYMid meet">
        {/* Connection lines */}
        {[
          { x1:200, y1:130, x2:360, y2:250, color:"rgba(220,220,220,0.4)" },
          { x1:160, y1:360, x2:360, y2:250, color:"rgba(255,68,68,0.5)" },
          { x1:530, y1:250, x2:360, y2:250, color:"rgba(255,122,61,0.5)" },
        ].map((l,i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color} strokeWidth="1.5" strokeDasharray="8 5"/>
        ))}
        {/* Hub */}
        <circle cx="360" cy="250" r="52" fill="#0C0820" stroke="#7C5CFC" strokeWidth="2"/>
        <circle cx="360" cy="250" r="65" fill="none" stroke="rgba(124,92,252,0.25)" strokeWidth="1"/>
        <circle cx="360" cy="250" r="80" fill="none" stroke="rgba(124,92,252,0.12)" strokeWidth="1"/>
        <text x="360" y="245" textAnchor="middle" fill="#9B7EFF" fontSize="11" fontWeight="700" fontFamily="sans-serif">REDIS-</text>
        <text x="360" y="260" textAnchor="middle" fill="#9B7EFF" fontSize="11" fontWeight="700" fontFamily="sans-serif">TRIBUTE</text>
        {/* TikTok node */}
        <rect x="130" y="100" width="130" height="58" rx="12" fill="#12121A" stroke="rgba(200,200,200,0.5)" strokeWidth="1"/>
        <rect x="143" y="113" width="24" height="15" rx="4" fill="rgba(200,200,200,0.15)" stroke="rgba(200,200,200,0.4)" strokeWidth="1"/>
        <text x="152" y="124" textAnchor="middle" fill="rgba(200,200,200,0.8)" fontSize="8" fontFamily="monospace">TT</text>
        <text x="182" y="129" fill="rgba(200,200,200,0.9)" fontSize="13" fontWeight="600" fontFamily="sans-serif">TikTok</text>
        <text x="143" y="150" fill="rgba(200,200,200,0.35)" fontSize="8" fontFamily="monospace">connected ·</text>
        {/* YouTube node */}
        <rect x="88" y="326" width="130" height="58" rx="12" fill="#1E0808" stroke="rgba(255,68,68,0.5)" strokeWidth="1"/>
        <rect x="101" y="339" width="24" height="15" rx="4" fill="rgba(255,68,68,0.15)" stroke="rgba(255,68,68,0.4)" strokeWidth="1"/>
        <text x="110" y="350" textAnchor="middle" fill="rgba(255,68,68,0.9)" fontSize="8" fontFamily="monospace">YT</text>
        <text x="140" y="355" fill="rgba(255,68,68,0.9)" fontSize="13" fontWeight="600" fontFamily="sans-serif">YouTube</text>
        <text x="101" y="376" fill="rgba(255,68,68,0.35)" fontSize="8" fontFamily="monospace">connected ·</text>
        {/* Instagram node */}
        <rect x="458" y="218" width="136" height="58" rx="12" fill="#1C0C04" stroke="rgba(255,122,61,0.5)" strokeWidth="1"/>
        <rect x="471" y="231" width="24" height="15" rx="4" fill="rgba(255,122,61,0.15)" stroke="rgba(255,122,61,0.4)" strokeWidth="1"/>
        <text x="480" y="242" textAnchor="middle" fill="rgba(255,122,61,0.9)" fontSize="8" fontFamily="monospace">IG</text>
        <text x="510" y="247" fill="rgba(255,122,61,0.9)" fontSize="12" fontWeight="600" fontFamily="sans-serif">Instagram</text>
        <text x="471" y="268" fill="rgba(255,122,61,0.35)" fontSize="8" fontFamily="monospace">connected ·</text>
        {/* Dots */}
        {dots.map(([x, y, c], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill={c} opacity="0.55"/>
        ))}
      </svg>
      {/* Headline text overlay on right */}
    </div>
  );
}

export default function Landing() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }), { threshold: 0.1 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)} }
        .anim-1{opacity:0;animation:fadeUp 0.5s 0.1s ease forwards}
        .anim-2{opacity:0;animation:fadeUp 0.5s 0.2s ease forwards}
        .anim-3{opacity:0;animation:fadeUp 0.5s 0.3s ease forwards}
        .anim-4{opacity:0;animation:fadeUp 0.5s 0.42s ease forwards}
        .reveal{opacity:0;transform:translateY(24px);transition:opacity 0.65s ease,transform 0.65s ease}
        .reveal.visible{opacity:1;transform:translateY(0)}
        .step-card:hover{background:white!important}
        .platform-pill:hover{border-color:rgba(0,0,0,0.22)!important}
      `}</style>

      {/* HERO */}
      <div style={{ minHeight: "100vh", display: "flex", overflow: "hidden" }}>
        {/* Left copy */}
        <div style={{ flex: "0 0 420px", display: "flex", flexDirection: "column", justifyContent: "center", padding: "100px 48px 60px", background: "#F7F6F2" }}>
          <div className="anim-1" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, color: "#6B6960", fontWeight: 300, marginBottom: 22 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#1A7A4A", animation: "blink 2s infinite" }} />
            Cross-platform video distribution
          </div>
          <h1 className="anim-2" style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(44px,5vw,66px)", fontWeight: 800, letterSpacing: -3, lineHeight: 0.95, marginBottom: 20 }}>
            Post Once.<br />Everywhere.
          </h1>
          <p className="anim-3" style={{ fontSize: 16, color: "#6B6960", lineHeight: 1.7, fontWeight: 300, marginBottom: 36 }}>
            Connect TikTok, YouTube, and Instagram. Pick a video. Choose where it goes. We handle the upload automatically.
          </p>
          <div className="anim-4" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link to="/register" style={{ display: "inline-block", padding: "13px 28px", background: "#0E0D0B", color: "white", borderRadius: 12, fontSize: 15, fontWeight: 500, textDecoration: "none", width: "fit-content" }}>
              Connect your accounts →
            </Link>
            <span style={{ fontSize: 12, color: "#A8A69E", fontWeight: 300 }}>Free to start · No credit card required</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(0,0,0,0.07)" }}>
            <span style={{ fontSize: 11, color: "#A8A69E" }}>Works with</span>
            {["▶️","🎵","📸"].map(e => <span key={e} style={{ fontSize: 20, opacity: 0.55 }}>{e}</span>)}
          </div>
        </div>
        {/* Right diagram */}
        <div style={{ flex: 1, minHeight: "100vh" }}><HeroDiagram /></div>
      </div>

      {/* HOW IT WORKS */}
      <div style={{ height: 1, background: "rgba(0,0,0,0.07)", maxWidth: 1100, margin: "0 auto" }} />
      <div className="reveal" style={{ maxWidth: 1100, margin: "0 auto", padding: "96px 48px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#7C5CFC", textTransform: "uppercase", letterSpacing: 3, marginBottom: 14, fontFamily: "'Syne',sans-serif" }}>How it works</div>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(30px,4vw,48px)", fontWeight: 800, letterSpacing: -2, marginBottom: 48, lineHeight: 1.08 }}>Three steps.<br /><span style={{ fontStyle: "italic", fontWeight: 300, fontFamily: "'DM Sans',sans-serif", letterSpacing: -1.5, color: "#6B6960" }}>That's it.</span></h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "rgba(0,0,0,0.07)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 20, overflow: "hidden" }}>
          {[
            { n: "01", t: "Connect", d: "OAuth-link your YouTube, TikTok, and Instagram accounts in under 60 seconds. One-time setup." },
            { n: "02", t: "Choose", d: "Pick any video from any connected account. Select one or multiple destinations with one click." },
            { n: "03", t: "Distribute", d: "We post it immediately or on a schedule. You pick the time — we handle the upload and formatting." },
          ].map(s => (
            <div key={s.n} className="step-card" style={{ background: "#F7F6F2", padding: "36px 28px", transition: "background 0.2s" }}>
              <div style={{ fontSize: 10, color: "#A8A69E", letterSpacing: 1.5, marginBottom: 18 }}>{s.n}</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: -0.5, marginBottom: 10 }}>{s.t}</div>
              <div style={{ fontSize: 14, color: "#6B6960", lineHeight: 1.65, fontWeight: 300 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PLATFORM PAIRS */}
      <div style={{ height: 1, background: "rgba(0,0,0,0.07)", maxWidth: 1100, margin: "0 auto" }} />
      <div className="reveal" style={{ maxWidth: 1100, margin: "0 auto", padding: "96px 48px", textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#7C5CFC", textTransform: "uppercase", letterSpacing: 3, marginBottom: 14, fontFamily: "'Syne',sans-serif" }}>Platforms</div>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(30px,4vw,48px)", fontWeight: 800, letterSpacing: -2, marginBottom: 12 }}>Any direction.<br /><span style={{ fontStyle: "italic", fontWeight: 300, fontFamily: "'DM Sans',sans-serif", color: "#6B6960" }}>Many to many.</span></h2>
        <p style={{ fontSize: 16, color: "#6B6960", lineHeight: 1.65, fontWeight: 300, maxWidth: 460, margin: "0 auto 44px" }}>Post from TikTok to YouTube, YouTube to Instagram, or one video to all three at once.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          {[["TikTok → YouTube","🎵","▶️"],["YouTube → TikTok","▶️","🎵"],["Instagram → YouTube","📸","▶️"],["YouTube → Instagram","▶️","📸"],["TikTok → Instagram","🎵","📸"],["One → All","✨","🌐"]].map(([label,a,b]) => (
            <div key={label} className="platform-pill" style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 100, padding: "11px 20px", fontSize: 13, color: "#6B6960", transition: "border-color 0.15s", display: "flex", alignItems: "center", gap: 8 }}>
              {a} <span style={{ color: "#A8A69E" }}>→</span> {b} <strong style={{ color: "#0E0D0B", fontWeight: 500 }}>{label}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* PRICING PREVIEW */}
      <div style={{ height: 1, background: "rgba(0,0,0,0.07)", maxWidth: 1100, margin: "0 auto" }} />
      <div className="reveal" style={{ maxWidth: 1100, margin: "0 auto", padding: "96px 48px", textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#7C5CFC", textTransform: "uppercase", letterSpacing: 3, marginBottom: 14, fontFamily: "'Syne',sans-serif" }}>Pricing</div>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(30px,4vw,48px)", fontWeight: 800, letterSpacing: -2, marginBottom: 12 }}>Simple,<br /><span style={{ fontStyle: "italic", fontWeight: 300, fontFamily: "'DM Sans',sans-serif", color: "#6B6960" }}>honest pricing.</span></h2>
        <p style={{ fontSize: 16, color: "#6B6960", fontWeight: 300, marginBottom: 36 }}>Start free. Upgrade when you're ready.</p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
          {[{ tier:"Free", price:"$0", desc:"3 reposts/month", dark:false },{ tier:"Pro", price:"$12", desc:"Unlimited · All platforms", dark:true }].map(p => (
            <div key={p.tier} style={{ background: p.dark ? "#0E0D0B" : "white", color: p.dark ? "#F7F6F2" : "#0E0D0B", border: p.dark ? "none" : "1px solid rgba(0,0,0,0.08)", borderRadius: 16, padding: "28px 32px", minWidth: 200, textAlign: "left" }}>
              <div style={{ fontSize: 10, opacity: 0.4, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>{p.tier}</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 40, fontWeight: 800, letterSpacing: -2 }}>{p.price}<span style={{ fontSize: 13, fontWeight: 300, opacity: 0.4 }}>/mo</span></div>
              <div style={{ fontSize: 13, opacity: 0.5, marginTop: 8, fontWeight: 300 }}>{p.desc}</div>
            </div>
          ))}
        </div>
        <Link to="/pricing" style={{ display: "inline-block", padding: "11px 24px", background: "#0E0D0B", color: "white", borderRadius: 100, fontSize: 14, fontWeight: 500, textDecoration: "none" }}>See full pricing →</Link>
      </div>

      <Footer />
    </div>
  );
}
