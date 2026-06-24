import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkHelperHealth,
  getHelperStatus,
  getHelperPermissions,
  joinSession,
  leaveSession,
  type HelperHealth,
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    join: joinSession,
    leave: leaveSession,
    refresh: poll,
  };
}
