import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectHelperPlatform, checkHelperHealth, getHelperStatus, joinSession,
  leaveSession, notifyMeetingJoined, openSettingsPane, requestHelperPermission,
  getHelperPermissions, pushHelperToken, getHelperDownloadUrl, isHelperReachable,
  fetchHelperManifest,
} from '../../src/services/helperBridge';

const fetchMock = vi.fn();
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe('detectHelperPlatform', () => {
  test('maps navigator hints to mac / windows / unknown', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: 'Mac OS X' });
    expect(detectHelperPlatform()).toBe('mac');
    vi.stubGlobal('navigator', { platform: 'Win32', userAgent: 'Windows NT' });
    expect(detectHelperPlatform()).toBe('windows');
    vi.stubGlobal('navigator', { platform: 'Linux x86_64', userAgent: 'X11' });
    expect(detectHelperPlatform()).toBe('unknown');
  });
});

describe('getHelperDownloadUrl', () => {
  test('returns the Cortex /downloads/helper redirect route per OS', () => {
    // Both OSes point at Cortex's /downloads/helper/<os> redirect, which 302s
    // to the newest notarized artifact — no hardcoded file URL.
    expect(getHelperDownloadUrl('mac')).toMatch(/\/downloads\/helper\/mac$/);
    expect(getHelperDownloadUrl('unknown')).toMatch(/\/downloads\/helper\/mac$/);
    expect(getHelperDownloadUrl('windows')).toMatch(/\/downloads\/helper\/win$/);
  });

  test('mac passes the arch as a query param; windows ignores arch', () => {
    expect(getHelperDownloadUrl('mac', 'arm64')).toMatch(/\/downloads\/helper\/mac\?arch=arm64$/);
    expect(getHelperDownloadUrl('mac', 'x86_64')).toMatch(/\/downloads\/helper\/mac\?arch=x86_64$/);
    // windows is a single x64 build — arch is not appended
    expect(getHelperDownloadUrl('windows', 'x86_64')).toMatch(/\/downloads\/helper\/win$/);
  });
});

describe('fetchHelperManifest', () => {
  const manifest = { platform: 'win', builds: { x64: { version: '1.2.0', url: 'x', sha256: 'y' } } };

  test('hits the per-OS manifest route (explicit platform)', async () => {
    fetchMock.mockResolvedValue(json(200, manifest));
    await fetchHelperManifest('mac');
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/downloads\/helper\/mac\/manifest$/);
    fetchMock.mockClear();
    await fetchHelperManifest('windows');
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/downloads\/helper\/win\/manifest$/);
  });

  test('falls back to the detected OS when no platform is passed', async () => {
    vi.stubGlobal('navigator', { platform: 'Win32', userAgent: 'Windows NT' });
    fetchMock.mockResolvedValue(json(200, manifest));
    await fetchHelperManifest();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/downloads\/helper\/win\/manifest$/);
  });

  test('returns null on non-ok or network error', async () => {
    fetchMock.mockResolvedValue(json(404, {}));
    expect(await fetchHelperManifest('windows')).toBeNull();
    fetchMock.mockRejectedValue(new Error('net'));
    expect(await fetchHelperManifest('windows')).toBeNull();
  });
});

describe('isHelperReachable', () => {
  test('true only for a healthy ok response', () => {
    expect(isHelperReachable({ ok: true })).toBe(true);
    expect(isHelperReachable({ ok: false })).toBe(false);
    expect(isHelperReachable(null)).toBe(false);
  });
});

describe('checkHelperHealth', () => {
  test('returns the health body when the daemon answers', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true, version: '1.0.0' }));
    expect(await checkHelperHealth()).toMatchObject({ ok: true, version: '1.0.0' });
  });
  test('returns null on a non-ok response', async () => {
    fetchMock.mockResolvedValue(json(500, {}));
    expect(await checkHelperHealth()).toBeNull();
  });
  test('returns null when the daemon is unreachable (fetch throws)', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await checkHelperHealth()).toBeNull();
  });
});

describe('getHelperStatus', () => {
  test('returns the status body', async () => {
    fetchMock.mockResolvedValue(json(200, { session_id: 's', connected: true }));
    expect(await getHelperStatus()).toMatchObject({ session_id: 's', connected: true });
  });
  test('null on error', async () => {
    fetchMock.mockRejectedValue(new Error('x'));
    expect(await getHelperStatus()).toBeNull();
  });
});

describe('joinSession', () => {
  const payload = { session_id: 's', participant_id: 'p', role: 'candidate' as const, token: 't', cortex_url: 'http://c' };
  test('POSTs the payload and returns the daemon result', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }));
    expect(await joinSession(payload)).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/session/join');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify(payload));
  });
  test('returns ok:false with the error message on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    expect(await joinSession(payload)).toEqual({ ok: false, error: 'boom' });
  });
});

describe('leaveSession', () => {
  test('POSTs and swallows errors', async () => {
    fetchMock.mockResolvedValue(json(200, {}));
    await expect(leaveSession()).resolves.toBeUndefined();
    fetchMock.mockRejectedValue(new Error('gone'));
    await expect(leaveSession()).resolves.toBeUndefined();
  });
});

describe('notifyMeetingJoined', () => {
  test('returns the daemon result', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }));
    expect(await notifyMeetingJoined()).toMatchObject({ ok: true });
  });
  test('ok:false on failure', async () => {
    fetchMock.mockRejectedValue(new Error('x'));
    expect((await notifyMeetingJoined()).ok).toBe(false);
  });
});

describe('permission + settings + token endpoints', () => {
  test('requestHelperPermission returns true on ok', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }));
    expect(await requestHelperPermission('microphone')).toBe(true);
  });
  test('requestHelperPermission false on failure', async () => {
    fetchMock.mockRejectedValue(new Error('x'));
    expect(await requestHelperPermission('microphone')).toBe(false);
  });
  test('openSettingsPane resolves regardless of daemon result', async () => {
    fetchMock.mockResolvedValue(json(200, {}));
    await expect(openSettingsPane('screen_recording')).resolves.toBeDefined();
  });
  test('getHelperPermissions returns the body, or null on failure', async () => {
    fetchMock.mockResolvedValue(json(200, { screen_recording_ok: true, microphone_ok: false, keyboard_ok: false }));
    expect(await getHelperPermissions()).toMatchObject({ screen_recording_ok: true });
    fetchMock.mockRejectedValue(new Error('x'));
    expect(await getHelperPermissions()).toBeNull();
  });
  test('pushHelperToken returns a boolean', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }));
    expect(typeof await pushHelperToken('tok')).toBe('boolean');
    fetchMock.mockRejectedValue(new Error('x'));
    expect(await pushHelperToken('tok')).toBe(false);
  });
});
