import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ permission }: { permission?: string }) => {
  const { token, permissions } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (permission && !permissions.includes(permission)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
};

export default ProtectedRoute;
