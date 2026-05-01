import React, { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, RefreshCw, Clock, Link2, CreditCard, Settings, LogOut, Plus, Trash2, RotateCcw, ExternalLink, Upload, Film } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../lib/api";
import UploadCenter from "./UploadCenter";
import VideoLibrary from "./VideoLibrary";
import NewRepost, { StatusPill } from "./NewRepost";

// ── SIDEBAR ────────────────────────────────────────────────────────────────────
function Sidebar() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const links = [
    { to:"/dashboard",          icon:<LayoutDashboard size={16}/>, label:"Overview" },
    { to:"/dashboard/upload",   icon:<Upload size={16}/>,          label:"Upload", highlight: true },
    { to:"/dashboard/library",  icon:<Film size={16}/>,            label:"Library" },
    { to:"/dashboard/repost",   icon:<Plus size={16}/>,            label:"Repost" },
    { to:"/dashboard/queue",    icon:<Clock size={16}/>,           label:"Queue" },
    { to:"/dashboard/accounts", icon:<Link2 size={16}/>,           label:"Accounts" },
    { to:"/dashboard/billing",  icon:<CreditCard size={16}/>,      label:"Billing" },
  ];
  return (
    <div style={{ width:220, background:"#0A0A0F", minHeight:"100vh", display:"flex", flexDirection:"column", padding:"28px 0", flexShrink:0, borderRight:"1px solid rgba(255,255,255,0.06)", position:"sticky", top:0 }}>
      <div style={{ padding:"0 20px 28px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
        <Link to="/" style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:800, background:"linear-gradient(135deg,#9B7EFF,#1FCFA0)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", textDecoration:"none" }}>Redistribute</Link>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", marginTop:4, fontWeight:300 }}>{user?.email}</div>
      </div>
      <nav style={{ flex:1, padding:"16px 10px" }}>
        {links.map(l => {
          const active = location.pathname === l.to;
          return (
            <Link key={l.to} to={l.to} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:9, marginBottom:2, textDecoration:"none", fontSize:13, fontWeight: active?600:400, color: active?"white":"rgba(255,255,255,0.4)", background: active?"rgba(255,255,255,0.07)":"transparent", transition:"all 0.14s" }}>
              {l.icon} {l.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ padding:"16px 10px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:9, cursor:"pointer", fontSize:13, color:"rgba(255,255,255,0.35)", fontWeight:300, transition:"all 0.14s" }}
          onClick={() => { logout(); navigate("/"); }}
          onMouseEnter={e=>{ (e.currentTarget as any).style.color="rgba(255,255,255,0.7)"; (e.currentTarget as any).style.background="rgba(255,255,255,0.05)"; }}
          onMouseLeave={e=>{ (e.currentTarget as any).style.color="rgba(255,255,255,0.35)"; (e.currentTarget as any).style.background="transparent"; }}>
          <LogOut size={15}/> Sign out
        </div>
      </div>
    </div>
  );
}

// ── OVERVIEW ───────────────────────────────────────────────────────────────────
function Overview() {
  const { user } = useAuth();
  const [reposts, setReposts] = useState<any[]>([]);
  const [uploads, setUploads] = useState<any[]>([]);
  const [uploadStats, setUploadStats] = useState<any>(null);

  useEffect(() => {
    api.reposts.list().then(setReposts).catch(()=>{});
    api.upload.list().then(setUploads).catch(()=>{});
    api.upload.stats().then(setUploadStats).catch(()=>{});
  }, []);

  const repostStats = [
    { label:"Reposts", val: reposts.length, icon:"🔄" },
    { label:"Completed", val: reposts.filter(r=>r.status==="done").length, icon:"✅" },
  ];

  const smartStats = [
    { label:"Uploads", val: uploadStats?.total_videos || uploads.length, icon:"📤" },
    { label:"Clips", val: uploadStats?.total_clips || 0, icon:"✂️" },
    { label:"Distributed", val: uploadStats?.success_distributions || 0, icon:"🚀" },
    { label:"Failed", val: uploadStats?.failed_distributions || 0, icon:"❌" },
  ];

  const allStats = [...smartStats, ...repostStats];

  const onTrial = user?.trial_ends_at && new Date(user.trial_ends_at) > new Date();

  return (
    <div style={{ padding:40 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:32 }}>
        <div>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:800, letterSpacing:-1, color:"white", marginBottom:6 }}>Overview</h1>
          <div style={{ fontSize:14, color:"rgba(255,255,255,0.4)", fontWeight:300 }}>
            Welcome back, {user?.name || user?.email}
            {onTrial && <span style={{ marginLeft:10, background:"rgba(124,92,252,0.2)", color:"#9B7EFF", borderRadius:100, padding:"3px 10px", fontSize:11 }}>Trial active</span>}
            {user?.plan==="pro" && <span style={{ marginLeft:10, background:"rgba(31,207,160,0.15)", color:"#1FCFA0", borderRadius:100, padding:"3px 10px", fontSize:11 }}>Pro plan</span>}
          </div>
        </div>
        <Link to="/dashboard/upload" style={{ padding:"10px 22px", background:"#7C5CFC", color:"white", border:"none", borderRadius:100, fontSize:14, textDecoration:"none", fontFamily:"'DM Sans',sans-serif", fontWeight:500, display:"flex", alignItems:"center", gap:8 }}>
          <Upload size={14} /> Upload Video
        </Link>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:40 }}>
        {allStats.slice(0,6).map(s => (
          <div key={s.label} style={{ background:"#111118", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:"20px 22px" }}>
            <div style={{ fontSize:24, marginBottom:10 }}>{s.icon}</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:32, fontWeight:800, color:"white", letterSpacing:-1 }}>{s.val}</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", fontWeight:300, marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent uploads */}
      <div style={{ background:"#111118", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:"24px 28px", marginBottom:20 }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:"white", marginBottom:16 }}>Recent Uploads</div>
        {uploads.length === 0 ? (
          <div style={{ textAlign:"center", padding:"32px 0", color:"rgba(255,255,255,0.25)", fontSize:14, fontWeight:300 }}>No uploads yet. <Link to="/dashboard/upload" style={{ color:"#9B7EFF", textDecoration:"none" }}>Upload your first video →</Link></div>
        ) : uploads.slice(0,5).map(v => (
          <Link key={v.id} to="/dashboard/library" style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 0", borderBottom:"1px solid rgba(255,255,255,0.04)", textDecoration:"none" }}>
            {v.thumbnail_url && <img src={v.thumbnail_url} alt="" style={{ width:56, height:32, objectFit:"cover", borderRadius:4 }} />}
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.8)", fontWeight:400 }}>{v.title || "Untitled"}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>
                {v.orientation && `${v.orientation} · `}{v.duration_seconds ? `${Math.round(v.duration_seconds)}s · ` : ""}{new Date(v.created_at).toLocaleDateString()}
              </div>
            </div>
            <StatusPill status={v.status}/>
          </Link>
        ))}
      </div>

      {/* Recent reposts */}
      <div style={{ background:"#111118", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:"24px 28px" }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:"white", marginBottom:16 }}>Recent Reposts</div>
        {reposts.length === 0 ? (
          <div style={{ textAlign:"center", padding:"32px 0", color:"rgba(255,255,255,0.25)", fontSize:14, fontWeight:300 }}>No reposts yet. <Link to="/dashboard/repost" style={{ color:"#9B7EFF", textDecoration:"none" }}>Create your first →</Link></div>
        ) : reposts.slice(0,5).map(r => (
          <div key={r.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.8)", fontWeight:400 }}>{r.title || "Untitled"}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{r.destinations?.join(", ")} · {new Date(r.created_at).toLocaleDateString()}</div>
            </div>
            <StatusPill status={r.status}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── QUEUE ──────────────────────────────────────────────────────────────────────
function Queue() {
  const [reposts, setReposts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = (silent = false) => { if (!silent) setLoading(true); api.reposts.list().then(setReposts).catch(()=>{}).finally(()=>setLoading(false)); };
  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 5000); // Auto-poll every 5s
    return () => clearInterval(interval);
  }, []);

  const doDelete = async (id: string) => { await api.reposts.delete(id); load(); };
  const doRetry  = async (id: string) => { await api.reposts.retry(id);  load(); };

  const counts = { pending: reposts.filter(r=>r.status==="pending").length, processing: reposts.filter(r=>r.status==="processing").length, done: reposts.filter(r=>r.status==="done").length, failed: reposts.filter(r=>r.status==="failed").length };

  return (
    <div style={{ padding:40 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:800, color:"white", letterSpacing:-1 }}>Queue</h1>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.25)" }}>Auto-refreshing</span>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"#1FCFA0", animation:"pulse 2s infinite" }}/>
          <button onClick={()=>load()} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:100, color:"rgba(255,255,255,0.5)", cursor:"pointer", fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>
            <RotateCcw size={13}/> Refresh
          </button>
        </div>
      </div>
      {/* Status summary */}
      <div style={{ display:"flex", gap:10, marginBottom:24 }}>
        {[{label:"Pending",val:counts.pending,color:"#F0C94A"},{label:"Processing",val:counts.processing,color:"#60A5FA"},{label:"Done",val:counts.done,color:"#1FCFA0"},{label:"Failed",val:counts.failed,color:"#EF4444"}].map(s=>(
          <div key={s.label} style={{ flex:1, background:"#111118", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"12px 16px", textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:800, color:s.color, fontFamily:"'Syne',sans-serif" }}>{s.val}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {loading ? (
        <div style={{ textAlign:"center", padding:48, color:"rgba(255,255,255,0.25)" }}>Loading…</div>
      ) : reposts.length === 0 ? (
        <div style={{ textAlign:"center", padding:48, color:"rgba(255,255,255,0.25)", fontSize:14 }}>No reposts yet. <Link to="/dashboard/repost" style={{ color:"#9B7EFF", textDecoration:"none" }}>Create one →</Link></div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {reposts.map(r => (
            <div key={r.id} style={{ background:"#111118", border:`1px solid ${r.status==="processing"?"rgba(59,130,246,0.3)":r.status==="failed"?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.06)"}`, borderRadius:14, padding:"16px 20px", display:"flex", alignItems:"center", gap:16, transition:"border-color 0.3s" }}>
              {r.thumbnail_url && <img src={r.thumbnail_url} alt="" style={{ width:72, height:44, objectFit:"cover", borderRadius:6, flexShrink:0 }}/>}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, color:"rgba(255,255,255,0.85)", fontWeight:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.title || "Untitled"}</div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", marginTop:3 }}>
                  → {r.destinations?.join(", ")} · {r.scheduled_for ? `Scheduled: ${new Date(r.scheduled_for).toLocaleString()}` : new Date(r.created_at).toLocaleString()}
                </div>
                {r.error && <div style={{ fontSize:11, color:"#EF4444", marginTop:3 }}>{r.error}</div>}
              </div>
              <StatusPill status={r.status}/>
              <div style={{ display:"flex", gap:6 }}>
                {r.status==="failed" && <button onClick={()=>doRetry(r.id)} style={{ padding:"6px 10px", background:"rgba(124,92,252,0.15)", border:"1px solid rgba(124,92,252,0.3)", borderRadius:8, color:"#9B7EFF", cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", gap:4, fontFamily:"'DM Sans',sans-serif" }}><RotateCcw size={11}/> Retry</button>}
                <button onClick={()=>doDelete(r.id)} style={{ padding:"6px 10px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:8, color:"#EF4444", cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", gap:4, fontFamily:"'DM Sans',sans-serif" }}><Trash2 size={11}/> Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}


// ── ACCOUNTS ───────────────────────────────────────────────────────────────────
function Accounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const platforms = ["youtube","tiktok","instagram"];
  const load = () => api.accounts.list().then(setAccounts).catch(()=>{});
  useEffect(() => { load(); }, []);

  const connect = async (p: string) => {
    try { const { url } = await api.accounts.authUrl(p); window.location.href = url; }
    catch { alert("Failed to get OAuth URL. Check your backend .env settings."); }
  };
  const disconnect = async (p: string) => { await api.accounts.disconnect(p); load(); };

  return (
    <div style={{ padding:40 }}>
      <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:800, color:"white", letterSpacing:-1, marginBottom:8 }}>Connected Accounts</h1>
      <p style={{ fontSize:14, color:"rgba(255,255,255,0.35)", fontWeight:300, marginBottom:32 }}>Connect your social platforms via OAuth to start redistributing.</p>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {platforms.map(p => {
          const acc = accounts.find(a=>a.platform===p);
          const meta: Record<string,{icon:string,color:string,label:string}> = {
            youtube:   { icon:"▶️", color:"#FF4444", label:"YouTube" },
            tiktok:    { icon:"🎵", color:"#E0E0E0", label:"TikTok" },
            instagram: { icon:"📸", color:"#FF7A3D", label:"Instagram" },
          };
          const m = meta[p];
          return (
            <div key={p} style={{ background:"#111118", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:"20px 24px", display:"flex", alignItems:"center", gap:16 }}>
              <span style={{ fontSize:28 }}>{m.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:"white" }}>{m.label}</div>
                {acc ? (
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", fontWeight:300 }}>
                    {acc.display_name} {acc.follower_count ? `· ${acc.follower_count.toLocaleString()} followers` : ""}
                    <span style={{ marginLeft:10, background:"rgba(31,207,160,0.15)", color:"#1FCFA0", borderRadius:100, padding:"2px 8px", fontSize:10 }}>Connected</span>
                  </div>
                ) : (
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.25)", fontWeight:300 }}>Not connected</div>
                )}
              </div>
              {acc ? (
                <button onClick={()=>disconnect(p)} style={{ padding:"8px 18px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:100, color:"#EF4444", cursor:"pointer", fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>Disconnect</button>
              ) : (
                <button onClick={()=>connect(p)} style={{ padding:"8px 20px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:100, color:"rgba(255,255,255,0.7)", cursor:"pointer", fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>Connect →</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── BILLING ────────────────────────────────────────────────────────────────────
function Billing() {
  const { user } = useAuth();
  const isPro = user?.plan === "pro";
  const onTrial = !isPro && user?.trial_ends_at && new Date(user.trial_ends_at) > new Date();

  const handleUpgrade = async () => {
    try { const { url } = await api.stripe.checkout(); window.location.href = url; }
    catch(err:any) { alert(err.message); }
  };
  const handlePortal = async () => {
    try { const { url } = await api.stripe.portal(); window.location.href = url; }
    catch(err:any) { alert(err.message); }
  };

  return (
    <div style={{ padding:40 }}>
      <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:800, color:"white", letterSpacing:-1, marginBottom:28 }}>Billing</h1>
      <div style={{ display:"flex", gap:16 }}>
        {[
          { tier:"Free", price:0, desc:"3 reposts/month · 2 platforms", current: !isPro },
          { tier:"Pro",  price:12, desc:"Unlimited reposts · All platforms · Scheduling", current: isPro },
        ].map(p => (
          <div key={p.tier} style={{ flex:1, background:"#111118", border:`1px solid ${p.current?"#7C5CFC":"rgba(255,255,255,0.06)"}`, borderRadius:20, padding:28 }}>
            {p.current && <div style={{ fontSize:10, background:"rgba(124,92,252,0.2)", color:"#9B7EFF", display:"inline-block", padding:"3px 10px", borderRadius:100, marginBottom:14, fontWeight:700, letterSpacing:1 }}>CURRENT PLAN</div>}
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:2, marginBottom:8, fontFamily:"'Syne',sans-serif" }}>{p.tier}</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:40, fontWeight:800, color:"white", letterSpacing:-2 }}>${p.price}<span style={{ fontSize:14, fontWeight:300, opacity:0.4 }}>/mo</span></div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.35)", marginTop:8, fontWeight:300 }}>{p.desc}</div>
            {onTrial && p.tier==="Free" && <div style={{ marginTop:12, fontSize:12, color:"#F0C94A" }}>Trial ends: {new Date(user!.trial_ends_at!).toLocaleDateString()}</div>}
            <div style={{ marginTop:20 }}>
              {p.tier==="Pro" && !isPro && (
                <button onClick={handleUpgrade} style={{ padding:"10px 22px", background:"#7C5CFC", color:"white", border:"none", borderRadius:100, fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:500 }}>Upgrade to Pro →</button>
              )}
              {isPro && p.tier==="Pro" && (
                <button onClick={handlePortal} style={{ padding:"10px 22px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:100, color:"rgba(255,255,255,0.6)", fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Manage billing →</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DASHBOARD ROOT ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#0A0A0F" }}>
      <Sidebar />
      <div style={{ flex:1 }}>
        <Routes>
          <Route index        element={<Overview />} />
          <Route path="upload"   element={<UploadCenter />} />
          <Route path="library"  element={<VideoLibrary />} />
          <Route path="repost"   element={<NewRepost />} />
          <Route path="queue"    element={<Queue />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="billing"  element={<Billing />} />
        </Routes>
      </div>
    </div>
  );
}
