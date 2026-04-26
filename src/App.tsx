import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ErrorBoundary, LoadingSpinner } from './components/common';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SnackbarProvider } from './contexts/SnackbarContext';
import Login from './components/Login/Login';
import Signup from './components/Signup/Signup';
import ForgotPassword from './components/Auth/ForgotPassword';
import ResetPassword from './components/Auth/ResetPassword';
import Dashboard from './components/Dashboard/Dashboard';
import AppLayout from './components/AppLayout/AppLayout';
import AppDashboard from './components/AppLayout/AppDashboard';
import AppInterviewList from './components/AppLayout/AppInterviewList';
import CreateInterviewPage from './components/AppLayout/CreateInterviewPage';
import MonitoringView from './components/Monitoring/MonitoringView';
import CandidateJoinPage from './components/AppLayout/CandidateJoinPage';
import TeamPage from './components/Team/TeamPage';
import ProfilePage from './components/Profile/ProfilePage';
import NotFoundPage from './components/NotFound/NotFoundPage';
import InviteAcceptPage from './components/Team/InviteAcceptPage';
import CheckInbox from './components/Auth/CheckInbox';
import VerifyEmail from './components/Auth/VerifyEmail';
import { isCompanyManagerRole } from './config/constants';

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
 * Role guard — redirects non-manager users away from pages that
 * require Owner / Admin / System Admin privileges (e.g. /users).
 * Belt-and-suspenders with the server's `requireRole` middleware: the
 * server is authoritative, but we don't want to let a Member even reach
 * the page URL by typing it manually.
 */
function CompanyManagerRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner fullScreen message="Loading..." />;
  if (!isCompanyManagerRole(user?.role)) {
    return <Navigate to="/" replace />;
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
        {/* Password reset — both are usable by signed-out users. The
            reset-password page still works when the user is signed in
            (e.g. someone clicks the link on a still-authenticated tab)
            — the server will log them out on success anyway. */}
        <Route path="/forgot-password" element={<AuthRoute><ForgotPassword /></AuthRoute>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Email verification — public, signed-out users land here.
            CheckInbox is the post-signup landing page; VerifyEmail
            consumes the token from the email link and signs the
            user in on success. */}
        <Route path="/check-inbox" element={<CheckInbox />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        {/* Public invite acceptance — invitee may not have an account yet */}
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
        {/* Falcon deep-link return page — simple "open desktop app" view */}
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        {/* Full web app with sidebar — nested routes render in AppLayout's <Outlet /> */}
        <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route index element={<AppDashboard />} />
          <Route path="interviews" element={<AppInterviewList />} />
          <Route path="interviews/new" element={<CreateInterviewPage />} />
          <Route path="interviews/:id/edit" element={<CreateInterviewPage />} />
          <Route path="interviews/:id/join" element={<CandidateJoinPage />} />
          <Route path="interviews/:id/monitor" element={<MonitoringView />} />
          <Route path="users" element={<CompanyManagerRoute><TeamPage /></CompanyManagerRoute>} />
          <Route path="profile" element={<ProfilePage />} />
          {/* Authenticated 404 — renders inside AppLayout so the user
              keeps the sidebar and can navigate out. */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        {/* Standalone 404 for unauthenticated visitors who hit a
            non-existent path. Replaces the old silent redirect to
            /login (which would loop signed-in users back to /). */}
        <Route path="*" element={<NotFoundPage />} />
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
