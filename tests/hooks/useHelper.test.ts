import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Stub only the I/O (network) functions; keep the REAL detectHelperPlatform /
// fetchHelperManifest routing / isHelperOutdated / getLatestHelperVersion so
// the outdated-gate logic is exercised end-to-end through the hook.
const {
  checkHelperHealth, getHelperStatus, getHelperPermissions,
  joinSession, leaveSession, fetchHelperManifest,
} = vi.hoisted(() => ({
  checkHelperHealth: vi.fn(),
  getHelperStatus: vi.fn(),
  getHelperPermissions: vi.fn(),
  joinSession: vi.fn(),
  leaveSession: vi.fn(),
  fetchHelperManifest: vi.fn(),
}));

vi.mock('../../src/services/helperBridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/helperBridge')>()),
  checkHelperHealth,
  getHelperStatus,
  getHelperPermissions,
  joinSession,
  leaveSession,
  fetchHelperManifest,
}));

import { useHelper } from '../../src/hooks/useHelper';

beforeEach(() => {
  vi.clearAllMocks();
  fetchHelperManifest.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllGlobals());

describe('useHelper', () => {
  test('initial state: checking, nothing installed, join/leave wired to the bridge', () => {
    checkHelperHealth.mockResolvedValue(null);
    const { result } = renderHook(() => useHelper());
    // Synchronous initial render, before the first poll resolves.
    expect(result.current.health).toBeNull();
    expect(result.current.status).toBeNull();
    expect(result.current.installed).toBe(false);
    expect(result.current.checking).toBe(true);
    expect(result.current.join).toBe(joinSession);
    expect(result.current.leave).toBe(leaveSession);
    expect(typeof result.current.refresh).toBe('function');
  });

  test('a failed health probe clears checking but leaves installed false', async () => {
    checkHelperHealth.mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useHelper());
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.installed).toBe(false);
    expect(result.current.status).toBeNull();
  });

  test('a healthy probe marks installed and merges status + permissions', async () => {
    checkHelperHealth.mockResolvedValue({ ok: true });
    getHelperStatus.mockResolvedValue({
      screen_recording_ok: false, microphone_ok: false, keyboard_ok: false, mic_active: true,
    });
    getHelperPermissions.mockResolvedValue({
      screen_recording_ok: true, microphone_ok: true, keyboard_ok: true,
    });
    const { result } = renderHook(() => useHelper());
    await waitFor(() => expect(result.current.installed).toBe(true));
    // /permissions wins for the permission flags; /status keeps the rest.
    expect(result.current.status).toMatchObject({
      screen_recording_ok: true, microphone_ok: true, keyboard_ok: true, mic_active: true,
    });
  });

  test('windows: fetches the win manifest and flags an outdated helper', async () => {
    vi.stubGlobal('navigator', { platform: 'Win32', userAgent: 'Windows NT 10.0' });
    checkHelperHealth.mockResolvedValue({ ok: true, version: '1.0.0' });
    getHelperStatus.mockResolvedValue({
      screen_recording_ok: true, microphone_ok: true, keyboard_ok: true, mic_active: false,
    });
    getHelperPermissions.mockResolvedValue(null);
    fetchHelperManifest.mockResolvedValue({
      platform: 'windows', builds: { x64: { version: '1.2.0', url: 'z', sha256: 's' } },
    });

    const { result } = renderHook(() => useHelper());
    await waitFor(() => expect(result.current.outdated).toBe(true));
    // Detected windows → asked Cortex for the win manifest, not the mac one.
    expect(fetchHelperManifest).toHaveBeenCalledWith('windows');
    expect(result.current.latestVersion).toBe('1.2.0');
  });

  test("unknown OS: skips the manifest fetch and never flags outdated", async () => {
    vi.stubGlobal('navigator', { platform: 'Linux x86_64', userAgent: 'X11' });
    checkHelperHealth.mockResolvedValue({ ok: true, version: '1.0.0' });
    getHelperStatus.mockResolvedValue(null);
    getHelperPermissions.mockResolvedValue(null);

    const { result } = renderHook(() => useHelper());
    await waitFor(() => expect(result.current.installed).toBe(true));
    expect(fetchHelperManifest).not.toHaveBeenCalled();
    expect(result.current.outdated).toBe(false);
  });
});
