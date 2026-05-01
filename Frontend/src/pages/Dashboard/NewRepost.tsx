import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../lib/api";

function StatusPill({ status }: { status: string }) {
  const map: Record<string,{bg:string,color:string,label:string}> = {
    done:       { bg:"rgba(31,207,160,0.15)", color:"#1FCFA0", label:"Done" },
    pending:    { bg:"rgba(240,201,74,0.15)",  color:"#F0C94A", label:"Pending" },
    scheduled:  { bg:"rgba(124,92,252,0.15)", color:"#9B7EFF", label:"Scheduled" },
    processing: { bg:"rgba(59,130,246,0.15)", color:"#60A5FA", label:"Processing" },
    failed:     { bg:"rgba(239,68,68,0.15)",  color:"#EF4444", label:"Failed" },
  };
  const s = map[status] || map.pending;
  return <span style={{ background:s.bg, color:s.color, borderRadius:100, padding:"3px 12px", fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>{s.label}</span>;
}

export { StatusPill };

export default function NewRepost() {
  const [mode, setMode] = useState<"select"|"url"|null>(null);
  const [step, setStep] = useState(0);
  const [source, setSource] = useState("");
  const [videos, setVideos] = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [destinations, setDestinations] = useState<string[]>([]);
  const [schedule, setSchedule] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [pastedUrl, setPastedUrl] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const navigate = useNavigate();

  const platforms = ["youtube","tiktok","instagram"];

  const detectPlatform = (url: string) => {
    if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
    if (/tiktok\.com/.test(url)) return "tiktok";
    if (/instagram\.com/.test(url)) return "instagram";
    return "";
  };

  const loadVideos = async (platform: string) => {
    setLoadingVideos(true);
    try { const v = await api.videos.list(platform); setVideos(v); } catch { setVideos([]); }
    finally { setLoadingVideos(false); }
  };

  const handleUrlSubmit = () => {
    const detected = detectPlatform(pastedUrl);
    if (!detected) { alert("Please paste a valid YouTube, TikTok, or Instagram URL."); return; }
    setSource(detected);
    setSelectedVideo({ id: `url_${Date.now()}`, url: pastedUrl, title: urlTitle || `${detected} video`, thumbnail: null });
    setStep(2);
  };

  const toggleDest = (p: string) => setDestinations(prev => prev.includes(p) ? prev.filter(d=>d!==p) : [...prev,p]);

  const submit = async () => {
    if (!selectedVideo || !destinations.length) return;
    setSubmitting(true);
    try {
      await api.reposts.create({ sourceVideoId: selectedVideo.id, sourceVideoUrl: selectedVideo.url, sourcePlatform: source, title: selectedVideo.title, thumbnailUrl: selectedVideo.thumbnail, destinations, scheduledFor: schedule || null });
      setDone(true);
    } catch(err:any) { alert(err.message); }
    finally { setSubmitting(false); }
  };

  const resetAll = () => { setDone(false); setMode(null); setStep(0); setSource(""); setSelectedVideo(null); setDestinations([]); setSchedule(""); setPastedUrl(""); setUrlTitle(""); };

  if (done) return (
    <div style={{ padding:40, textAlign:"center", maxWidth:500, margin:"80px auto" }}>
      <div style={{ fontSize:56, marginBottom:16 }}>🎉</div>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:800, color:"white", marginBottom:10 }}>Repost queued!</div>
      <div style={{ fontSize:14, color:"rgba(255,255,255,0.4)", marginBottom:28, fontWeight:300 }}>Your video is being distributed. Check the queue to track progress.</div>
      <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
        <button onClick={()=>navigate("/dashboard/queue")} style={{ padding:"10px 22px", background:"#7C5CFC", color:"white", border:"none", borderRadius:100, fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>View queue →</button>
        <button onClick={resetAll} style={{ padding:"10px 22px", background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.6)", border:"none", borderRadius:100, fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>New repost</button>
      </div>
    </div>
  );

  // Mode selection screen
  if (!mode) return (
    <div style={{ padding:40, maxWidth:700 }}>
      <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:800, color:"white", letterSpacing:-1, marginBottom:8 }}>New Repost</h1>
      <div style={{ fontSize:15, color:"rgba(255,255,255,0.5)", marginBottom:28, fontWeight:300 }}>How would you like to add the video?</div>
      <div style={{ display:"flex", gap:16 }}>
        <button onClick={()=>{ setMode("url"); setStep(1); }}
          style={{ flex:1, padding:"32px 24px", background:"linear-gradient(145deg, rgba(124,92,252,0.12), rgba(31,207,160,0.06))", border:"1px solid rgba(124,92,252,0.2)", borderRadius:18, cursor:"pointer", textAlign:"left", transition:"all 0.2s" }}
          onMouseEnter={e=>(e.currentTarget.style.borderColor="rgba(124,92,252,0.5)")}
          onMouseLeave={e=>(e.currentTarget.style.borderColor="rgba(124,92,252,0.2)")}>
          <div style={{ fontSize:32, marginBottom:12 }}>🔗</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:"white", marginBottom:6 }}>Paste a URL</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", fontWeight:300, lineHeight:1.5 }}>
            Paste a YouTube, TikTok, or Instagram link. TikTok videos are downloaded <strong style={{color:"#1FCFA0"}}>without watermark</strong>.
          </div>
        </button>
        <button onClick={()=>{ setMode("select"); setStep(0); }}
          style={{ flex:1, padding:"32px 24px", background:"#111118", border:"1px solid rgba(255,255,255,0.07)", borderRadius:18, cursor:"pointer", textAlign:"left", transition:"all 0.2s" }}
          onMouseEnter={e=>(e.currentTarget.style.borderColor="rgba(255,255,255,0.15)")}
          onMouseLeave={e=>(e.currentTarget.style.borderColor="rgba(255,255,255,0.07)")}>
          <div style={{ fontSize:32, marginBottom:12 }}>📂</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:"white", marginBottom:6 }}>Select from Account</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", fontWeight:300, lineHeight:1.5 }}>
            Browse your connected YouTube account and pick a video to redistribute.
          </div>
        </button>
      </div>
    </div>
  );

  const steps = mode === "url" ? ["Paste URL","Destinations","Schedule"] : ["Source platform","Pick video","Destinations","Schedule"];
  const activeStep = mode === "url" ? step - 1 : step;

  return (
    <div style={{ padding:40, maxWidth:700 }}>
      <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:800, color:"white", letterSpacing:-1, marginBottom:8 }}>New Repost</h1>
      {/* Progress bar */}
      <div style={{ display:"flex", gap:0, marginBottom:36 }}>
        {steps.map((s,i) => (
          <div key={s} style={{ display:"flex", alignItems:"center", gap:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 14px", borderRadius:100, background: i===activeStep?"rgba(124,92,252,0.2)":"transparent" }}>
              <span style={{ width:20, height:20, borderRadius:"50%", background: i<activeStep?"#1FCFA0":i===activeStep?"#7C5CFC":"rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"white" }}>{i<activeStep?"✓":i+1}</span>
              <span style={{ fontSize:12, color: i===activeStep?"#9B7EFF":i<activeStep?"rgba(255,255,255,0.6)":"rgba(255,255,255,0.25)" }}>{s}</span>
            </div>
            {i<steps.length-1 && <div style={{ width:24, height:1, background:"rgba(255,255,255,0.08)" }}/>}
          </div>
        ))}
      </div>

      {/* URL Mode — Paste URL */}
      {mode === "url" && step === 1 && (
        <div>
          <div style={{ fontSize:15, color:"rgba(255,255,255,0.6)", marginBottom:20, fontWeight:300 }}>Paste a video URL from YouTube, TikTok, or Instagram.</div>
          <input value={pastedUrl} onChange={e=>setPastedUrl(e.target.value)} placeholder="https://www.tiktok.com/@user/video/..."
            style={{ width:"100%", padding:"14px 18px", background:"#111118", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, color:"white", fontSize:14, fontFamily:"'DM Sans',sans-serif", outline:"none", marginBottom:12, boxSizing:"border-box" }}/>
          <input value={urlTitle} onChange={e=>setUrlTitle(e.target.value)} placeholder="Video title (optional)"
            style={{ width:"100%", padding:"12px 18px", background:"#111118", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, color:"white", fontSize:13, fontFamily:"'DM Sans',sans-serif", outline:"none", marginBottom:16, boxSizing:"border-box" }}/>
          {pastedUrl && detectPlatform(pastedUrl) && (
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 14px", background:"rgba(31,207,160,0.1)", border:"1px solid rgba(31,207,160,0.2)", borderRadius:100, fontSize:12, color:"#1FCFA0", marginBottom:16 }}>
              {detectPlatform(pastedUrl)==="youtube"?"▶️":detectPlatform(pastedUrl)==="tiktok"?"🎵":"📸"} Detected: <strong style={{textTransform:"capitalize"}}>{detectPlatform(pastedUrl)}</strong>
              {detectPlatform(pastedUrl)==="tiktok" && <span style={{color:"rgba(255,255,255,0.4)"}}>• Watermark-free</span>}
            </div>
          )}
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>{ setMode(null); setStep(0); }} style={{ padding:"10px 20px", background:"transparent", border:"1px solid rgba(255,255,255,0.1)", borderRadius:100, color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:14, fontFamily:"'DM Sans',sans-serif" }}>← Back</button>
            <button onClick={handleUrlSubmit} disabled={!pastedUrl.trim()} style={{ padding:"10px 24px", background: pastedUrl.trim()?"#7C5CFC":"rgba(255,255,255,0.06)", color:"white", border:"none", borderRadius:100, fontSize:14, cursor: pastedUrl.trim()?"pointer":"not-allowed", fontFamily:"'DM Sans',sans-serif", fontWeight:500 }}>Next →</button>
          </div>
        </div>
      )}

      {/* Select Mode — Source platform */}
      {mode === "select" && step === 0 && (
        <div>
          <div style={{ fontSize:15, color:"rgba(255,255,255,0.6)", marginBottom:20, fontWeight:300 }}>Which platform has the video you want to redistribute?</div>
          <div style={{ display:"flex", gap:12 }}>
            {platforms.map(p => (
              <button key={p} onClick={()=>{ setSource(p); loadVideos(p); setStep(1); }} style={{ flex:1, padding:"20px 16px", background:"#111118", border:`1px solid ${source===p?"#7C5CFC":"rgba(255,255,255,0.07)"}`, borderRadius:14, color:"white", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:500, textTransform:"capitalize", transition:"all 0.15s" }}>
                {p==="youtube"?"▶️":p==="tiktok"?"🎵":"📸"} {p}
              </button>
            ))}
          </div>
          <button onClick={()=>setMode(null)} style={{ marginTop:16, padding:"8px 18px", background:"transparent", border:"1px solid rgba(255,255,255,0.1)", borderRadius:100, color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>← Back</button>
        </div>
      )}

      {/* Select Mode — Pick video */}
      {mode === "select" && step === 1 && (
        <div>
          <div style={{ fontSize:15, color:"rgba(255,255,255,0.6)", marginBottom:20, fontWeight:300 }}>Select a video from your {source} account.</div>
          {loadingVideos ? (
            <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.3)" }}>Loading videos…</div>
          ) : videos.length === 0 ? (
            <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.3)", fontSize:14 }}>
              No videos found.{" "}
              {source === "tiktok" ? (
                <span>TikTok's API only shows videos uploaded through this app.{" "}
                  <button onClick={()=>{ setMode("url"); setStep(1); }} style={{ background:"none", border:"none", color:"#9B7EFF", cursor:"pointer", textDecoration:"underline", fontFamily:"inherit", fontSize:14 }}>Paste a TikTok URL instead →</button>
                </span>
              ) : (
                <span>Make sure your {source} account is connected.</span>
              )}
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12, maxHeight:400, overflowY:"auto" }}>
              {videos.map(v => (
                <div key={v.id} onClick={()=>{ setSelectedVideo(v); setStep(2); }} style={{ background:"#111118", border:`1px solid ${selectedVideo?.id===v.id?"#7C5CFC":"rgba(255,255,255,0.07)"}`, borderRadius:12, overflow:"hidden", cursor:"pointer", transition:"all 0.15s" }}>
                  {v.thumbnail && <img src={v.thumbnail} alt="" style={{ width:"100%", aspectRatio:"16/9", objectFit:"cover" }}/>}
                  <div style={{ padding:"10px 12px" }}>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontWeight:400, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" as any }}>{v.title}</div>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginTop:4 }}>{new Date(v.publishedAt).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={()=>setStep(0)} style={{ marginTop:16, padding:"8px 18px", background:"transparent", border:"1px solid rgba(255,255,255,0.1)", borderRadius:100, color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>← Back</button>
        </div>
      )}

      {/* Destinations (both modes) */}
      {step === 2 && (
        <div>
          <div style={{ fontSize:15, color:"rgba(255,255,255,0.6)", marginBottom:8, fontWeight:300 }}>Where should <strong style={{ color:"rgba(255,255,255,0.8)" }}>"{selectedVideo?.title?.slice(0,50)}"</strong> be posted?</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.25)", marginBottom:20 }}>Select one or more destinations (cannot be same as source)</div>
          <div style={{ display:"flex", gap:12, marginBottom:24 }}>
            {platforms.filter(p=>p!==source).map(p => (
              <button key={p} onClick={()=>toggleDest(p)} style={{ flex:1, padding:"20px 16px", background: destinations.includes(p)?"rgba(124,92,252,0.15)":"#111118", border:`1px solid ${destinations.includes(p)?"#7C5CFC":"rgba(255,255,255,0.07)"}`, borderRadius:14, color: destinations.includes(p)?"#9B7EFF":"rgba(255,255,255,0.6)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:500, textTransform:"capitalize", transition:"all 0.15s" }}>
                {p==="youtube"?"▶️":p==="tiktok"?"🎵":"📸"} {p}
                {destinations.includes(p) && <span style={{ display:"block", fontSize:10, marginTop:4 }}>✓ selected</span>}
              </button>
            ))}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>setStep(mode==="url"?1:1)} style={{ padding:"10px 20px", background:"transparent", border:"1px solid rgba(255,255,255,0.1)", borderRadius:100, color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:14, fontFamily:"'DM Sans',sans-serif" }}>← Back</button>
            <button onClick={()=>setStep(3)} disabled={!destinations.length} style={{ padding:"10px 24px", background: destinations.length?"#7C5CFC":"rgba(255,255,255,0.06)", color:"white", border:"none", borderRadius:100, fontSize:14, cursor:destinations.length?"pointer":"not-allowed", fontFamily:"'DM Sans',sans-serif", fontWeight:500 }}>Next →</button>
          </div>
        </div>
      )}

      {/* Schedule (both modes) */}
      {step === 3 && (
        <div>
          <div style={{ fontSize:15, color:"rgba(255,255,255,0.6)", marginBottom:20, fontWeight:300 }}>When should this repost go out?</div>
          <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:28 }}>
            <label style={{ display:"flex", alignItems:"center", gap:12, padding:"16px 18px", background: !schedule?"rgba(124,92,252,0.1)":"#111118", border:`1px solid ${!schedule?"#7C5CFC":"rgba(255,255,255,0.07)"}`, borderRadius:12, cursor:"pointer" }} onClick={()=>setSchedule("")}>
              <input type="radio" checked={!schedule} onChange={()=>setSchedule("")} style={{ accentColor:"#7C5CFC" }}/>
              <div>
                <div style={{ color:"rgba(255,255,255,0.8)", fontSize:14, fontWeight:500 }}>Post immediately</div>
                <div style={{ color:"rgba(255,255,255,0.3)", fontSize:12, fontWeight:300 }}>Added to the queue now</div>
              </div>
            </label>
            <label style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"16px 18px", background: schedule?"rgba(124,92,252,0.1)":"#111118", border:`1px solid ${schedule?"#7C5CFC":"rgba(255,255,255,0.07)"}`, borderRadius:12 }}>
              <input type="radio" checked={!!schedule} onChange={()=>setSchedule(new Date(Date.now()+3600000).toISOString().slice(0,16))} style={{ accentColor:"#7C5CFC", marginTop:3 }}/>
              <div style={{ flex:1 }}>
                <div style={{ color:"rgba(255,255,255,0.8)", fontSize:14, fontWeight:500, marginBottom:8 }}>Schedule for later</div>
                {schedule && <input type="datetime-local" value={schedule} onChange={e=>setSchedule(e.target.value)}
                  style={{ background:"rgba(0,0,0,0.3)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"8px 12px", color:"white", fontFamily:"'DM Sans',sans-serif", fontSize:13, outline:"none" }}/>}
              </div>
            </label>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>setStep(2)} style={{ padding:"10px 20px", background:"transparent", border:"1px solid rgba(255,255,255,0.1)", borderRadius:100, color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:14, fontFamily:"'DM Sans',sans-serif" }}>← Back</button>
            <button onClick={submit} disabled={submitting} style={{ padding:"10px 28px", background:"#7C5CFC", color:"white", border:"none", borderRadius:100, fontSize:14, cursor:submitting?"not-allowed":"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:500, opacity:submitting?0.7:1 }}>
              {submitting ? "Queuing…" : schedule ? "Schedule repost →" : "Post now →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
