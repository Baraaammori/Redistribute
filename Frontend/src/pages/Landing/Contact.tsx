import React, { useState } from "react";
import Footer from "../../components/Footer";

export default function Contact() {
  const [form, setForm] = useState({ name:"", email:"", subject:"", message:"" });
  const [sent, setSent] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{ background:"#0A0A0F", padding:"140px 48px 80px", textAlign:"center" }}>
        <div style={{ fontSize:10, fontWeight:700, color:"rgba(155,126,255,0.8)", textTransform:"uppercase", letterSpacing:3, marginBottom:14, fontFamily:"'Syne',sans-serif" }}>Contact</div>
        <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(40px,6vw,68px)", fontWeight:800, letterSpacing:-3, color:"white", marginBottom:16 }}>Get in touch.</h1>
        <p style={{ fontSize:16, color:"rgba(255,255,255,0.45)", fontWeight:300 }}>We reply to every message, usually within 24 hours.</p>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"80px 48px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:60, alignItems:"start" }}>
          {/* Info */}
          <div>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:32, fontWeight:800, letterSpacing:-1.5, marginBottom:16 }}>We'd love to<br />hear from you.</h2>
            <p style={{ fontSize:15, color:"#6B6960", lineHeight:1.7, fontWeight:300, marginBottom:24 }}>Whether you have a bug report, a feature idea, or just want to say hi — we read everything and respond to every message.</p>
            {[
              { icon:"📧", label:"Email", val:"hello@redistribute.io" },
              { icon:"🐙", label:"GitHub", val:"github.com/Mawhadmd/redistribute" },
              { icon:"🌐", label:"Live app", val:"redistribute.vercel.app" },
            ].map(d => (
              <div key={d.label} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 0", borderBottom:"1px solid rgba(0,0,0,0.07)" }}>
                <span style={{ fontSize:20, width:36 }}>{d.icon}</span>
                <div>
                  <div style={{ fontSize:11, color:"#A8A69E", marginBottom:2 }}>{d.label}</div>
                  <div style={{ fontWeight:500, fontSize:14 }}>{d.val}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          <div style={{ background:"white", border:"1px solid rgba(0,0,0,0.08)", borderRadius:20, padding:36 }}>
            {sent ? (
              <div style={{ textAlign:"center", padding:32 }}>
                <div style={{ fontSize:48, marginBottom:14 }}>✅</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, marginBottom:8 }}>Message sent!</div>
                <div style={{ fontSize:14, color:"#6B6960", fontWeight:300 }}>We'll get back to you within 24 hours.</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, letterSpacing:-0.5 }}>Send a message</div>
                {[["name","Your name","text","Baraa Ammori"],["email","Email address","email","you@example.com"],["subject","Subject","text","Feature request, bug report..."]].map(([k,label,type,ph]) => (
                  <div key={k} style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    <label style={{ fontSize:11, fontWeight:600, color:"#A8A69E", textTransform:"uppercase", letterSpacing:1 }}>{label}</label>
                    <input type={type} placeholder={ph} value={(form as any)[k]} onChange={set(k)}
                      style={{ background:"#F7F6F2", border:"1px solid rgba(0,0,0,0.08)", borderRadius:10, padding:"11px 14px", fontFamily:"'DM Sans',sans-serif", fontSize:14, outline:"none", fontWeight:300 }}
                      onFocus={e=>e.target.style.borderColor="#7C5CFC"} onBlur={e=>e.target.style.borderColor="rgba(0,0,0,0.08)"}/>
                  </div>
                ))}
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  <label style={{ fontSize:11, fontWeight:600, color:"#A8A69E", textTransform:"uppercase", letterSpacing:1 }}>Message</label>
                  <textarea placeholder="Tell us what's on your mind..." value={form.message} onChange={set("message")} rows={5}
                    style={{ background:"#F7F6F2", border:"1px solid rgba(0,0,0,0.08)", borderRadius:10, padding:"11px 14px", fontFamily:"'DM Sans',sans-serif", fontSize:14, outline:"none", resize:"vertical", fontWeight:300 }}
                    onFocus={e=>e.target.style.borderColor="#7C5CFC"} onBlur={e=>e.target.style.borderColor="rgba(0,0,0,0.08)"}/>
                </div>
                <button onClick={() => setSent(true)} style={{ padding:"11px 24px", background:"#0E0D0B", color:"white", border:"none", borderRadius:100, fontSize:14, fontWeight:500, cursor:"pointer", alignSelf:"flex-start" }}>
                  Send message →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
