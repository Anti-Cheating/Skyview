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

  static async signup(credentials: SignupCredentials): Promise<AuthResponse['data']> {
    const response = await ApiService.post<AuthResponse['data']>(API_ENDPOINTS.AUTH.SIGNUP, credentials);
    if (response.success && response.data) {
      this.storeAuthData(response.data);
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
