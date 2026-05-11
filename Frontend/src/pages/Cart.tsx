import React from "react";
import { Link } from "react-router-dom";
import { Trash2, Plus, Minus } from "lucide-react";
import { useCart } from "../contexts/CartContext";
import Footer from "../components/Footer";

export default function Cart() {
  const { items, remove, update, total, clear } = useCart();

  return (
    <div>
      <div style={{ paddingTop: 80, minHeight: "100vh", background: "#F7F6F2" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 48px 80px" }}>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 36, fontWeight: 800, letterSpacing: -2, marginBottom: 32 }}>Your Cart</h1>

          {items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Cart is empty</div>
              <div style={{ fontSize: 14, color: "#6B6960", fontWeight: 300, marginBottom: 24 }}>Browse our creator equipment shop.</div>
              <Link to="/shopping" style={{ display: "inline-block", padding: "11px 24px", background: "#0E0D0B", color: "white", borderRadius: 100, textDecoration: "none", fontSize: 14, fontWeight: 500 }}>Shop now →</Link>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
                {items.map(item => (
                  <div key={item.id} style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 64, height: 64, background: "#F7F6F2", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                      {item.image_url ? <img src={item.image_url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : <span style={{ fontSize: 28 }}>📦</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700 }}>{item.name}</div>
                      <div style={{ fontSize: 13, color: "#6B6960", fontWeight: 300 }}>${item.price} each</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button onClick={() => update(item.id, item.quantity - 1)} style={{ width: 28, height: 28, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={12}/></button>
                      <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, minWidth: 24, textAlign: "center" }}>{item.quantity}</span>
                      <button onClick={() => update(item.id, item.quantity + 1)} style={{ width: 28, height: 28, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={12}/></button>
                    </div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, minWidth: 64, textAlign: "right" }}>${(item.price * item.quantity).toFixed(2)}</div>
                    <button onClick={() => remove(item.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#A8A69E", padding: 4 }}><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>

              <div style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16, padding: "24px 28px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, marginBottom: 6 }}>
                  <span style={{ color: "#6B6960" }}>Subtotal</span>
                  <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>${total.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#A8A69E", marginBottom: 20, fontWeight: 300 }}>
                  <span>Shipping calculated at checkout</span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={clear} style={{ padding: "10px 18px", background: "transparent", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 100, fontSize: 13, color: "#6B6960", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Clear cart</button>
                  <button style={{ flex: 1, padding: "12px", background: "#0E0D0B", color: "white", border: "none", borderRadius: 100, fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Checkout →</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
