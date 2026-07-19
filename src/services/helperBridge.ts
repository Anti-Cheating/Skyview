/**
 * helperBridge — Skyview ↔ Trueyy Helper (local daemon on 127.0.0.1:48123).
 *
 * Replaces the old extensionBridge.ts. Skyview drives the helper's
 * session lifecycle by POSTing to its localhost HTTP API, and subscribes
 * to Cortex socket events as usual (candidate-status, live-transcript,
 * etc.) — exactly like before, but the source of truth on the machine
 * is the helper daemon, not a Chrome extension.
 */

import { ENV } from '../config/env';

const HELPER_BASE = 'http://127.0.0.1:48123';

// Helper installer download URLs — served by Cortex's /downloads/helper/*
// redirect, which 302s to the NEWEST artifact in R2 (via helper/<os>/latest.json;
// mac is notarized, win is the unsigned .zip). Derived from the same
// VITE_AUTH_API_URL the rest of the app uses — no separate env var, no
// hardcoded host.
const API_BASE = ENV.AUTH_API_URL.replace(/\/+$/, '');
const HELPER_DOWNLOAD_URL_MAC = `${API_BASE}/downloads/helper/mac`;
const HELPER_DOWNLOAD_URL_WIN = `${API_BASE}/downloads/helper/win`;

export type HelperPlatform = 'mac' | 'windows' | 'unknown';

/**
 * Rough-but-reliable OS detection from navigator hints. Good enough for
 * picking which installer to download — we don't need the exact kernel
 * version, just mac vs. windows.
 */
export function detectHelperPlatform(): HelperPlatform {
  if (typeof navigator === 'undefined') return 'unknown';
  const plat = (navigator.platform || '').toLowerCase();
  const ua = (navigator.userAgent || '').toLowerCase();
  if (plat.includes('mac') || ua.includes('mac os x')) return 'mac';
  if (plat.includes('win') || ua.includes('windows')) return 'windows';
  return 'unknown';
}

export interface HelperHealth {
  ok: boolean;
  version?: string;
  running_session?: string | null;
  /** Self-updater state: idle | checking | downloading | verifying | swapped | error:<reason> */
  update_state?: string;
}

/**
 * The raw R2 helper/<os>/latest.json, proxied by Cortex at
 * GET /downloads/helper/{mac,win}/manifest. One entry per CPU arch.
 */
export interface HelperManifest {
  platform?: string;
  updated_at?: string;
  builds?: Record<string, {
    version: string;
    url: string;
    sha256: string;
    /** Present once a release ships the self-update tarball. */
    update_url?: string;
    update_sha256?: string;
  }>;
}

export interface HelperStatus {
  session_id: string | null;
  participant_id: string | null;
  role: 'candidate' | 'interviewer' | null;
  screen_recording_ok: boolean;
  microphone_ok: boolean;
  keyboard_ok: boolean;
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
 * Tell the helper "the candidate just clicked Open Meeting." The helper
 * latches `joined=true` on its SessionManager and pushes the updated
 * candidate-status over the live Cortex socket, which flips the final
 * pill on the interviewer's CandidateSetupCard.
 *
 * Called from CandidateJoinPage right after `window.open(meetingUrl)`.
 * Fire-and-forget — the page navigates away to the meeting tab anyway,
 * so failures here just mean the interviewer's checklist stays at 3/4
 * until the candidate's next status push. Returns ok=false in that
 * case so the caller can decide whether to retry (currently no-op).
 */
export async function notifyMeetingJoined(): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch(`${HELPER_BASE}/session/joined-meeting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!resp.ok) {
      return { ok: false, error: `helper returned ${resp.status}` };
    }
    return (await resp.json()) as { ok: boolean; error?: string };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'network error' };
  }
}

/**
 * Opens macOS System Settings → Privacy → {Microphone | Screen Recording}
 * via the helper. Browsers can't reliably open x-apple.systempreferences:
 * URLs, but `open` on the daemon side always works.
 *
 * Debounced per-pane to 2s — macOS Ventura+ stacks a new System Settings
 * window every time `open` is called with the same URL, so impatient
 * double-clicks would otherwise pile up multiple panes on screen.
 */
const _lastOpenAt: Record<string, number> = {};
const OPEN_COOLDOWN_MS = 2000;

export async function openSettingsPane(
  pane: 'microphone' | 'screen_recording' | 'accessibility'
): Promise<boolean> {
  const now = Date.now();
  if (now - (_lastOpenAt[pane] || 0) < OPEN_COOLDOWN_MS) {
    return true;
  }
  _lastOpenAt[pane] = now;
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

/**
 * Trigger the macOS TCC permission flow for a given pane: the daemon
 * calls the underlying API (CGRequestScreenCaptureAccess /
 * AVCaptureDevice.requestAccess) so Trueyy Helper appears in System
 * Settings, then opens System Settings at the matching pane. The
 * candidate just has to flip the toggle on; getHelperPermissions()
 * will pick up the change on the next poll.
 */
export async function requestHelperPermission(
  pane: 'microphone' | 'screen_recording' | 'accessibility'
): Promise<boolean> {
  try {
    const resp = await fetch(`${HELPER_BASE}/permissions/request`, {
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

/**
 * Live TCC state — silent probes, safe to poll. Returns the helper's
 * current view of Screen Recording + Microphone permissions so the
 * Enable flow can detect when the user has granted them in System
 * Settings without needing an active interview session.
 */
export async function getHelperPermissions(): Promise<{
  screen_recording_ok: boolean;
  microphone_ok: boolean;
  keyboard_ok: boolean;
} | null> {
  try {
    const resp = await fetch(`${HELPER_BASE}/permissions`, { method: 'GET' });
    if (!resp.ok) return null;
    return (await resp.json()) as {
      screen_recording_ok: boolean;
      microphone_ok: boolean;
      keyboard_ok: boolean;
    };
  } catch {
    return null;
  }
}

/**
 * Push a refreshed access token into the running helper daemon. Called
 * after Skyview's auto-refresh so the daemon's pulse / windows /
 * image-analysis / R2-upload calls stop hitting Cortex with an expired
 * JWT mid-session. Safe to call when no session is active — the daemon
 * returns 400 and we silently swallow it.
 */
export async function pushHelperToken(token: string): Promise<boolean> {
  try {
    const resp = await fetch(`${HELPER_BASE}/session/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!resp.ok) return false;
    const body = (await resp.json()) as { ok?: boolean };
    return !!body.ok;
  } catch {
    return false;
  }
}

/** macOS CPU architectures we ship a build for. */
export type HelperArch = 'arm64' | 'x86_64';

export function getHelperDownloadUrl(platform?: HelperPlatform, arch?: HelperArch): string {
  const p = platform ?? detectHelperPlatform();
  if (p === 'windows') return HELPER_DOWNLOAD_URL_WIN; // single x64 build — no arch param
  // Mac (or unknown → mac). The browser can't reliably tell Apple Silicon from
  // Intel, so the UI offers both and passes the arch here; Cortex's
  // /downloads/helper/mac?arch= 302s to the matching .pkg (defaults arm64).
  return arch ? `${HELPER_DOWNLOAD_URL_MAC}?arch=${arch}` : HELPER_DOWNLOAD_URL_MAC;
}

export function isHelperReachable(health: HelperHealth | null): boolean {
  return !!health?.ok;
}

/**
 * Fetches the published-version manifest from Cortex for THIS OS — mac →
 * /downloads/helper/mac/manifest, windows → /downloads/helper/win/manifest.
 * Used as the fallback "helper outdated" gate: the daemon normally self-updates
 * silently (helper_update.py on both OSes), but if that failed — or the
 * installed build predates the updater — the join flow can compare versions
 * and route the candidate back to the download card.
 *
 * Pass a platform to override detection (tests / SSR). Returns null on any
 * failure (unknown OS, manifest not yet published, network error) so callers
 * treat "unknown" as "not outdated" and never block a join on this.
 */
export async function fetchHelperManifest(
  platform?: HelperPlatform,
): Promise<HelperManifest | null> {
  const os = (platform ?? detectHelperPlatform()) === 'windows' ? 'win' : 'mac';
  try {
    const resp = await fetch(`${API_BASE}/downloads/helper/${os}/manifest`, {
      method: 'GET',
      credentials: 'omit',
    });
    if (!resp.ok) return null;
    return (await resp.json()) as HelperManifest;
  } catch {
    return null;
  }
}

/** Numeric dotted-version compare: -1 | 0 | 1. Non-numeric parts ignored. */
export function compareHelperVersions(a: string, b: string): number {
  const parse = (v: string) => (v.match(/\d+/g) || []).map(Number);
  const [pa, pb] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const [x, y] = [pa[i] ?? 0, pb[i] ?? 0];
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * Newest version across all arch builds in the manifest. The browser
 * can't reliably tell arm64 from x86_64, and both arches ship the same
 * release version anyway — the max is the right gate either way.
 */
export function getLatestHelperVersion(manifest: HelperManifest | null): string | null {
  const builds = manifest?.builds;
  if (!builds) return null;
  let latest: string | null = null;
  for (const b of Object.values(builds)) {
    if (b?.version && (!latest || compareHelperVersions(b.version, latest) > 0)) {
      latest = b.version;
    }
  }
  return latest;
}

/**
 * True only when we positively know the installed helper is older than
 * the published release. Unknown version / unreachable manifest / a
 * mid-self-update helper all return false — this gate must never
 * false-positive a healthy candidate out of their interview.
 */
export function isHelperOutdated(
  health: HelperHealth | null,
  manifest: HelperManifest | null
): boolean {
  if (!health?.ok || !health.version) return false;
  const latest = getLatestHelperVersion(manifest);
  if (!latest) return false;
  return compareHelperVersions(health.version, latest) < 0;
}
