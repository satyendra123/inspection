
import { decodeToken } from "../utils/auth";

export const checkPermission = (permission: string): boolean => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return false;

    const decoded = decodeToken(token);
    return Array.isArray(decoded?.permissions) ? decoded.permissions.includes(permission) : false;
  } catch {
    return false;
  }
};
