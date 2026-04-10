import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary, LoadingSpinner } from './components/common';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SnackbarProvider } from './contexts/SnackbarContext';
import Login from './components/Login/Login';
import Signup from './components/Signup/Signup';
import Dashboard from './components/Dashboard/Dashboard';
import AppLayout from './components/AppLayout/AppLayout';

/**
 * Detects if Skyview was opened from Falcon (via ?src=falcon param)
 * and stores the source in sessionStorage so login redirects correctly.
 */
function SourceDetector() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('src') === 'falcon') {
      sessionStorage.setItem('loginSource', 'falcon');
    }
  }, []);
  return null;
}

function getPostLoginRedirect(): string {
  return sessionStorage.getItem('loginSource') === 'falcon' ? '/dashboard' : '/app';
}

/**
 * Protected route — redirects to login if not authenticated
 */
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner fullScreen message="Loading..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * Auth route — redirects away from login/signup if already authenticated
 */
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner fullScreen message="Loading..." />;
  if (isAuthenticated) return <Navigate to={getPostLoginRedirect()} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <>
      <SourceDetector />
      <Routes>
        <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
        <Route path="/signup" element={<AuthRoute><Signup /></AuthRoute>} />
        {/* Falcon deep-link return page — simple "open desktop app" view */}
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        {/* Full web app with sidebar — for direct web logins */}
        <Route path="/app" element={<PrivateRoute><AppLayout /></PrivateRoute>} />
        <Route path="/" element={<Navigate to={getPostLoginRedirect()} replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SnackbarProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </SnackbarProvider>
    </ErrorBoundary>
  );
}
