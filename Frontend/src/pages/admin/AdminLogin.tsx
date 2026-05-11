import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const { token } = await api.admin.login(password);
      localStorage.setItem("adminToken", token);
      navigate("/admin");
    } catch {
      setError("Invalid admin password");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0A0F" }}>
      <div style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 40, width: "100%", maxWidth: 360 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: "white", textAlign: "center", marginBottom: 24 }}>Admin Portal</div>
        {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#EF4444", marginBottom: 14 }}>{error}</div>}
        <input type="password" placeholder="Admin password" value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", color: "white", fontFamily: "'DM Sans',sans-serif", fontSize: 14, outline: "none", marginBottom: 14 }}/>
        <button onClick={handleLogin} style={{ width: "100%", padding: 12, background: "#7C5CFC", color: "white", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Enter →</button>
      </div>
    </div>
  );
}
