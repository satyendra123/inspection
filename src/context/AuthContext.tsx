import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { decodeToken, isTokenExpired, type DecodedToken } from "../utils/auth";
import axios from "axios";
const API = import.meta.env.VITE_API_BASE || "http://localhost:8060/api";
type AuthUser = {
  id: number;
  name: string;
  role: string;
};
type AuthState = {
  token: string | null;
  permissions: string[];
  user: AuthUser | null;
  login: (token: string) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [permissions, setPermissions] = useState<string[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await axios.post(
          `${API}/user/signout`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch {
      // Ignore sign-out failures and clear local state anyway.
    }

    localStorage.removeItem("token");
    setUser(null);
    setToken(null);
    setPermissions([]);
  }, [token]);

  useEffect(() => {
    if (!token) {
      setPermissions([]);
      setUser(null);
      return;
    }

    if (isTokenExpired(token)) {
      void logout();
      return;
    }

    const decoded: DecodedToken | null = decodeToken(token);
    if (!decoded) {
      void logout();
      return;
    }

    setPermissions(Array.isArray(decoded.permissions) ? decoded.permissions : []);
    setUser({
      id: decoded.userID,
      name: decoded.name,
      role: decoded.role,
    });
  }, [token, logout]);

  const login = (jwtToken: string) => {
    localStorage.setItem("token", jwtToken);
    setToken(jwtToken);
  };

  return (
    <AuthContext.Provider value={{ token, permissions, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;
