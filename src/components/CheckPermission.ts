
import { useAuth } from "../context/AuthContext";

export const checkPermission = (permission: string): boolean => {
    const {  permissions } = useAuth();

  try {

    return Array.isArray(permissions)
      ? permissions.includes(permission)
      : false;
  } catch {
    return false;
  }
};
