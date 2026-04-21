import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ErrorBoundary, LoadingSpinner } from './components/common';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SnackbarProvider } from './contexts/SnackbarContext';
import { InterviewCacheProvider } from './contexts/InterviewCacheContext';
import Login from './components/Login/Login';
import Signup from './components/Signup/Signup';
import Dashboard from './components/Dashboard/Dashboard';
import AppLayout from './components/AppLayout/AppLayout';
import AppDashboard from './components/AppLayout/AppDashboard';
import AppInterviewList from './components/AppLayout/AppInterviewList';
import CreateInterviewPage from './components/AppLayout/CreateInterviewPage';
import MonitoringView from './components/Monitoring/MonitoringView';
import CandidateJoinPage from './components/AppLayout/CandidateJoinPage';

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
  return sessionStorage.getItem('loginSource') === 'falcon' ? '/dashboard' : '/';
}

/**
 * Reads ?returnTo= from the current URL and returns a safe relative path
 * to navigate to. Rejects absolute URLs to avoid open-redirect.
 */
function getReturnTo(): string | null {
  const raw = new URLSearchParams(window.location.search).get('returnTo');
  if (!raw) return null;
  // Only allow same-origin relative paths
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

/**
 * Protected route — redirects to login if not authenticated.
 * Preserves the originally requested URL via ?returnTo= so the user
 * lands back here after logging in.
 */
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <LoadingSpinner fullScreen message="Loading..." />;
  if (!isAuthenticated) {
    const here = location.pathname + location.search;
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(here)}`}
        replace
      />
    );
  }
  return <>{children}</>;
}

/**
 * Auth route — redirects away from login/signup if already authenticated.
 * Honors ?returnTo= so PrivateRoute → /login → original destination works.
 */
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner fullScreen message="Loading..." />;
  if (isAuthenticated) {
    const returnTo = getReturnTo();
    return <Navigate to={returnTo || getPostLoginRedirect()} replace />;
  }
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
        {/* Full web app with sidebar — nested routes render in AppLayout's <Outlet /> */}
        <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route index element={<AppDashboard />} />
          <Route path="interviews" element={<AppInterviewList />} />
          <Route path="interviews/new" element={<CreateInterviewPage />} />
          <Route path="interviews/:id/join" element={<CandidateJoinPage />} />
          <Route path="interviews/:id/monitor" element={<MonitoringView />} />
        </Route>
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
          <InterviewCacheProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </InterviewCacheProvider>
        </AuthProvider>
      </SnackbarProvider>
    </ErrorBoundary>
  );
}
