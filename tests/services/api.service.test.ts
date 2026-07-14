import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/services/helperBridge', () => ({ pushHelperToken: vi.fn().mockResolvedValue(true) }));

import { ApiService, refreshAccessToken, startTokenAutoRefresh, stopTokenAutoRefresh } from '../../src/services/api.service';
import { STORAGE_KEYS } from '../../src/config/constants';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { stopTokenAutoRefresh(); vi.unstubAllGlobals(); });

describe('ApiService request layer', () => {
  test('GET unwraps the { data } envelope and attaches the bearer token', async () => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'tok');
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { hello: 'world' } }));

    const res = await ApiService.get('/thing');
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ hello: 'world' });

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(init.method).toBe('GET');
  });

  test('POST serializes a JSON body and sets Content-Type', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { data: { id: 1 } }));
    await ApiService.post('/create', { name: 'x' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'x' }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  test('PUT / PATCH / DELETE issue the right method', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(200, { data: {} })));
    await ApiService.put('/p', { a: 1 });
    await ApiService.patch('/q', { b: 2 });
    await ApiService.delete('/r');
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH');
    expect(fetchMock.mock.calls[2][1].method).toBe('DELETE');
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ a: 1 }));
  });

  test('POST with FormData does not JSON-stringify or force Content-Type', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const fd = new FormData();
    fd.append('f', 'v');
    await ApiService.post('/upload', fd);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  test('a custom base URL is used verbatim; absolute endpoints pass through', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
    await ApiService.get('/x', undefined, 'http://cortex.test');
    expect(fetchMock.mock.calls[0][0]).toBe('http://cortex.test/x');
    await ApiService.get('https://abs.test/y');
    expect(fetchMock.mock.calls[1][0]).toBe('https://abs.test/y');
  });

  test('403 / 404 / 500 map to typed ApiErrors', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, {}));
    await expect(ApiService.get('/a')).rejects.toMatchObject({ status: 403 });
    fetchMock.mockResolvedValue(jsonResponse(404, {}));
    await expect(ApiService.get('/b')).rejects.toMatchObject({ status: 404 });
    fetchMock.mockResolvedValue(jsonResponse(500, {}));
    await expect(ApiService.get('/c')).rejects.toMatchObject({ status: 500 });
  });

  test('a non-JSON error body still throws with the status', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 400 }));
    await expect(ApiService.get('/d')).rejects.toMatchObject({ status: 400 });
  });

  test('network TypeError maps to a NETWORK_ERROR (status 0)', async () => {
    fetchMock.mockRejectedValue(Object.assign(new TypeError('failed to fetch'), { name: 'TypeError' }));
    await expect(ApiService.get('/e')).rejects.toMatchObject({ status: 0 });
  });

  test('401 → refresh succeeds → the original request is retried once', async () => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'old');
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'refresh');
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))                                  // original 401
      .mockResolvedValueOnce(jsonResponse(200, { data: { accessToken: 'new' } }))    // /auth/refresh
      .mockResolvedValueOnce(jsonResponse(200, { data: { ok: true } }));             // retry

    const res = await ApiService.get('/protected');
    expect(res.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBe('new');
    // Retry carried the refreshed token.
    expect((fetchMock.mock.calls[2][1].headers as Record<string, string>).Authorization).toBe('Bearer new');
  });

  test('401 with no refresh token → clears auth + emits auth:logout', async () => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'old');
    const onLogout = vi.fn();
    window.addEventListener('auth:logout', onLogout);
    fetchMock.mockResolvedValue(jsonResponse(401, {}));

    await expect(ApiService.get('/protected')).rejects.toMatchObject({ status: 401 });
    expect(onLogout).toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
    window.removeEventListener('auth:logout', onLogout);
  });
});

describe('refreshAccessToken', () => {
  test('returns null when there is no refresh token', async () => {
    expect(await refreshAccessToken()).toBeNull();
  });

  test('stores and returns a new access token, honouring a rotated refresh token', async () => {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'r0');
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { accessToken: 'a1', refreshToken: 'r1' } }));
    expect(await refreshAccessToken()).toBe('a1');
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBe('a1');
    expect(localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBe('r1');
  });

  test('returns null on a failed refresh response', async () => {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'r0');
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    expect(await refreshAccessToken()).toBeNull();
  });
});

describe('token auto-refresh timer', () => {
  test('start/stop are safe no-ops without a token', () => {
    expect(() => { startTokenAutoRefresh(); stopTokenAutoRefresh(); }).not.toThrow();
  });
});
