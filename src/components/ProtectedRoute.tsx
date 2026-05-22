import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({
  permission,
  permissions: requiredPermissions = [],
}: {
  permission?: string;
  permissions?: string[];
}) => {
  const { token, permissions: userPermissions } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />
  }

  const required = permission ? [permission] : requiredPermissions;
  if (required.length > 0 && !required.some((item) => userPermissions.includes(item))) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
};

export default ProtectedRoute;
