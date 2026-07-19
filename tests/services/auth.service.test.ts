import { describe, test, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();
vi.mock('../../src/services/api.service', () => ({
  ApiService: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    delete: (...a: unknown[]) => del(...a),
  },
}));

import { AuthService } from '../../src/services/auth.service';
import { STORAGE_KEYS } from '../../src/config/constants';

const authData = {
  user: { id: 'u1', email: 'a@b.com' },
  accessToken: 'acc',
  refreshToken: 'ref',
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('AuthService.login', () => {
  test('posts credentials, stores tokens + user, returns data', async () => {
    post.mockResolvedValue({ success: true, data: authData });
    const res = await AuthService.login({ email: 'a@b.com', password: 'p' } as never);
    expect(post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', password: 'p' });
    expect(res).toBe(authData);
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBe('acc');
    expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBe('ref');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_DATA)!)).toEqual(authData.user);
  });

  test('throws when the server reports failure', async () => {
    post.mockResolvedValue({ success: false, message: 'bad creds' });
    await expect(AuthService.login({} as never)).rejects.toThrow('bad creds');
  });
});

describe('AuthService.signup', () => {
  test('returns the verification-pending payload without storing tokens', async () => {
    const data = { user: { id: 'u1', email: 'a@b.com' }, requiresVerification: true };
    post.mockResolvedValue({ success: true, data });
    const res = await AuthService.signup({} as never);
    expect(post).toHaveBeenCalledWith('/auth/signup', {});
    expect(res).toBe(data);
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
  });
});

describe('AuthService.logout', () => {
  test('clears auth data and emits auth:logout even if the API call fails', async () => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'acc');
    post.mockRejectedValue(new Error('network'));
    const onLogout = vi.fn();
    window.addEventListener('auth:logout', onLogout);
    await AuthService.logout();
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
    expect(onLogout).toHaveBeenCalled();
    window.removeEventListener('auth:logout', onLogout);
  });
});

describe('AuthService.getCurrentUser', () => {
  test('parses the cached user; returns null on absent / malformed JSON', () => {
    expect(AuthService.getCurrentUser()).toBeNull();
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify({ id: 'u1' }));
    expect(AuthService.getCurrentUser()).toEqual({ id: 'u1' });
    localStorage.setItem(STORAGE_KEYS.USER_DATA, '{not json');
    expect(AuthService.getCurrentUser()).toBeNull();
  });
});

describe('AuthService.getCurrentUserDetails', () => {
  test('unwraps a { user } envelope and caches it', async () => {
    get.mockResolvedValue({ success: true, data: { user: { id: 'u1' } } });
    const user = await AuthService.getCurrentUserDetails();
    expect(get).toHaveBeenCalledWith('/auth/me');
    expect(user).toEqual({ id: 'u1' });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_DATA)!)).toEqual({ id: 'u1' });
  });

  test('accepts a bare user object too', async () => {
    get.mockResolvedValue({ success: true, data: { id: 'u2' } });
    expect(await AuthService.getCurrentUserDetails()).toEqual({ id: 'u2' });
  });
});

describe('AuthService password + verification flows', () => {
  test('requestPasswordReset returns the server message, falling back to a generic one', async () => {
    post.mockResolvedValue({ success: true, message: 'sent' });
    expect(await AuthService.requestPasswordReset('a@b.com')).toBe('sent');
    expect(post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'a@b.com' });
    post.mockResolvedValue({ success: true });
    expect(await AuthService.requestPasswordReset('a@b.com')).toMatch(/reset link/i);
  });

  test('resetPassword posts token+password and throws on failure', async () => {
    post.mockResolvedValue({ success: true });
    await AuthService.resetPassword('tok', 'newpw');
    expect(post).toHaveBeenCalledWith('/auth/reset-password', { token: 'tok', password: 'newpw' });
    post.mockResolvedValue({ success: false, message: 'expired' });
    await expect(AuthService.resetPassword('tok', 'newpw')).rejects.toThrow('expired');
  });

  test('verifyEmail stores auth data on success', async () => {
    post.mockResolvedValue({ success: true, data: authData });
    await AuthService.verifyEmail('tok');
    expect(post).toHaveBeenCalledWith('/auth/verify-email', { token: 'tok' });
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBe('acc');
  });

  test('verifyEmail throws on an invalid link', async () => {
    post.mockResolvedValue({ success: false });
    await expect(AuthService.verifyEmail('tok')).rejects.toThrow(/no longer valid/i);
  });
});

describe('AuthService.googleLogin', () => {
  test('posts the access token and stores the returned session', async () => {
    post.mockResolvedValue({ success: true, data: { ...authData, requiresOnboarding: true } });
    const res = await AuthService.googleLogin('gtok');
    expect(post).toHaveBeenCalledWith('/auth/google', { accessToken: 'gtok' });
    expect(res.requiresOnboarding).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBe('acc');
  });
});

describe('AuthService avatar', () => {
  test('uploadAvatar posts multipart FormData and caches the user', async () => {
    post.mockResolvedValue({ success: true, data: { user: { id: 'u1', avatar_url: 'x' } } });
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const user = await AuthService.uploadAvatar(file);
    expect(post).toHaveBeenCalledWith('/auth/me/avatar', expect.any(FormData));
    expect((post.mock.calls[0][1] as FormData).get('avatar')).toBe(file);
    expect(user).toEqual({ id: 'u1', avatar_url: 'x' });
  });

  test('deleteAvatar deletes and caches the returned user', async () => {
    del.mockResolvedValue({ success: true, data: { user: { id: 'u1', avatar_url: null } } });
    const user = await AuthService.deleteAvatar();
    expect(del).toHaveBeenCalledWith('/auth/me/avatar');
    expect(user).toEqual({ id: 'u1', avatar_url: null });
  });
});

describe('AuthService.completeOnboarding', () => {
  test('posts the workspace name and caches the updated user', async () => {
    post.mockResolvedValue({ success: true, data: { user: { id: 'u1', company_id: 'c1' } } });
    const user = await AuthService.completeOnboarding('Acme');
    expect(post).toHaveBeenCalledWith('/auth/onboarding/workspace', { companyName: 'Acme' });
    expect(user).toEqual({ id: 'u1', company_id: 'c1' });
  });
});

describe('AuthService token helpers', () => {
  test('getAccessToken / getRefreshToken read localStorage', () => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'acc');
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'ref');
    expect(AuthService.getAccessToken()).toBe('acc');
    expect(AuthService.getRefreshToken()).toBe('ref');
  });

  test('clearAuthData wipes all three keys', () => {
    AuthService.storeAuthData(authData as never);
    AuthService.clearAuthData();
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.USER_DATA)).toBeNull();
  });

  test('isAuthenticated is false without a token, true for a non-expired JWT', () => {
    expect(AuthService.isAuthenticated()).toBe(false);
    const future = Math.floor(Date.now() / 1000) + 3600;
    const payload = btoa(JSON.stringify({ exp: future })).replace(/=/g, '');
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, `h.${payload}.s`);
    expect(AuthService.isAuthenticated()).toBe(true);
  });

  test('isAuthenticated is false for an expired JWT', () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const payload = btoa(JSON.stringify({ exp: past })).replace(/=/g, '');
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, `h.${payload}.s`);
    expect(AuthService.isAuthenticated()).toBe(false);
  });
});
