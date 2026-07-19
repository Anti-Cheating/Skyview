import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthService } from '../services/auth.service';
import { startTokenAutoRefresh, stopTokenAutoRefresh } from '../services/api.service';
import type { User, LoginCredentials, SignupCredentials } from '../types/auth.types';
import { trackEvent } from '../lib/analytics';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  // Signup now returns the verification-pending shape so the caller
  // (Signup page) can route to /check-inbox. No user is set on the
  // context — they're not logged in until they verify.
  signup: (credentials: SignupCredentials) => Promise<{
    email: string;
  }>;
  /**
   * Sign in / sign up via Google. Returns `requiresOnboarding=true`
   * for brand-new users so the caller can route them to
   * /onboarding/workspace; otherwise behaves like login.
   */
  googleLogin: (idToken: string) => Promise<{ requiresOnboarding: boolean }>;
  /**
   * Finishes Google sign-up by creating the workspace. Sets the
   * user's company_id on success so PrivateRoute releases the
   * onboarding gate.
   */
  completeOnboarding: (companyName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  /**
   * Merge a partial user into the cached user — no API call, no
   * isLoading toggle. Use after a PATCH that returned the updated
   * row, instead of calling refreshAuth() (which would refetch and
   * cause a visible blink while isLoading is true).
   */
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      if (AuthService.isAuthenticated()) {
        try {
          const userDetails = await AuthService.getCurrentUserDetails();
          setUser(userDetails);
        } catch (error) {
          console.warn('Failed to fetch user details, using stored data:', error);
          const currentUser = AuthService.getCurrentUser();
          setUser(currentUser);
        }
      } else {
        setUser(null);
        AuthService.clearAuthData();
      }
    } catch (error) {
      console.error('Error refreshing auth:', error);
      setUser(null);
      AuthService.clearAuthData();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await AuthService.logout();
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setUser(null);
    }
  }, []);

  // Check auth on mount
  useEffect(() => { refreshAuth(); }, [refreshAuth]);

  // Listen for auth:logout custom event
  useEffect(() => {
    const handleLogoutEvent = () => setUser(null);
    window.addEventListener('auth:logout', handleLogoutEvent);
    return () => window.removeEventListener('auth:logout', handleLogoutEvent);
  }, []);

  // Periodic token expiry check (every 60s)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (!AuthService.isAuthenticated()) handleLogout();
    }, 60000);
    return () => clearInterval(interval);
  }, [user, handleLogout]);

  // Proactively refresh the access token before it expires (every ~3.5h of a
  // 4h token) so the session lasts the full 7-day refresh window and the socket
  // / PDF / feed calls always have a valid token. Stops on logout.
  useEffect(() => {
    if (user) startTokenAutoRefresh();
    else stopTokenAutoRefresh();
    return () => stopTokenAutoRefresh();
  }, [user]);

  const login = async (credentials: LoginCredentials) => {
    const authData = await AuthService.login(credentials);
    try {
      const userDetails = await AuthService.getCurrentUserDetails();
      setUser(userDetails);
    } catch {
      setUser(authData.user);
    }
  };

  const signup = async (credentials: SignupCredentials) => {
    const result = await AuthService.signup(credentials);
    // Conversion: a new account was created (email/password). Fires the
    // GA4 `sign_up` key event, attributed across the marketing→app funnel.
    trackEvent('sign_up', { method: 'email' });
    // Don't set the user on context — verification still pending.
    // Caller routes to /check-inbox where the email address is
    // displayed and the user waits for the link.
    return { email: result.user.email };
  };

  const googleLogin = async (idToken: string) => {
    const data = await AuthService.googleLogin(idToken);
    // Conversion: a brand-new Google user counts as a `sign_up`.
    if (data.requiresOnboarding) trackEvent('sign_up', { method: 'google' });
    // Set the user immediately — they're authenticated regardless of
    // onboarding state. The route guard handles the rest.
    setUser(data.user);
    return { requiresOnboarding: !!data.requiresOnboarding };
  };

  const completeOnboarding = async (companyName: string) => {
    const updated = await AuthService.completeOnboarding(companyName);
    // Merge into context so PrivateRoute's `requiresOnboarding`
    // derivation flips to false on the next render.
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user && AuthService.isAuthenticated(),
      isLoading,
      login,
      signup,
      googleLogin,
      completeOnboarding,
      logout: handleLogout,
      refreshAuth,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
