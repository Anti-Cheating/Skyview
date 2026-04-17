/**
 * Extension Bridge — Skyview ↔ Jarvis Chrome extension messaging
 *
 * Skyview talks to the Jarvis extension via `chrome.runtime.sendMessage`.
 * Two flows live here:
 *   1. Auth handoff — after a candidate logs in via `/login?ext=jarvis`,
 *      Skyview ships the auth tokens back to the extension so the candidate
 *      doesn't have to log in twice.
 *   2. Join handoff — when a candidate clicks "Join" on an extension-type
 *      interview, Skyview tells the extension which session to monitor.
 *
 * Messaging only works if:
 *   - the extension is installed,
 *   - its manifest.json includes the current Skyview origin in
 *     `externally_connectable.matches`, and
 *   - VITE_EXTENSION_ID matches the extension's actual ID.
 */

import { ENV } from '../config/env';
import { STORAGE_KEYS } from '../config/constants';
import type { User } from '../types/auth.types';

interface ChromeRuntimeLike {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback?: (response: unknown) => void
  ) => void;
  lastError?: { message?: string };
}

interface ChromeLike {
  runtime?: ChromeRuntimeLike;
}

function getChrome(): ChromeLike | null {
  const c = (globalThis as unknown as { chrome?: ChromeLike }).chrome;
  return c?.runtime ? c : null;
}

export function isExtensionAvailable(): boolean {
  return getChrome() !== null;
}

/**
 * Detects whether this Skyview tab was opened by the extension's "Sign in
 * with Trueyy" button — i.e. should hand off the token after login.
 */
export function isExtensionLoginFlow(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('ext') === 'jarvis';
}

function sendExternalMessage(message: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chromeApi = getChrome();
    if (!chromeApi?.runtime) {
      reject(new Error('Chrome runtime not available'));
      return;
    }
    try {
      chromeApi.runtime.sendMessage(ENV.CANDIDATE_EXTENSION_ID, message, (response) => {
        const lastError = chromeApi.runtime?.lastError?.message;
        if (lastError) {
          reject(new Error(lastError));
        } else {
          resolve(response);
        }
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/**
 * Sends the freshly-logged-in user's auth tokens to the extension.
 * Pulls tokens from localStorage (where AuthService just put them).
 *
 * Throws if the extension isn't installed or rejected the message.
 */
export async function sendAuthToExtension(user: User): Promise<void> {
  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  if (!accessToken) {
    throw new Error('No access token in localStorage to send to extension');
  }
  await sendExternalMessage({
    type: 'auth-token',
    accessToken,
    refreshToken,
    user,
  });
}

/**
 * Tells the extension which interview the candidate just joined so it can
 * pop the consent gate and (in 3b/3c) start monitoring.
 */
export async function sendJoinInterviewToExtension(args: {
  sessionId: string;
  joinUrl: string | null;
  interview?: unknown;
}): Promise<void> {
  await sendExternalMessage({
    type: 'join-interview',
    ...args,
  });
}

/**
 * Lightweight ping to detect whether the extension is currently installed
 * and reachable from this origin. Resolves true on response, false on any
 * error (extension missing, wrong ID, origin not in externally_connectable).
 */
export async function pingExtension(): Promise<boolean> {
  try {
    const response = (await sendExternalMessage({ type: 'ping' })) as
      | { ok?: boolean }
      | undefined;
    return response?.ok === true;
  } catch {
    return false;
  }
}

// ── CandidateJoinPage helpers ─────────────────────────────────────────

export interface MonitoringState {
  ok: boolean;
  ready: boolean;
  permission: { message?: string } | null;
  captureActive: boolean;
}

/**
 * Tells the extension to start the Sentinel native host + connect to
 * Cortex. Returns {ok:true} if the handshake started, but the actual
 * permission result arrives asynchronously — poll getMonitoringState().
 */
export async function enableMonitoring(): Promise<{ ok: boolean; error?: string }> {
  const resp = (await sendExternalMessage({ type: 'enable-monitoring' })) as any;
  return resp ?? { ok: false, error: 'no-response' };
}

/**
 * Returns the current Sentinel permission/ready state. Call after
 * enableMonitoring() and poll until ready===true or permission!==null.
 */
export async function getMonitoringState(): Promise<MonitoringState> {
  const resp = (await sendExternalMessage({ type: 'get-monitoring-state' })) as any;
  return resp ?? { ok: false, ready: false, permission: null, captureActive: false };
}

/**
 * Opens the meeting tab. Only succeeds if Sentinel has reported ready.
 */
export async function openMeeting(): Promise<{ ok: boolean; error?: string }> {
  const resp = (await sendExternalMessage({ type: 'open-meeting' })) as any;
  return resp ?? { ok: false, error: 'no-response' };
}

/**
 * Kill + respawn Sentinel (force permission re-check). Used when the
 * candidate has toggled Screen Recording on and wants to retry.
 */
export async function resetMonitoring(): Promise<{ ok: boolean; error?: string }> {
  const resp = (await sendExternalMessage({ type: 'reset-monitoring' })) as any;
  return resp ?? { ok: false, error: 'no-response' };
}
