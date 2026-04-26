import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ErrorBoundary, LoadingSpinner } from './components/common';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CompanyProvider } from './contexts/CompanyContext';
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
import OnboardingWorkspace from './components/Auth/OnboardingWorkspace';
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
 * `requiresOnboarding` is derived from the user shape — no extra
 * server flag needed. It's true only for users that signed up via
 * Google but haven't picked a workspace name yet (no company_id).
 * Candidates are global identities with no workspace concept, so
 * they're explicitly excluded.
 */
function userNeedsOnboarding(user: { role?: string; company_id?: string | null } | null): boolean {
  if (!user) return false;
  if (user.role === 'Candidate') return false;
  return !user.company_id;
}

/**
 * Protected route — redirects to login if not authenticated.
 * Preserves the originally requested URL via ?returnTo= so the user
 * lands back here after logging in.
 *
 * Also gates the workspace-onboarding flow: if a Google sign-up user
 * hasn't named their workspace yet, every authenticated route bounces
 * them to /onboarding/workspace until they do.
 */
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
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
  if (userNeedsOnboarding(user)) {
    return <Navigate to="/onboarding/workspace" replace />;
  }
  return <>{children}</>;
}

/**
 * OnboardingRoute — opposite gate to PrivateRoute. Authenticated users
 * who already have a workspace shouldn't be on /onboarding/workspace,
 * so we kick them to the dashboard. Unauthenticated users go to login.
 */
function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <LoadingSpinner fullScreen message="Loading..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!userNeedsOnboarding(user)) return <Navigate to="/" replace />;
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
        {/* Workspace onboarding — Google sign-up step 2. Authenticated
            but pre-workspace; OnboardingRoute kicks already-onboarded
            users back to /. */}
        <Route
          path="/onboarding/workspace"
          element={<OnboardingRoute><OnboardingWorkspace /></OnboardingRoute>}
        />
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

// Read once at module init — Vite inlines `import.meta.env.*` at build
// time, so dynamic env changes after build are not picked up.
const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';

export default function App() {
  // GoogleOAuthProvider needs a client ID at construction time; if the
  // env var is missing we still mount it (with a sentinel value) so the
  // app boots, but the Login/Signup pages hide the Google button when
  // GOOGLE_CLIENT_ID is empty so users don't click a broken control.
  return (
    <ErrorBoundary>
      <SnackbarProvider>
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || 'unset'}>
          <AuthProvider>
            <CompanyProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </CompanyProvider>
          </AuthProvider>
        </GoogleOAuthProvider>
      </SnackbarProvider>
    </ErrorBoundary>
  );
}
