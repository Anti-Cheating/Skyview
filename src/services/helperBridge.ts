/**
 * helperBridge — Skyview ↔ Trueyy Helper (local daemon on 127.0.0.1:48123).
 *
 * Replaces the old extensionBridge.ts. Skyview drives the helper's
 * session lifecycle by POSTing to its localhost HTTP API, and subscribes
 * to Cortex socket events as usual (candidate-status, live-transcript,
 * etc.) — exactly like before, but the source of truth on the machine
 * is the helper daemon, not a Chrome extension.
 */

const HELPER_BASE = 'http://127.0.0.1:48123';

// Download URL for the .pkg installer. Swap this with your production
// hosted URL once the .pkg is uploaded. Dev placeholder points at
// localhost:8080 in case you serve it from a dev static server.
const HELPER_DOWNLOAD_URL =
  (import.meta as { env?: Record<string, string> }).env?.VITE_HELPER_DOWNLOAD_URL ||
  'https://downloads.trueyy.com/TrueyyHelper-1.0.0.pkg';

export interface HelperHealth {
  ok: boolean;
  version?: string;
  running_session?: string | null;
}

export interface HelperStatus {
  session_id: string | null;
  participant_id: string | null;
  role: 'candidate' | 'interviewer' | null;
  screen_recording_ok: boolean;
  microphone_ok: boolean;
  mic_active: boolean;
  connected: boolean;
}

export interface JoinSessionPayload {
  session_id: string;
  participant_id: string;
  role: 'candidate' | 'interviewer';
  token: string;
  cortex_url: string;
}

/**
 * Returns true if the Trueyy Helper is running on this machine and
 * responding to health checks. False = not installed or not started.
 *
 * Uses AbortController + 800ms timeout so a missing helper doesn't
 * hang the UI.
 */
export async function checkHelperHealth(): Promise<HelperHealth | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 800);
  try {
    const resp = await fetch(`${HELPER_BASE}/health`, {
      method: 'GET',
      signal: controller.signal,
      credentials: 'omit',
    });
    if (!resp.ok) return null;
    return (await resp.json()) as HelperHealth;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches the helper's live status — which session it's bound to,
 * whether permissions are granted, whether mic is actively streaming.
 */
export async function getHelperStatus(): Promise<HelperStatus | null> {
  try {
    const resp = await fetch(`${HELPER_BASE}/status`, { method: 'GET' });
    if (!resp.ok) return null;
    return (await resp.json()) as HelperStatus;
  } catch {
    return null;
  }
}

/**
 * Tells the helper "here's my session, go". Helper then connects to
 * Cortex, runs preflight, and starts reporting status via the Cortex
 * socket (which Skyview is already subscribed to — useRiskSocket).
 */
export async function joinSession(payload: JoinSessionPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch(`${HELPER_BASE}/session/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return (await resp.json()) as { ok: boolean; error?: string };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'network error' };
  }
}

export async function leaveSession(): Promise<void> {
  try {
    await fetch(`${HELPER_BASE}/session/leave`, { method: 'POST' });
  } catch {
    // ignore — helper already gone
  }
}

/**
 * Opens macOS System Settings → Privacy → {Microphone | Screen Recording}
 * via the helper. Browsers can't reliably open x-apple.systempreferences:
 * URLs, but `open` on the daemon side always works.
 */
export async function openSettingsPane(
  pane: 'microphone' | 'screen_recording'
): Promise<boolean> {
  try {
    const resp = await fetch(`${HELPER_BASE}/open-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pane }),
    });
    const body = (await resp.json()) as { ok?: boolean };
    return !!body.ok;
  } catch {
    return false;
  }
}

export function getHelperDownloadUrl(): string {
  return HELPER_DOWNLOAD_URL;
}

export function isHelperReachable(health: HelperHealth | null): boolean {
  return !!health?.ok;
}
