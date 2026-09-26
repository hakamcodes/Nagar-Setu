import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../state/AuthContext.jsx";

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="section min-h-[50vh]">Checking session...</div>;
  }

  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to="/complaints" replace />;
  }

  return children;
}
