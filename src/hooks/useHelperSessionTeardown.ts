import { useEffect, useRef } from 'react';
import { leaveSession } from '../services/helperBridge';

/**
 * useHelperSessionTeardown — fires POST /session/leave on the local
 * Trueyy Helper daemon when the user:
 *
 *   1. navigates away from the page that started the session
 *      (component unmount), or
 *   2. closes the tab / browser (beforeunload + pagehide).
 *
 * Why this exists:
 *   The daemon's pulse subprocess + 30s window aggregator run
 *   continuously for the life of an active session. Without an explicit
 *   /session/leave from Skyview, they keep firing for hours after the
 *   interviewer has already moved on — burning CPU, generating empty
 *   risk-analysis rows, and hammering the LLM rate limit.
 *
 * Usage:
 *   useHelperSessionTeardown(!!helper.status?.session_id);
 *
 * Pass `active` so the cleanup only fires when a session is actually
 * bound — no point sending a leave when nothing's running.
 *
 * beforeunload uses `navigator.sendBeacon` so the request survives the
 * tab closing (regular `fetch` gets cancelled when the page goes away).
 * The daemon's HTTP handler accepts empty-body POSTs, so a beacon with
 * no payload is fine.
 */
export function useHelperSessionTeardown(active: boolean): void {
  // Latest value of `active` — closure-safe so the unload handler never
  // uses a stale snapshot.
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    const onUnload = () => {
      if (!activeRef.current) return;
      try {
        // sendBeacon is the reliable way to POST during unload.
        navigator.sendBeacon?.(
          'http://127.0.0.1:48123/session/leave',
          new Blob([], { type: 'application/json' }),
        );
      } catch {
        // ignore — best-effort
      }
    };
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('pagehide', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('pagehide', onUnload);
    };
  }, []);

  useEffect(() => {
    // On unmount, call /session/leave so the daemon stops the pulse
    // subprocess + window aggregator. Fire-and-forget; the user has
    // already navigated, we don't block on the response.
    return () => {
      if (activeRef.current) {
        void leaveSession();
      }
    };
  }, []);
}
