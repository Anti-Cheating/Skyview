import { ApiService } from './api.service';
import { API_ENDPOINTS, STORAGE_KEYS } from '../config/constants';
import type { User, AuthResponse, LoginCredentials, SignupCredentials } from '../types/auth.types';

export class AuthService {
  static async login(credentials: LoginCredentials): Promise<AuthResponse['data']> {
    const response = await ApiService.post<AuthResponse['data']>(API_ENDPOINTS.AUTH.LOGIN, credentials);
    if (response.success && response.data) {
      this.storeAuthData(response.data);
      return response.data;
    }
    throw new Error(response.message || 'Login failed');
  }

  /**
   * Signup now returns a verification-required response — the server
   * creates the user but does NOT issue tokens. The caller routes
   * the user to /check-inbox where they wait for the verification
   * email. Auth tokens are handed out by /auth/verify-email after
   * the user clicks the link.
   */
  static async signup(credentials: SignupCredentials): Promise<{
    user: { id: string; email: string; first_name: string; last_name: string };
    requiresVerification: true;
  }> {
    const response = await ApiService.post<{
      user: { id: string; email: string; first_name: string; last_name: string };
      requiresVerification: true;
    }>(API_ENDPOINTS.AUTH.SIGNUP, credentials);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Signup failed');
  }

  static async logout(): Promise<void> {
    try {
      await ApiService.post(API_ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      this.clearAuthData();
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  }

  static getCurrentUser(): User | null {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    if (!userStr) return null;
    try { return JSON.parse(userStr); } catch { return null; }
  }

  static async getCurrentUserDetails(): Promise<User> {
    const response = await ApiService.get<{ user: User } | User>(API_ENDPOINTS.AUTH.PROFILE);
    if (response.success && response.data) {
      const user = (response.data as any).user || response.data;
      if (user) localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
      return user as User;
    }
    throw new Error(response.message || 'Failed to fetch user details');
  }

  static async getDesktopCode(): Promise<{ code: string; expiresIn: number }> {
    const response = await ApiService.post<{ code: string; expiresIn: number }>(API_ENDPOINTS.AUTH.DESKTOP_CODE);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to generate desktop code');
  }

  /**
   * Kick off the forgot-password flow. Server always returns 200 with
   * a generic message regardless of whether the email is on file —
   * we don't leak account existence. The frontend just shows "check
   * your inbox" no matter what.
   */
  static async requestPasswordReset(email: string): Promise<string> {
    const response = await ApiService.post<{ message?: string }>(
      '/auth/forgot-password',
      { email },
    );
    return (
      response.message ||
      'If an account exists for that email, a reset link has been sent.'
    );
  }

  /**
   * Consume a reset token and set a new password. Server invalidates
   * every refresh token for the user on success, so active sessions
   * are logged out.
   */
  static async resetPassword(token: string, password: string): Promise<void> {
    const response = await ApiService.post<{ message?: string }>(
      '/auth/reset-password',
      { token, password },
    );
    if (!response.success) {
      throw new Error(response.message || 'Failed to reset password');
    }
  }

  /**
   * Consume the verification token from the email link. On success
   * the server returns the same shape as login (user + tokens), so
   * we store auth data immediately and treat this as a sign-in too.
   */
  static async verifyEmail(token: string): Promise<AuthResponse['data']> {
    const response = await ApiService.post<AuthResponse['data']>(
      '/auth/verify-email',
      { token },
    );
    if (!response.success || !response.data) {
      throw new Error(response.message || 'This verification link is no longer valid');
    }
    AuthService.storeAuthData(response.data);
    return response.data;
  }

  /**
   * Sign in (or sign up) with Google. Posts the ID token from the
   * Google popup; server figures out signin vs signup based on what's
   * already in the DB. Returns the same shape as login plus an extra
   * `requiresOnboarding` flag — true only for brand-new users (and
   * the rare resume-mid-onboarding case).
   */
  static async googleLogin(idToken: string): Promise<AuthResponse['data'] & {
    requiresOnboarding?: boolean;
  }> {
    const response = await ApiService.post<AuthResponse['data'] & {
      requiresOnboarding?: boolean;
    }>('/auth/google', { idToken });
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Google sign-in failed');
    }
    AuthService.storeAuthData(response.data);
    return response.data;
  }

  /**
   * Finish the Google sign-up flow by naming the workspace. JWT
   * required (the access token from googleLogin). Returns the
   * updated user shape — caller should call AuthContext.refreshAuth
   * afterwards so company_id is reflected app-wide.
   */
  static async completeOnboarding(companyName: string): Promise<User> {
    const response = await ApiService.post<{ user: User }>(
      '/auth/onboarding/workspace',
      { companyName },
    );
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create workspace');
    }
    const user = response.data.user;
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    return user;
  }

  /**
   * Ask the server for a fresh verification email. Always succeeds
   * (the endpoint is anti-enumeration and silent on unknown / already-
   * verified addresses), so the UI just shows a "check your inbox"
   * confirmation regardless.
   */
  static async resendVerification(email: string): Promise<string> {
    const response = await ApiService.post<{ message?: string }>(
      '/auth/resend-verification',
      { email },
    );
    return (
      response.message ||
      'If an unverified account exists for that email, a verification link has been sent.'
    );
  }

  static getAccessToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  static storeAuthData(authData: AuthResponse['data']): void {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, authData.accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, authData.refreshToken);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(authData.user));
  }

  static clearAuthData(): void {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
  }

  static isAuthenticated(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) return false;
      return Date.now() < (decoded.exp * 1000 - 60000);
    } catch { return false; }
  }

  private static decodeToken(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }
}
