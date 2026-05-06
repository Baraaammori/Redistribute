import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

import Navbar    from "./components/Navbar";
import Landing   from "./pages/Landing/Landing";
import About     from "./pages/Landing/About";
import Pricing   from "./pages/Landing/Pricing";
import Contact   from "./pages/Landing/Contact";
import Terms     from "./pages/Landing/Terms";
import Privacy   from "./pages/Landing/Privacy";
import Login     from "./pages/auth/Login";
import Register  from "./pages/auth/Register";
import Dashboard from "./pages/Dashboard/Dashboard";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      Loading…
    </div>
  );
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          {/* Public */}
          <Route path="/"        element={<Landing />} />
          <Route path="/about"   element={<About />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms"   element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />

          {/* Auth */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Dashboard (protected) */}
          <Route path="/dashboard/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
