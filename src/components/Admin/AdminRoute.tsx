import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../common';
import { isSystemAdmin } from '../../config/constants';

/** Gate the /admin console to Trueyy-internal System Admins only. Same auth as
 *  the rest of the app — just a role check on top. */
export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  if (isLoading) return <LoadingSpinner fullScreen message="Loading..." />;
  if (!isAuthenticated) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (!isSystemAdmin(user?.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
