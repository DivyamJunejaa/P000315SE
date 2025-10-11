import React, { createContext, useContext, useMemo, useState } from "react";

type User = {
  userId: number;   // required
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  organisation?: string;
  avatarUrl?: string | null;
  displayName?: string;
};
type Ctx = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (u: User | null) => void;
  loading: boolean;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { authLogin } = await import("../services/api");
      const { token, user } = await authLogin({ email, password });
      setToken(token);
      setUser(user);
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userId");
    localStorage.removeItem('subscriptionData');
    localStorage.removeItem('userPlan');
    localStorage.removeItem('planId');
    localStorage.removeItem('projectId');
  };

  const value = useMemo(() => ({ user, token, isAuthenticated: !!token, login, logout, setUser, loading }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
