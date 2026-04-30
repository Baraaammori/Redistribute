import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!name || !email || !password) { setError("Please fill in all fields"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true); setError("");
    try {
      await register(email, password, name);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally { setLoading(false); }
  };

  const inputStyle: React.CSSProperties = { background:"#F7F6F2", border:"1px solid rgba(0,0,0,0.08)", borderRadius:10, padding:"11px 14px", fontFamily:"'DM Sans',sans-serif", fontSize:14, outline:"none", fontWeight:300, width:"100%" };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#F7F6F2", padding:"80px 20px" }}>
      <div style={{ background:"white", border:"1px solid rgba(0,0,0,0.08)", borderRadius:20, padding:"40px", width:"100%", maxWidth:420 }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <Link to="/" style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:800, color:"#0E0D0B", textDecoration:"none", display:"block", marginBottom:8 }}>Redistribute</Link>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800, letterSpacing:-1 }}>Create account</div>
          <div style={{ fontSize:13, color:"#6B6960", marginTop:6, fontWeight:300 }}>Start distributing your content · 14-day free trial</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {error && <div style={{ background:"#FFF2F2", border:"1px solid #FFD0D0", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#D63B3B" }}>{error}</div>}
          {[["name","Full name","text","Baraa Ammori",name,setName],["email","Email","email","you@example.com",email,setEmail],["password","Password","password","Min 8 characters",password,setPassword]].map(([k,label,type,ph,val,setter]) => (
            <div key={k as string}>
              <label style={{ fontSize:11, fontWeight:600, color:"#A8A69E", textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:6 }}>{label as string}</label>
              <input type={type as string} value={val as string} onChange={e=>(setter as any)(e.target.value)} placeholder={ph as string} style={inputStyle}
                onFocus={e=>e.target.style.borderColor="#7C5CFC"} onBlur={e=>e.target.style.borderColor="rgba(0,0,0,0.08)"}
                onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
            </div>
          ))}
          <button onClick={handleSubmit} disabled={loading} style={{ padding:"12px", background:"#0E0D0B", color:"white", border:"none", borderRadius:10, fontSize:15, fontWeight:500, cursor:loading?"not-allowed":"pointer", opacity:loading?0.7:1, fontFamily:"'DM Sans',sans-serif", marginTop:4 }}>
            {loading ? "Creating account…" : "Create account →"}
          </button>
          <div style={{ textAlign:"center", fontSize:13, color:"#6B6960", fontWeight:300 }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color:"#7C5CFC", fontWeight:500, textDecoration:"none" }}>Log in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
