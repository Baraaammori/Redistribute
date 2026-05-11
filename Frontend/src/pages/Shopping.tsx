import React, { useState, useEffect } from "react";
import { useCart } from "../contexts/CartContext";
import { api } from "../lib/api";
import Footer from "../components/Footer";

export default function Shopping() {
  const [items, setItems]     = useState<any[]>([]);
  const [filter, setFilter]   = useState("All");
  const { add }               = useCart();
  const [added, setAdded]     = useState<string | null>(null);

  useEffect(() => { api.shop.list().then(setItems).catch(()=>{}); }, []);

  const categories = ["All", ...Array.from(new Set(items.map(i => i.category).filter(Boolean)))];
  const filtered   = filter === "All" ? items : items.filter(i => i.category === filter);

  const handleAdd = (item: any) => {
    add({ id: item.id, name: item.name, price: item.price, image_url: item.image_url });
    setAdded(item.id);
    setTimeout(() => setAdded(null), 1500);
  };

  return (
    <div>
      <div style={{ paddingTop: 80, background: "#F7F6F2", minHeight: "100vh" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 48px 80px" }}>
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#7C5CFC", textTransform: "uppercase", letterSpacing: 3, marginBottom: 10, fontFamily: "'Syne',sans-serif" }}>Shop</div>
            <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(30px,5vw,52px)", fontWeight: 800, letterSpacing: -2, marginBottom: 10 }}>Creator Equipment</h1>
            <p style={{ fontSize: 15, color: "#6B6960", fontWeight: 300 }}>Everything you need to level up your content setup.</p>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 32, flexWrap: "wrap" }}>
            {categories.map(c => (
              <button key={c} onClick={() => setFilter(c)} style={{ padding: "7px 16px", borderRadius: 100, fontSize: 13, fontWeight: filter === c ? 600 : 400, background: filter === c ? "#0E0D0B" : "white", color: filter === c ? "white" : "#6B6960", border: "1px solid rgba(0,0,0,0.08)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.14s" }}>{c}</button>
            ))}
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "#6B6960", fontSize: 14 }}>No products found.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
              {filtered.map(item => (
                <div key={item.id} style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16, overflow: "hidden", transition: "all 0.2s" }}
                  onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,0.08)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; }}>
                  <div style={{ background: "#F7F6F2", aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>
                    {item.image_url ? <img src={item.image_url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : "📦"}
                  </div>
                  <div style={{ padding: "16px" }}>
                    {item.category && <div style={{ fontSize: 10, color: "#A8A69E", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, fontWeight: 600 }}>{item.category}</div>}
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, marginBottom: 4, letterSpacing: -0.3 }}>{item.name}</div>
                    {item.description && <div style={{ fontSize: 12, color: "#6B6960", fontWeight: 300, lineHeight: 1.5, marginBottom: 12 }}>{item.description}</div>}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800 }}>${item.price}</span>
                      <button onClick={() => handleAdd(item)} style={{ padding: "7px 16px", background: added === item.id ? "#1A7A4A" : "#0E0D0B", color: "white", border: "none", borderRadius: 100, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "background 0.2s" }}>
                        {added === item.id ? "Added ✓" : "Add to cart"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
