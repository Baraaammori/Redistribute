import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../lib/api";
import Footer from "../../components/Footer";

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(e => e.forEach(el => { if(el.isIntersecting) el.target.classList.add("visible"); }), { threshold:0.1 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  },[]);

  const handlePro = async () => {
    if (!user) { navigate("/register"); return; }
    try {
      const { url } = await api.stripe.checkout();
      window.location.href = url;
    } catch { navigate("/register"); }
  };

  const plans = [
    { tier:"Free", price:0, desc:"Perfect for testing the platform with your own accounts.",
      feats:[[true,"3 reposts / month"],[true,"2 platforms"],[true,"Manual post-now"],[false,"Scheduling"],[false,"All platforms"],[false,"Priority support"]], cta:"Start free", action:()=>navigate("/register") },
    { tier:"Pro", price:12, featured:true, desc:"For active creators who post consistently across all platforms.",
      feats:[[true,"Unlimited reposts"],[true,"All 3 platforms"],[true,"Post now or schedule"],[true,"Analytics dashboard"],[true,"Priority support"],[true,"14-day free trial"]], cta:"Start free trial", action: handlePro },
    { tier:"Team", price:29, desc:"For agencies managing multiple creator accounts and clients.",
      feats:[[true,"Everything in Pro"],[true,"5 team seats"],[true,"Client workspaces"],[true,"Admin portal"],[true,"API access"],[true,"Dedicated support"]], cta:"Get Team", action:()=>navigate("/register") },
  ];

  return (
    <div>
      <style>{`.reveal{opacity:0;transform:translateY(24px);transition:opacity 0.65s,transform 0.65s}.reveal.visible{opacity:1;transform:none}`}</style>

      <div style={{ background:"#0A0A0F", padding:"140px 48px 80px", textAlign:"center" }}>
        <div style={{ fontSize:10, fontWeight:700, color:"rgba(155,126,255,0.8)", textTransform:"uppercase", letterSpacing:3, marginBottom:14, fontFamily:"'Syne',sans-serif" }}>Pricing</div>
        <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(40px,6vw,68px)", fontWeight:800, letterSpacing:-3, color:"white", marginBottom:16 }}>Simple pricing.</h1>
        <p style={{ fontSize:16, color:"rgba(255,255,255,0.45)", fontWeight:300 }}>Start free. No credit card required. Cancel anytime.</p>
      </div>

      <div className="reveal" style={{ maxWidth:1100, margin:"0 auto", padding:"80px 48px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:18 }}>
          {plans.map(p => (
            <div key={p.tier} style={{ background:"white", border:`1px solid ${p.featured?"#7C5CFC":"rgba(0,0,0,0.08)"}`, borderRadius:20, padding:32, display:"flex", flexDirection:"column", gap:14, transition:"all 0.2s", position:"relative", ...(p.featured?{background:"linear-gradient(135deg,#FAF8FF,white)"}:{}) }}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 16px 40px rgba(0,0,0,0.08)"}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none"}}>
              {p.featured && <div style={{ position:"absolute", top:20, right:0, background:"#7C5CFC", color:"white", fontSize:9, fontWeight:700, padding:"4px 14px 4px 10px", borderRadius:"4px 0 0 4px", letterSpacing:1 }}>POPULAR</div>}
              <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:2, color:"#A8A69E", fontFamily:"'Syne',sans-serif" }}>{p.tier}</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:46, fontWeight:800, letterSpacing:-3, lineHeight:1 }}>
                <sup style={{ fontSize:18, fontWeight:400, color:"#6B6960", verticalAlign:"top", marginTop:10 }}>$</sup>{p.price}<sub style={{ fontSize:14, fontWeight:300, color:"#A8A69E" }}>/mo</sub>
              </div>
              <div style={{ fontSize:13, color:"#6B6960", fontWeight:300, lineHeight:1.6 }}>{p.desc}</div>
              <div style={{ height:1, background:"rgba(0,0,0,0.07)" }} />
              <div style={{ flex:1, display:"flex", flexDirection:"column", gap:10 }}>
                {p.feats.map(([ok, label]) => (
                  <div key={label as string} style={{ fontSize:13, color: ok ? "#6B6960" : "#A8A69E", display:"flex", gap:8, alignItems:"flex-start", fontWeight:300 }}>
                    <span style={{ color: ok ? "#1A7A4A" : "#A8A69E", flexShrink:0, fontWeight:700 }}>{ok ? "✓" : "—"}</span>
                    {label as string}
                  </div>
                ))}
              </div>
              <button onClick={p.action} style={{ padding:"11px", borderRadius:100, fontSize:14, fontFamily:"'DM Sans',sans-serif", cursor:"pointer", transition:"all 0.15s", fontWeight:500, textAlign:"center", ...(p.featured ? { background:"#7C5CFC", color:"white", border:"none" } : { background:"transparent", border:"1px solid rgba(0,0,0,0.1)", color:"#6B6960" }) }}>
                {p.cta}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div style={{ marginTop:80 }}>
          <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:800, letterSpacing:-1, marginBottom:28 }}>Frequently asked</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
            {[
              ["Do I need a credit card to start?","No. The free plan requires no card at all. Pro and Team plans use Stripe — you can cancel anytime."],
              ["How does the free trial work?","Pro comes with a 14-day free trial. You won't be charged until the trial ends. Cancel before then — no charge."],
              ["What platforms are supported?","YouTube, TikTok, and Instagram — connected via their official OAuth APIs. No scraping, no unofficial access."],
              ["Can I schedule posts in advance?","Yes, on Pro and Team plans. Pick any future date and time and we'll handle the upload automatically."],
              ["What happens if an upload fails?","Failed jobs appear in your queue with an error message and a retry button. We'll also email you a notification."],
              ["Is my data safe?","OAuth tokens are encrypted at rest. We never store your video content — it's downloaded, uploaded, then immediately deleted."],
            ].map(([q,a]) => (
              <div key={q} style={{ background:"white", border:"1px solid rgba(0,0,0,0.08)", borderRadius:14, padding:"24px" }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, marginBottom:10 }}>{q}</div>
                <div style={{ fontSize:13, color:"#6B6960", lineHeight:1.65, fontWeight:300 }}>{a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
