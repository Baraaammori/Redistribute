import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { api } from "../../lib/api";

const CATEGORIES = ["Lighting", "Audio", "Camera", "Stabilization", "Backgrounds", "Accessories"];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name:"", price:"", category:"Lighting", description:"", stock:"0", image_url:"" });

  const load = () => api.shop.list().then(setItems).catch(()=>{});
  useEffect(() => { load(); }, []);

  const logout = () => { localStorage.removeItem("adminToken"); navigate("/admin/login"); };

  const openCreate = () => { setForm({ name:"", price:"", category:"Lighting", description:"", stock:"0", image_url:"" }); setEditing(null); setShowForm(true); };
  const openEdit   = (item: any) => { setForm({ name:item.name, price:String(item.price), category:item.category||"Lighting", description:item.description||"", stock:String(item.stock||0), image_url:item.image_url||"" }); setEditing(item); setShowForm(true); };

  const save = async () => {
    const payload = { ...form, price: parseFloat(form.price), stock: parseInt(form.stock) };
    if (editing) await api.shop.update(editing.id, payload);
    else await api.shop.create(payload);
    setShowForm(false); load();
  };

  const del = async (id: string) => { if (window.confirm("Delete this product?")) { await api.shop.delete(id); load(); } };

  const inputStyle: React.CSSProperties = { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"9px 12px", color:"white", fontFamily:"'DM Sans',sans-serif", fontSize:13, outline:"none", width:"100%" };
  const labelStyle: React.CSSProperties = { fontSize:10, fontWeight:600, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:5 };

  return (
    <div style={{ minHeight:"100vh", background:"#0A0A0F", color:"white" }}>
      {/* Top bar */}
      <div style={{ background:"#111118", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"16px 32px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:800 }}>Admin Portal</div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={openCreate} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 18px", background:"#7C5CFC", color:"white", border:"none", borderRadius:100, fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:500 }}><Plus size={14}/> Add product</button>
          <button onClick={logout} style={{ padding:"8px 16px", background:"transparent", border:"1px solid rgba(255,255,255,0.1)", borderRadius:100, fontSize:13, color:"rgba(255,255,255,0.4)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Sign out</button>
        </div>
      </div>

      <div style={{ padding:32 }}>
        <div style={{ marginBottom:24, fontSize:14, color:"rgba(255,255,255,0.4)" }}>{items.length} products</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:16 }}>
          {items.map(item => (
            <div key={item.id} style={{ background:"#111118", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, overflow:"hidden" }}>
              <div style={{ background:"rgba(255,255,255,0.03)", height:120, display:"flex", alignItems:"center", justifyContent:"center", fontSize:40 }}>
                {item.image_url ? <img src={item.image_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : "📦"}
              </div>
              <div style={{ padding:"14px 16px" }}>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>{item.category}</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, marginBottom:4 }}>{item.name}</div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800 }}>${item.price}</span>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>Stock: {item.stock}</span>
                </div>
                <div style={{ display:"flex", gap:8, marginTop:14 }}>
                  <button onClick={()=>openEdit(item)} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"7px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}><Pencil size={12}/> Edit</button>
                  <button onClick={()=>del(item.id)} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"7px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.15)", borderRadius:8, color:"#EF4444", cursor:"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}><Trash2 size={12}/> Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
          <div style={{ background:"#111118", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:32, width:"100%", maxWidth:460 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800 }}>{editing ? "Edit product" : "New product"}</div>
              <button onClick={()=>setShowForm(false)} style={{ background:"transparent", border:"none", color:"rgba(255,255,255,0.4)", cursor:"pointer" }}><X size={18}/></button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {[["name","Product name"],["price","Price ($)"],["image_url","Image URL (optional)"]].map(([k,l]) => (
                <div key={k}><label style={labelStyle}>{l}</label><input value={(form as any)[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} style={inputStyle}/></div>
              ))}
              <div>
                <label style={labelStyle}>Category</label>
                <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} style={{ ...inputStyle, cursor:"pointer" }}>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Description</label><textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} rows={3} style={{ ...inputStyle, resize:"vertical" }}/></div>
              <div><label style={labelStyle}>Stock</label><input type="number" value={form.stock} onChange={e=>setForm(p=>({...p,stock:e.target.value}))} style={inputStyle}/></div>
              <div style={{ display:"flex", gap:10, marginTop:8 }}>
                <button onClick={()=>setShowForm(false)} style={{ flex:1, padding:"10px", background:"transparent", border:"1px solid rgba(255,255,255,0.1)", borderRadius:100, color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:14, fontFamily:"'DM Sans',sans-serif" }}>Cancel</button>
                <button onClick={save} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"10px", background:"#7C5CFC", color:"white", border:"none", borderRadius:100, fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:500 }}><Check size={14}/> {editing ? "Save changes" : "Create product"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
