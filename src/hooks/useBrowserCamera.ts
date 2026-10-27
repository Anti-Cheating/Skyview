/**
 * useBrowserCamera — the candidate's webcam, run from this Skyview tab.
 *
 * Windows only. There the Trueyy Helper holding the webcam locks Google
 * Meet / Teams out of it, and Windows' shared camera mode delivered
 * ~10 fps with a quarter of the frames cut off (Sentinel
 * poc/shared_camera). Chrome shares one webcam between its tabs, so Meet
 * and this tab both get every frame.
 *
 * This tab connects to Cortex as `client: "camera"`. Cortex then sends
 * start-camera here instead of to the Helper. A worker
 * (services/gaze/camera.worker) then does what Sentinel's live_camera.py
 * does: FaceLandmarker + the same gaze math (services/gaze/gazeTracker) at
 * 15 fps; this page side only holds the webcam and the socket, so the tab
 * never freezes. Same `cam-frame` / `camera-status` events, plus the
 * warning events (`cam-events`) Cortex merges into the Helper's pulse +
 * window posts.
 *
 * Frames are read with MediaStreamTrackProcessor, not timers, so they keep
 * coming while the candidate is in the Meet tab (background tabs throttle
 * timers, not streams).
 */

import { useCallback, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { ENV } from '../config/env';
import { STORAGE_KEYS } from '../config/constants';
import type { CameraState } from './useRiskSocket';

// Chrome / Edge only (Windows candidates' browsers); not in TS's DOM lib yet.
declare class MediaStreamTrackProcessor {
  constructor(init: { track: MediaStreamTrack });
  readable: ReadableStream<VideoFrame>;
}

const RETRY_OPEN_S = 5;
let runIds = 0;

const cameraDenied = (): Promise<boolean> =>
  navigator.permissions?.query({ name: 'camera' as PermissionName }).then((s) => s.state === 'denied', () => false)
  ?? Promise.resolve(false);

/**
 * One camera-on period (start-camera → stop-camera). The page side only:
 * webcam + socket. Every frame is handled in services/gaze/camera.worker.
 */
class BrowserCamera {
  private stopped = false;
  private state: CameraState | null = null;
  private stream: MediaStream | null = null;
  private runId = 0;
  private ended: ((r: { gotFrame: boolean; fatal?: boolean }) => void) | null = null;

  constructor(private socket: Socket, private sessionId: string, private worker: Worker) {
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      // Warning ends from a stopped run still close its timeline; the rest is per run.
      if (m.type === 'event') this.socket.emit('cam-events', { sessionId: this.sessionId, events: [m.ev] });
      if (m.id !== this.runId) return;
      if (m.type === 'status') this.status(m.state);
      else if (m.type === 'frame') this.socket.volatile.emit('cam-frame', { sessionId: this.sessionId, jpeg: m.jpeg, ...m.info });
      else if (m.type === 'ended') this.ended?.(m);
    };
  }

  private status(state: CameraState) {
    if (state === this.state) return;
    this.state = state;
    this.socket.emit('camera-status', { sessionId: this.sessionId, state });
  }

  async run() {
    this.status('starting');
    while (!this.stopped) {
      if (await this.stream1()) return; // the model can't load: stay "error"
      if (this.stopped) break;
      await new Promise((r) => setTimeout(r, RETRY_OPEN_S * 1000));
      if (!this.stopped) this.status('starting');
    }
    this.status('off');
  }

  /** One camera-open attempt; resolves (true = fatal) when the camera is lost or stop() is called. */
  private async stream1(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
    } catch (e) {
      const name = (e as DOMException)?.name;
      // NotReadable = another app holds the webcam; NotAllowed = permission denied.
      this.status(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotReadableError' ? 'busy' : 'error');
      return false;
    }
    if (this.stopped) { this.release(); return false; }
    const { readable } = new MediaStreamTrackProcessor({ track: this.stream.getVideoTracks()[0] });
    this.runId = ++runIds;
    const ended = new Promise<{ gotFrame: boolean; fatal?: boolean }>((r) => { this.ended = r; });
    this.worker.postMessage({ type: 'start', readable, id: this.runId }, [readable as unknown as Transferable]);
    const { gotFrame, fatal } = await ended;
    this.release();
    // Lost mid-stream: the candidate turning off Chrome's camera permission ends
    // the track too, and that is "denied", not another app taking the webcam.
    if (!this.stopped && !fatal) this.status(!gotFrame ? 'error' : (await cameraDenied()) ? 'denied' : 'busy');
    return !!fatal;
  }

  private release() {
    this.stream?.getTracks().forEach((t) => t.stop()); // ends the worker's frame stream
    this.stream = null;
  }

  stop() {
    this.stopped = true;
    this.worker.postMessage({ type: 'stop' });
    this.release();
    this.ended?.({ gotFrame: false });
  }
}

/** Runs the browser camera for this session while `enabled` (Windows candidates after consent). */
export function useBrowserCamera(sessionId: string | undefined, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !sessionId) return;
    const socket = io(ENV.AUTH_API_URL, {
      transports: ['websocket', 'polling'],
      auth: (cb: (data: Record<string, unknown>) => void) =>
        cb({ client: 'camera', token: localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '' }),
    });
    const config = { viewers: 0, hd: false };
    // Made on the first start-camera: the model (~50 MB) only loads if the camera is used.
    let worker: Worker | null = null;
    let cam: BrowserCamera | null = null;
    // Chrome's camera permission for this site is the camera permission here
    // (the Windows Helper doesn't report one). A flip mid-interview becomes
    // Cortex's "turned off camera access" alert, like the Mac Helper's.
    let perm: PermissionStatus | null = null;
    const reportPermission = () => {
      if (perm && socket.connected) socket.emit('candidate-status', { sessionId, camera_granted: perm.state === 'granted' });
    };
    navigator.permissions?.query({ name: 'camera' as PermissionName }).then((s) => {
      perm = s;
      s.addEventListener('change', reportPermission);
      reportPermission();
    }).catch(() => {});
    socket.on('connect', () => {
      socket.emit('join-session', sessionId);
      reportPermission();
    });
    // Re-sent on every reconnect while the camera is on: start once.
    socket.on('start-camera', () => {
      if (cam) return;
      if (!worker) {
        worker = new Worker(new URL('../services/gaze/camera.worker.ts', import.meta.url), { type: 'module' });
        worker.postMessage({ type: 'config', ...config });
      }
      cam = new BrowserCamera(socket, sessionId, worker);
      void cam.run();
    });
    socket.on('stop-camera', () => { cam?.stop(); cam = null; });
    socket.on('cam-config', (c: { viewers?: number; hd?: boolean }) => {
      config.viewers = Math.max(0, Number(c?.viewers) || 0);
      config.hd = !!c?.hd;
      worker?.postMessage({ type: 'config', ...config });
    });
    return () => {
      perm?.removeEventListener('change', reportPermission);
      cam?.stop();
      worker?.terminate();
      socket.disconnect();
    };
  }, [sessionId, enabled]);
}

export type CameraPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

/** Chrome's camera permission for this site, and a way to ask for it before the interview. */
export function useCameraPermission(enabled: boolean): { permission: CameraPermission; request: () => Promise<void> } {
  const [permission, setPermission] = useState<CameraPermission>('unknown');
  useEffect(() => {
    if (!enabled || !navigator.permissions) return;
    let status: PermissionStatus | null = null;
    const sync = () => setPermission((status?.state as CameraPermission) ?? 'unknown');
    navigator.permissions.query({ name: 'camera' as PermissionName }).then((s) => {
      status = s;
      sync();
      s.addEventListener('change', sync);
    }).catch(() => {});
    return () => status?.removeEventListener('change', sync);
  }, [enabled]);
  const request = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
      setPermission('granted');
    } catch (e) {
      // Busy (Meet already has it) still means the permission was granted.
      setPermission((e as DOMException)?.name === 'NotReadableError' ? 'granted' : 'denied');
    }
  }, []);
  return { permission, request };
}
