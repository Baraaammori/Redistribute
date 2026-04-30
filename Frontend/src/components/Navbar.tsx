import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShoppingCart, LogOut, LayoutDashboard, Menu, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  const isDashboard = location.pathname.startsWith("/dashboard");
  if (isDashboard) return null; // Dashboard has its own sidebar nav

  const links = [
    { to: "/", label: "Home" },
    { to: "/about", label: "About" },
    { to: "/pricing", label: "Pricing" },
    { to: "/shopping", label: "Shop" },
    { to: "/contact", label: "Contact" },
  ];

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      padding: "16px 48px", display: "flex", alignItems: "center", gap: 24,
      transition: "all 0.3s",
      ...(scrolled ? { background: "rgba(247,246,242,0.94)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(0,0,0,0.07)" } : {}),
    }}>
      <Link to="/" style={{ fontFamily: "'Syne',sans-serif", fontSize: 17, fontWeight: 800, letterSpacing: -0.5, color: "#0E0D0B", textDecoration: "none" }}>
        Redistribute
      </Link>

      <div style={{ display: "flex", gap: 2, flex: 1, marginLeft: 12 }}>
        {links.map(l => (
            <Link key={l.to} to={l.to} style={{
            padding: "7px 12px", fontSize: 13, borderRadius: 8, textDecoration: "none",
            color: location.pathname === l.to ? "white" : "#6B6960",
            fontWeight: location.pathname === l.to ? 600 : 400,
            background: location.pathname === l.to ? "#0E0D0B" : "transparent",
            transition: "all 0.14s",
            }}>{l.label}</Link>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Link to="/cart" style={{ position: "relative", color: "#6B6960", textDecoration: "none", padding: "8px 10px", borderRadius: 8, display: "flex", alignItems: "center" }}>
          <ShoppingCart size={18} />
          {count > 0 && <span style={{ position: "absolute", top: 2, right: 2, background: "#0E0D0B", color: "white", borderRadius: "50%", width: 16, height: 16, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{count}</span>}
        </Link>

        {user ? (
          <>
            <Link to="/dashboard" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#0E0D0B", color: "white", borderRadius: 100, fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
              <LayoutDashboard size={14} /> Dashboard
            </Link>
            <button onClick={() => { logout(); navigate("/"); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", background: "transparent", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 100, fontSize: 13, color: "#6B6960", cursor: "pointer" }}>
              <LogOut size={13} /> Sign out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={{ padding: "8px 16px", background: "transparent", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 100, fontSize: 13, color: "#6B6960", textDecoration: "none" }}>Log in</Link>
            <Link to="/register" style={{ padding: "8px 18px", background: "#0E0D0B", color: "white", borderRadius: 100, fontSize: 13, fontWeight: 500, textDecoration: "none" }}>Get started →</Link>
          </>
        )}
      </div>
    </nav>
  );
}
