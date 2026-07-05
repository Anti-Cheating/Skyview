import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { checkHelperHealth, getHelperStatus, getHelperPermissions, joinSession, leaveSession } =
  vi.hoisted(() => ({
    checkHelperHealth: vi.fn(),
    getHelperStatus: vi.fn(),
    getHelperPermissions: vi.fn(),
    joinSession: vi.fn(),
    leaveSession: vi.fn(),
  }));

vi.mock('../services/helperBridge', () => ({
  checkHelperHealth,
  getHelperStatus,
  getHelperPermissions,
  joinSession,
  leaveSession,
}));

import { useHelper } from './useHelper';

beforeEach(() => {
  vi.clearAllMocks();
});

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
});
