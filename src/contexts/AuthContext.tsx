import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthService } from '../services/auth.service';
import type { User, LoginCredentials, SignupCredentials } from '../types/auth.types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
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
    const authData = await AuthService.signup(credentials);
    try {
      const userDetails = await AuthService.getCurrentUserDetails();
      setUser(userDetails);
    } catch {
      setUser(authData.user);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user && AuthService.isAuthenticated(),
      isLoading,
      login,
      signup,
      logout: handleLogout,
      refreshAuth,
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
