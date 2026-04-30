import React, { useEffect } from "react";
import Footer from "../../components/Footer";

export default function About() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(e => e.forEach(el => { if(el.isIntersecting) el.target.classList.add("visible"); }), { threshold:0.1 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  },[]);

  return (
    <div>
      <style>{`.reveal{opacity:0;transform:translateY(24px);transition:opacity 0.65s,transform 0.65s}.reveal.visible{opacity:1;transform:none}`}</style>

      {/* HERO */}
      <div style={{ background:"#0A0A0F", padding:"140px 48px 80px", textAlign:"center" }}>
        <div style={{ fontSize:10, fontWeight:700, color:"rgba(155,126,255,0.8)", textTransform:"uppercase", letterSpacing:3, marginBottom:14, fontFamily:"'Syne',sans-serif" }}>About us</div>
        <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(40px,6vw,72px)", fontWeight:800, letterSpacing:-3, color:"white", marginBottom:20, lineHeight:1 }}>Built by creators,<br />for creators.</h1>
        <p style={{ fontSize:17, color:"rgba(255,255,255,0.45)", maxWidth:500, margin:"0 auto", fontWeight:300, lineHeight:1.7 }}>We were tired of logging into three different platforms to post the same video. So we built the tool we wanted.</p>
      </div>

      {/* MISSION */}
      <div className="reveal" style={{ maxWidth:1100, margin:"0 auto", padding:"96px 48px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:52, alignItems:"center" }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"#7C5CFC", textTransform:"uppercase", letterSpacing:3, marginBottom:14, fontFamily:"'Syne',sans-serif" }}>Our mission</div>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(28px,4vw,42px)", fontWeight:800, letterSpacing:-2, marginBottom:16, lineHeight:1.1 }}>Remove the busywork<br />from <span style={{ fontStyle:"italic", fontWeight:300, fontFamily:"'DM Sans',sans-serif", color:"#6B6960" }}>content creation.</span></h2>
            <p style={{ fontSize:15, color:"#6B6960", lineHeight:1.75, fontWeight:300 }}>Creating content is hard enough. The distribution shouldn't be. Redistribute is a platform-agnostic distribution layer — you focus on making great videos, we make sure they reach every audience you've built.</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            {[["48+","Reposts made"],["3","Platforms supported"],["100%","Automated uploads"],["Week 2","Project stage"]].map(([v,l]) => (
              <div key={l} style={{ background:"white", border:"1px solid rgba(0,0,0,0.08)", borderRadius:14, padding:"22px 20px" }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:32, fontWeight:800, letterSpacing:-1.5, marginBottom:4 }}>{v}</div>
                <div style={{ fontSize:12, color:"#6B6960", fontWeight:300 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TEAM */}
      <div style={{ height:1, background:"rgba(0,0,0,0.07)", maxWidth:1100, margin:"0 auto" }} />
      <div className="reveal" style={{ maxWidth:1100, margin:"0 auto", padding:"96px 48px" }}>
        <div style={{ fontSize:10, fontWeight:700, color:"#7C5CFC", textTransform:"uppercase", letterSpacing:3, marginBottom:14, fontFamily:"'Syne',sans-serif" }}>The team</div>
        <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(28px,4vw,42px)", fontWeight:800, letterSpacing:-2, marginBottom:40 }}>Meet the <span style={{ fontStyle:"italic", fontWeight:300, fontFamily:"'DM Sans',sans-serif", color:"#6B6960" }}>builders.</span></h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:18 }}>
          {[{ name:"Baraa Ammori", role:"Lead Developer & Founder", emoji:"👨‍💻" },{ name:"Team Member", role:"Frontend Developer", emoji:"👩‍🎨" },{ name:"Team Member", role:"Backend Engineer", emoji:"🧑‍💻" }].map(m => (
            <div key={m.name} style={{ background:"white", border:"1px solid rgba(0,0,0,0.08)", borderRadius:16, padding:"28px", textAlign:"center", transition:"all 0.2s", cursor:"default" }}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,0.08)"}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none"}}>
              <div style={{ fontSize:40, marginBottom:12 }}>{m.emoji}</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, marginBottom:4 }}>{m.name}</div>
              <div style={{ fontSize:12, color:"#6B6960", fontWeight:300 }}>{m.role}</div>
            </div>
          ))}
        </div>
      </div>

      {/* VALUES */}
      <div style={{ height:1, background:"rgba(0,0,0,0.07)", maxWidth:1100, margin:"0 auto" }} />
      <div className="reveal" style={{ maxWidth:1100, margin:"0 auto", padding:"96px 48px" }}>
        <div style={{ fontSize:10, fontWeight:700, color:"#7C5CFC", textTransform:"uppercase", letterSpacing:3, marginBottom:14, fontFamily:"'Syne',sans-serif" }}>Our values</div>
        <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(28px,4vw,42px)", fontWeight:800, letterSpacing:-2, marginBottom:36 }}>What we <span style={{ fontStyle:"italic", fontWeight:300, fontFamily:"'DM Sans',sans-serif", color:"#6B6960" }}>believe in.</span></h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:16 }}>
          {[
            { icon:"⚡", t:"Simplicity first",      d:"Every feature must be explainable in one sentence. If it's complicated, it's wrong." },
            { icon:"🔐", t:"Privacy by default",    d:"Your OAuth tokens are encrypted at rest. We never read your content or sell your data." },
            { icon:"🌐", t:"Platform agnostic",     d:"No platform lock-in. We work with every major platform and plan to keep adding more." },
            { icon:"🚀", t:"Speed matters",          d:"We queue and process uploads fast. You shouldn't have to wait around for a simple repost." },
          ].map(v => (
            <div key={v.t} style={{ background:"#F7F6F2", border:"1px solid rgba(0,0,0,0.07)", borderRadius:14, padding:"24px" }}>
              <div style={{ fontSize:24, marginBottom:12 }}>{v.icon}</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, marginBottom:8 }}>{v.t}</div>
              <div style={{ fontSize:14, color:"#6B6960", lineHeight:1.65, fontWeight:300 }}>{v.d}</div>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}
