import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkHelperHealth,
  detectHelperPlatform,
  fetchHelperManifest,
  getHelperStatus,
  getHelperPermissions,
  getLatestHelperVersion,
  isHelperOutdated,
  joinSession,
  leaveSession,
  type HelperHealth,
  type HelperManifest,
  type HelperStatus,
  type JoinSessionPayload,
} from '../services/helperBridge';

/**
 * useHelper — polls the local Trueyy Helper daemon (127.0.0.1:48123)
 * every few seconds so the UI can react to the helper coming/going.
 */

export interface UseHelperReturn {
  /** null = still checking on first mount */
  health: HelperHealth | null;
  status: HelperStatus | null;
  /** true once the health probe has succeeded at least once in this session */
  installed: boolean;
  /** health probe is currently in flight */
  checking: boolean;
  /**
   * True when the installed helper is confirmed older than the published
   * release (Cortex manifest). The daemon normally self-updates within
   * seconds of waking, so this is the fallback gate for a failed or
   * pre-updater install. False whenever the comparison is unknowable.
   */
  outdated: boolean;
  /** Newest published helper version, when the manifest was reachable. */
  latestVersion: string | null;
  join: (payload: JoinSessionPayload) => Promise<{ ok: boolean; error?: string }>;
  leave: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useHelper(pollMs = 3000): UseHelperReturn {
  const [health, setHealth] = useState<HelperHealth | null>(null);
  const [status, setStatus] = useState<HelperStatus | null>(null);
  const [checking, setChecking] = useState(true);
  // Sticky: once we've seen the helper respond, keep showing "installed"
  // even if a single poll times out (transient network hiccup).
  const [installed, setInstalled] = useState(false);
  const [manifest, setManifest] = useState<HelperManifest | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // One manifest fetch per mount — it's a 60s-cached static JSON, and the
  // gate only needs it once. Per-OS: mac → helper/mac, windows → helper/win.
  // Skipped for 'unknown' (no build target to compare against) — and
  // fetchHelperManifest returns null on any miss, so the gate stays inert
  // until a manifest is actually published for that OS.
  useEffect(() => {
    const platform = detectHelperPlatform();
    if (platform === 'unknown') return;
    let cancelled = false;
    fetchHelperManifest(platform).then((m) => {
      if (!cancelled) setManifest(m);
    });
    return () => { cancelled = true; };
  }, []);

  const poll = useCallback(async () => {
    const h = await checkHelperHealth();
    setHealth(h);
    if (h?.ok) {
      setInstalled(true);
      // Fetch /status (session-attached flags) and /permissions (live
      // TCC probe) in parallel. Pre-session /status flags default to
      // false even when the user has granted permission, so we merge:
      // /permissions is authoritative for screen_recording_ok /
      // microphone_ok; /status keeps the rest (mic_active, connected).
      const [s, p] = await Promise.all([
        getHelperStatus(),
        getHelperPermissions(),
      ]);
      if (s) {
        setStatus({
          ...s,
          screen_recording_ok:
            p?.screen_recording_ok ?? s.screen_recording_ok,
          microphone_ok: p?.microphone_ok ?? s.microphone_ok,
          keyboard_ok: p?.keyboard_ok ?? s.keyboard_ok,
        });
      } else {
        setStatus(null);
      }
    } else {
      setStatus(null);
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, pollMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll, pollMs]);

  return {
    health,
    status,
    installed,
    checking,
    outdated: isHelperOutdated(health, manifest),
    latestVersion: getLatestHelperVersion(manifest),
    join: joinSession,
    leave: leaveSession,
    refresh: poll,
  };
}
