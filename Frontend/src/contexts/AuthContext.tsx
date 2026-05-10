import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "../lib/api";

interface User { id: string; email: string; name: string; plan: string; trial_ends_at?: string; }
interface AuthCtx { user: User | null; token: string | null; login: (email: string, password: string) => Promise<void>; register: (email: string, password: string, name: string) => Promise<void>; loginWithToken: (token: string) => Promise<void>; logout: () => void; loading: boolean; }

const AuthContext = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]   = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("authToken"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle OAuth redirect: ?token=xxx in URL after Google/Apple callback
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get("token");
    if (oauthToken) {
      localStorage.setItem("authToken", oauthToken);
      // Clean the token from the URL without a full page reload
      const cleanUrl = window.location.pathname + (params.toString().replace(/[?&]?token=[^&]+/, "") ? "?" + params.toString().replace(/[?&]?token=[^&]+/, "").replace(/^&/, "") : "");
      window.history.replaceState({}, "", cleanUrl || window.location.pathname);
      setToken(oauthToken);
      return; // the token state change will trigger the next useEffect
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (token) {
      api.auth.me()
        .then(setUser)
        .catch(() => { localStorage.removeItem("authToken"); setToken(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api.auth.signin({ email, password });
    localStorage.setItem("authToken", res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await api.auth.signup({ email, password, name });
    localStorage.setItem("authToken", res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const loginWithToken = async (t: string) => {
    localStorage.setItem("authToken", t);
    setToken(t);
  };

  const logout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userInfo");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, loginWithToken, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
