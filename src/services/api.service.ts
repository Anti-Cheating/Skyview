import { ENV } from '../config/env';
import { STORAGE_KEYS, ERROR_MESSAGES } from '../config/constants';
import type { ApiResponse, ApiError } from '../types/api.types';

export type ApiBaseUrl = 'auth' | string;

function getBaseUrl(type: ApiBaseUrl = 'auth'): string {
  if (type === 'auth') return ENV.AUTH_API_URL;
  return type;
}

function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

function clearAuthData(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_DATA);
}

async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  baseUrl: ApiBaseUrl = 'auth'
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
