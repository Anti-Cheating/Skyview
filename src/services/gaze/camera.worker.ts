/**
 * camera.worker — the browser camera's per-frame work, off the page's main
 * thread (useBrowserCamera). FaceLandmarker takes tens of ms per 720p frame
 * on a laptop CPU; on the main thread that froze the candidate's tab and
 * bunched up the frames sent to the interviewer.
 *
 * In:  start {readable}  — the webcam's VideoFrame stream (MediaStreamTrackProcessor)
 *      config {viewers, hd}
 *      stop
 * Out: status {state} · event {ev} · frame {jpeg, info} · ended {gotFrame}
 */

/// <reference lib="webworker" />
import { FaceLandmarker } from '@mediapipe/tasks-vision';
// The package's `exports` hide wasm/; a relative ?url import gets Vite to ship it as an asset.
import wasmLoaderPath from '../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js?url';
import wasmBinaryPath from '../../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm?url';
import modelAssetPath from '../../assets/mediapipe/face_landmarker.task?url';
import { GazeTracker, type Warning } from './gazeTracker';

declare const self: DedicatedWorkerGlobalScope;

// Same as live_camera.py.
const PROCESS_FPS = 15;
const SEND_SIZES = { mini: [480, 270, 10], hd: [960, 540, 12] } as const;
const JPEG_QUALITY = 0.6;

let landmarker: Promise<FaceLandmarker> | null = null;
function getLandmarker(): Promise<FaceLandmarker> {
  landmarker ??= (async () => {
    // tasks-vision loads its wasm glue with importScripts, which throws in a
    // module worker (Vite's workers are modules). Run the glue ourselves in
    // global scope (indirect eval defines its ModuleFactory) and make
    // tasks-vision's own load a no-op.
    const glue = await (await fetch(wasmLoaderPath)).text();
    (0, eval)(glue);
    (self as unknown as { importScripts: () => void }).importScripts = () => {};
    return FaceLandmarker.createFromOptions(
      { wasmLoaderPath, wasmBinaryPath },
      { baseOptions: { modelAssetPath, delegate: 'CPU' }, runningMode: 'VIDEO', numFaces: 2 },
    );
  })().catch((e) => { landmarker = null; throw e; });
  return landmarker;
}

const round3 = (v: number) => Number(v.toFixed(3));
const config = { viewers: 0, hd: false };
let reader: ReadableStreamDefaultReader<VideoFrame> | null = null;
/** Id of the run that owns the camera now; 0 = stopped. Messages carry it so the page drops stale ones. */
let current = 0;

const postFor = (id: number) => (msg: object, transfer: Transferable[] = []) => self.postMessage({ ...msg, id }, transfer);

async function run(readable: ReadableStream<VideoFrame>, id: number) {
  current = id;
  const post = postFor(id);
  let lm: FaceLandmarker;
  try {
    lm = await getLandmarker();
  } catch (e) {
    console.error('[camera.worker] FaceLandmarker failed to load', e);
    post({ type: 'status', state: 'error' });
    void readable.cancel();
    post({ type: 'ended', gotFrame: false, fatal: true });
    return;
  }
  const r = readable.getReader();
  reader = r;
  const onWarning = (phase: 'start' | 'end', type: Warning, start: number, t: number) =>
    post({ type: 'event', ev: { type, phase, start: round3(start), ...(phase === 'end' ? { end: round3(t), duration_s: Number((t - start).toFixed(2)) } : {}) } });
  const tracker = new GazeTracker(onWarning);
  const view = new OffscreenCanvas(1, 1);
  const ctx = view.getContext('2d')!;
  const small = new OffscreenCanvas(1, 1);
  const sctx = small.getContext('2d')!;
  let nextProc = 0, nextSend = 0, gotFrame = false;
  try {
    while (current === id) {
      const { value: frame, done } = await r.read();
      if (done) break; // camera lost, or stop()
      const now = performance.now() / 1000;
      if (now < nextProc) { frame.close(); continue; }
      nextProc = now + 1 / PROCESS_FPS;
      const w = frame.displayWidth, h = frame.displayHeight;
      if (view.width !== w || view.height !== h) { view.width = w; view.height = h; }
      // Selfie view, landmarks found on it directly (live_camera.py flips the same way).
      ctx.setTransform(-1, 0, 0, 1, w, 0);
      ctx.drawImage(frame, 0, 0);
      frame.close();
      const res = lm.detectForVideo(view, performance.now());
      if (!gotFrame) { gotFrame = true; post({ type: 'status', state: 'live' }); }
      const info = tracker.process(res.faceLandmarks, w, h, Date.now() / 1000);
      if (config.viewers > 0 && now >= nextSend) {
        const [sw, sh, fps] = SEND_SIZES[config.hd ? 'hd' : 'mini'];
        // Running schedule (see live_camera.py): restarting the clock each send aliases fps down.
        nextSend = Math.max(nextSend + 1 / fps, now - 1 / fps);
        if (small.width !== sw || small.height !== sh) { small.width = sw; small.height = sh; }
        sctx.drawImage(view, 0, 0, sw, sh);
        const jpeg = await (await small.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })).arrayBuffer();
        post({ type: 'frame', jpeg, info }, [jpeg]);
      }
    }
  } finally {
    const now = Date.now() / 1000;
    for (const k of [...tracker.warn.shown].sort()) onWarning('end', k, tracker.warn.started.get(k) ?? now, now);
    void r.cancel().catch(() => {});
    if (reader === r) reader = null;
    post({ type: 'ended', gotFrame });
  }
}

self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.type === 'start') void run(m.readable, m.id);
  else if (m.type === 'config') Object.assign(config, { viewers: m.viewers, hd: m.hd });
  else if (m.type === 'stop') { current = 0; void reader?.cancel().catch(() => {}); }
};
