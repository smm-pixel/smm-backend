import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

const AuthCtx = createContext(null);
// Non-sensitive display cache only. Auth itself is enforced by the HttpOnly
// cookie on the backend; NO token is ever kept in localStorage.
const USER_KEY = "bumdes_stok_user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // On mount, verify the session against the shared backend auth endpoint.
  useEffect(() => {
    api.get("/auth/me").then((r) => {
      setUser(r.data);
      try { localStorage.setItem(USER_KEY, JSON.stringify(r.data)); } catch {}
    }).catch(() => {
      try { localStorage.removeItem(USER_KEY); } catch {}
      setUser(null);
    }).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const r = await api.post("/auth/login", { username, password });
    try { localStorage.setItem(USER_KEY, JSON.stringify(r.data.user)); } catch {}
    setUser(r.data.user);
    return r.data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch {}
    try { localStorage.removeItem(USER_KEY); } catch {}
    setUser(null);
    window.location.href = "/login";
  }, []);

  const value = useMemo(() => ({ user, login, logout, loading }), [user, login, logout, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export const can = (user, ...roles) => user && roles.includes(user.role);
