import { useEffect, useRef, useState, useCallback } from 'react';
import { ENV } from '../config/env';

/**
 * Communicate with the Trueyy Interviewer Monitor Chrome extension.
 *
 * Detects whether the extension is installed (via externally_connectable
 * ping), sends auth + session info when available, and exposes methods
 * for start/stop mic.
 */

export interface InterviewerExtensionState {
  installed: boolean;
  micGranted: boolean;
  checking: boolean;
}

export interface UseInterviewerExtensionReturn extends InterviewerExtensionState {
  sendAuth: (accessToken: string, user: { id: string; email: string }) => void;
  joinSession: (sessionId: string) => void;
  startMic: () => void;
  stopMic: () => void;
  enableMic: () => void;
  retryMic: () => void;
}

// Same Chrome-typing pattern as extensionBridge.ts to avoid TS errors
// in the Vite build (which doesn't ship @types/chrome).
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

function sendToExtension(
  message: Record<string, unknown>,
  callback?: (resp: unknown) => void
): void {
  const c = getChrome();
  if (!c?.runtime) return;
  try {
    c.runtime.sendMessage(
      ENV.INTERVIEWER_EXTENSION_ID,
      message,
      callback || (() => {})
    );
  } catch {
    // Extension not installed or origin not allowed
  }
}

export function useInterviewerExtension(): UseInterviewerExtensionReturn {
  const [installed, setInstalled] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
  const [checking, setChecking] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkInstalled = useCallback(() => {
    const c = getChrome();
    if (!c?.runtime) {
      setChecking(false);
      return;
    }
    try {
      c.runtime.sendMessage(
        ENV.INTERVIEWER_EXTENSION_ID,
        { type: 'ping' },
        (resp: unknown) => {
          const r = resp as { ok?: boolean; mic_granted?: boolean } | undefined;
          if (c.runtime?.lastError || !r?.ok) {
            setInstalled(false);
            setMicGranted(false);
          } else {
            setInstalled(true);
            // Use the live value so mid-interview revocation propagates
            // to MonitoringView within ~3s (hook's poll interval).
            setMicGranted(!!r.mic_granted);
          }
          setChecking(false);
        }
      );
    } catch {
      setInstalled(false);
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkInstalled();
    // Re-check every 3s so the UI updates when the user installs mid-session
    intervalRef.current = setInterval(checkInstalled, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkInstalled]);

  const sendAuth = useCallback((accessToken: string, user: { id: string; email: string }) => {
    sendToExtension({ type: 'auth-token', accessToken, user });
  }, []);

  const joinSession = useCallback((sessionId: string) => {
    sendToExtension({ type: 'join-interview', sessionId }, (resp: unknown) => {
      if ((resp as { ok?: boolean })?.ok) {
        setInstalled(true);
      }
    });
  }, []);

  const startMic = useCallback(() => {
    sendToExtension({ type: 'start-mic' });
  }, []);

  const stopMic = useCallback(() => {
    sendToExtension({ type: 'stop-mic' });
  }, []);

  // Opens macOS System Settings → Privacy → Microphone via the native
  // host (Chrome can't open x-apple.systempreferences: URLs directly).
  // Same handler also disconnects + reconnects the native port so the
  // mic probe re-runs after the user grants permission.
  const enableMic = useCallback(() => {
    sendToExtension({ type: 'enable-mic' });
  }, []);

  // Re-run the mic probe without opening Settings. Used after the user
  // has already enabled Trueyy Helper in Settings and just needs a
  // fresh probe to confirm.
  const retryMic = useCallback(() => {
    sendToExtension({ type: 'retry-mic' });
  }, []);

  return { installed, micGranted, checking, sendAuth, joinSession, startMic, stopMic, enableMic, retryMic };
}
