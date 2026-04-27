import { ENV } from '../config/env';
import { STORAGE_KEYS, ERROR_MESSAGES } from '../config/constants';
import type { ApiResponse, ApiError } from '../types/api.types';
import { pushHelperToken } from './helperBridge';

export type ApiBaseUrl = 'auth' | string;

function getBaseUrl(type: ApiBaseUrl = 'auth'): string {
  if (type === 'auth') return ENV.AUTH_API_URL;
  return type;
}

function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

function clearAuthData(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_DATA);
}

// Single in-flight refresh promise — multiple concurrent 401s share it so
// we don't burn N refresh-token round-trips when N requests fail at once.
let _refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (_refreshInFlight) return _refreshInFlight;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  _refreshInFlight = (async () => {
    try {
      const resp = await fetch(`${ENV.AUTH_API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!resp.ok) return null;
      const body = await resp.json();
      const newAccess = body?.data?.accessToken || body?.accessToken;
      const newRefresh = body?.data?.refreshToken || body?.refreshToken;
      if (!newAccess) return null;
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccess);
      if (newRefresh) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefresh);
      // Push the fresh token into the running helper daemon so its
      // mid-session pulse / windows / image-analysis / R2 upload calls
      // stop using the stale JWT. Fire-and-forget — daemon may not be
      // running, that's fine.
      pushHelperToken(newAccess).catch(() => {});
      return newAccess;
    } catch {
      return null;
    } finally {
      _refreshInFlight = null;
    }
  })();
  return _refreshInFlight;
}

async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  baseUrl: ApiBaseUrl = 'auth',
  _retried = false,
): Promise<ApiResponse<T>> {
  const base = getBaseUrl(baseUrl);
  const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
  const token = getAccessToken();
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const requestOptions: RequestInit = { ...options, headers };

  try {
    const response = await fetch(url, requestOptions);
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    let data: any;
    if (isJson) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text ? { message: text } : {};
    }

    if (response.status === 401) {
      // First 401: try a single refresh-and-retry. Don't refresh on the
      // /auth/refresh endpoint itself or we'd loop forever.
      if (!_retried && !endpoint.includes('/auth/refresh')) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          return apiRequest<T>(endpoint, options, baseUrl, true);
        }
      }
      clearAuthData();
      window.dispatchEvent(new CustomEvent('auth:logout'));
      throw { message: ERROR_MESSAGES.UNAUTHORIZED, status: 401, data } as ApiError;
    }
    if (response.status === 403) throw { message: ERROR_MESSAGES.FORBIDDEN, status: 403, data } as ApiError;
    if (response.status === 404) throw { message: ERROR_MESSAGES.NOT_FOUND, status: 404, data } as ApiError;
    if (response.status >= 500) throw { message: ERROR_MESSAGES.SERVER_ERROR, status: response.status, data } as ApiError;
    if (!response.ok) throw { message: data.message || data.error || `Request failed with status ${response.status}`, status: response.status, data } as ApiError;

    return { success: true, data: data.data || data, message: data.message };
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw { message: ERROR_MESSAGES.NETWORK_ERROR, status: 0 } as ApiError;
    }
    if (error.status !== undefined) throw error;
    throw { message: error.message || ERROR_MESSAGES.SERVER_ERROR, status: error.status } as ApiError;
  }
}

export class ApiService {
  static async get<T = any>(endpoint: string, options?: RequestInit, baseUrl: ApiBaseUrl = 'auth'): Promise<ApiResponse<T>> {
    return apiRequest<T>(endpoint, { ...options, method: 'GET' }, baseUrl);
  }
  static async post<T = any>(endpoint: string, body?: any, options?: RequestInit, baseUrl: ApiBaseUrl = 'auth'): Promise<ApiResponse<T>> {
    const isFormData = body instanceof FormData;
    return apiRequest<T>(endpoint, { ...options, method: 'POST', body: isFormData ? body : (body ? JSON.stringify(body) : undefined) }, baseUrl);
  }
  static async put<T = any>(endpoint: string, body?: any, options?: RequestInit, baseUrl: ApiBaseUrl = 'auth'): Promise<ApiResponse<T>> {
    const isFormData = body instanceof FormData;
    return apiRequest<T>(endpoint, { ...options, method: 'PUT', body: isFormData ? body : (body ? JSON.stringify(body) : undefined) }, baseUrl);
  }
  static async patch<T = any>(endpoint: string, body?: any, options?: RequestInit, baseUrl: ApiBaseUrl = 'auth'): Promise<ApiResponse<T>> {
    const isFormData = body instanceof FormData;
    return apiRequest<T>(endpoint, { ...options, method: 'PATCH', body: isFormData ? body : (body ? JSON.stringify(body) : undefined) }, baseUrl);
  }
  static async delete<T = any>(endpoint: string, options?: RequestInit, baseUrl: ApiBaseUrl = 'auth'): Promise<ApiResponse<T>> {
    return apiRequest<T>(endpoint, { ...options, method: 'DELETE' }, baseUrl);
  }
}
