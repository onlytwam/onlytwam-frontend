import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/authStore";

const ProtectedRoute = () => {
  const { hasValidToken } = useAuthStore();
  return hasValidToken() ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
