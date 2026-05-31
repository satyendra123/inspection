import React, { createContext, useContext, useEffect, useState } from "react";
import { decodeToken, isTokenExpired } from "../utils/auth";
import axios from "axios";
const API = import.meta.env.VITE_API_BASE || "http://localhost:8060/api";
const DEMO_PERMISSIONS = [
  "view_user",
  "add_user",
  "create_user",
  "update_user",
  "edit_user",
  "delete_user",
  "change_password_user",
  "view_permission",
  "create_permission",
  "update_permission",
  "delete_permission",
  "view_company",
  "view_role",
  "create_role",
  "get_assign_role",
  "update_assign_role",
  "delete_assign_role",
  "view_category",
  "view_items",
  "view_items_po",
  "view_unit",
  "view_vendor",
  "view_teststep",
  "view_teststage",
  "assigninspection_po",
  "view_po",
  "view_project",
  "create_project",
  "update_project",
  "delete_project",
  "view_inspection",
  "view_report",
  "reschedule_inspection",
  "reschedule_inspection_item",
  "cancel_inspection",
  "cancel_inspection_item",
  "manage_inspection",
  "manage_all_inspections",
] as const;
type AuthState = {
  token: string | null;
  permissions: string[];
  user: any;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [permissions, setPermissions] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (token) {
      if (isTokenExpired(token)) {
        logout();
      } else {
        const decoded: any = decodeToken(token);

        setPermissions(decoded.permissions || []);
        setUser({
          id: decoded.userID,
          name: decoded.name,
          role: decoded.role,
        });
      }
    } else {
      setPermissions([...DEMO_PERMISSIONS]);
      setUser({
        id: 1,
        name: "John Doe",
        role: "Admin",
      });
    }
  }, [token]);

  const login = (jwtToken: string) => {
    localStorage.setItem("token", jwtToken);
    setToken(jwtToken);
  };

  const logout = async () => {
    try {
      if (token) {
        await axios.post(
          `${API}/user/signout`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch (e) { }

    localStorage.removeItem("token");
    setUser(null);
    setToken(null);
    setPermissions([]);
  };
  return (
    <AuthContext.Provider value={{ token, permissions, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;
