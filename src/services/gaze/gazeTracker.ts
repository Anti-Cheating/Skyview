/**
 * gazeTracker — Sentinel's live_camera.py gaze math, ported line for line.
 *
 * Runs in the candidate's browser on Windows (useBrowserCamera), where the
 * Helper can't hold the webcam without locking the meeting app out of it.
 * Same landmarks in (MediaPipe FaceLandmarker, 478 points, found on the
 * mirrored frame), same numbers and warnings out, so Cortex and the
 * interviewer's LiveCamPlayer can't tell the two sources apart.
 *
 * Keep in step with Sentinel os/window/live_camera.py: thresholds were
 * measured there (poc/eye_arrow). tests/services/gaze/gazeTracker.test.ts
 * replays the Python tracker's output on poc/gaze/clip1.mp4.
 */

type Vec = number[];
/** Landmarks in pixels, indexed like FaceMesh (only the indices below are read). */
type Points = Vec[];

// ── Gaze features (poc/eye_arrow/gaze_arrow.py) ────────────────────────

const EYES: [number, number, number][] = [[33, 133, 468], [362, 263, 473]]; // (corner, corner, iris center)
const LIDS: [number, number][] = [[159, 145], [386, 374]]; // (upper, lower), same order as EYES
const NOSE = 1, FACE_L = 234, FACE_R = 454, FOREHEAD = 10, CHIN = 152;
/** Every landmark index the math reads. */
export const GAZE_LANDMARKS = [...new Set([...EYES.flat(), ...LIDS.flat(), NOSE, FACE_L, FACE_R, FOREHEAD, CHIN])];

const LID_OPEN = 0.30;
const LID_GAIN = 1.0;
const HEAD_TRUST = 0.7;
const HEAD_W = 0.33;
const EYE_VIS = 0.7;

const sub = (a: Vec, b: Vec) => a.map((v, i) => v - b[i]);
const add = (a: Vec, b: Vec) => a.map((v, i) => v + b[i]);
const scale = (a: Vec, k: number) => a.map((v) => v * k);
const dot = (a: Vec, b: Vec) => a.reduce((s, v, i) => s + v * b[i], 0);
const norm = (a: Vec) => Math.hypot(...a);
const mean = (rows: Vec[]) => rows[0].map((_, i) => rows.reduce((s, r) => s + r[i], 0) / rows.length);
/** numpy.median(rows, axis=0). */
const median = (rows: Vec[]) => rows[0].map((_, i) => {
  const c = rows.map((r) => r[i]).sort((x, y) => x - y);
  const m = c.length >> 1;
  return c.length % 2 ? c[m] : (c[m - 1] + c[m]) / 2;
});

/** Iris offset from eye center, in half-eye-widths. x = image right, y = image down. */
function eyeVec(a: Vec, b: Vec, iris: Vec): Vec {
  let ux = sub(b, a);
  if (ux[0] < 0) ux = scale(ux, -1);
  const w = norm(ux);
  ux = scale(ux, 1 / w);
  const uy = [-ux[1], ux[0]];
  const d = sub(iris, scale(add(a, b), 0.5));
  return [dot(d, ux) / (w / 2), dot(d, uy) / (w / 2)];
}

/** Nose offset from face center, in half-face sizes. Crude yaw/pitch proxy. */
function headVec(p: Points): Vec {
  const yaw = (p[NOSE][0] - (p[FACE_L][0] + p[FACE_R][0]) / 2) / (Math.abs(p[FACE_R][0] - p[FACE_L][0]) / 2);
  const pitch = (p[NOSE][1] - (p[FOREHEAD][1] + p[CHIN][1]) / 2) / (Math.abs(p[CHIN][1] - p[FOREHEAD][1]) / 2);
  return [yaw, pitch];
}

/** Eyes facing the camera enough to read; the far eye on a head turn reads garbage. */
function visibleEyes(p: Points): number[] {
  const widths = EYES.map(([a, b]) => norm(sub(p[a], p[b])));
  const max = Math.max(...widths);
  return widths.flatMap((w, k) => (w >= EYE_VIS * max ? [k] : []));
}

/** Lid gap / eye width, mean of the readable eyes. */
function lidOpen(p: Points): number {
  const ks = visibleEyes(p);
  return ks.reduce((s, k) => s + norm(sub(p[LIDS[k][0]], p[LIDS[k][1]])) / norm(sub(p[EYES[k][0]], p[EYES[k][1]])), 0) / ks.length;
}

/** 0 with eyes open, up to 1 as lids close (eyes-down cue). */
function lidDown(p: Points): number {
  return Math.max(0, LID_OPEN - lidOpen(p)) / LID_OPEN;
}

/** [eye_x, eye_y, head_x, head_y]: eye = iris in socket + lid-closing DOWN cue, head = nose offset. */
function rawGaze(p: Points): Vec {
  const eye = mean(visibleEyes(p).map((k) => eyeVec(p[EYES[k][0]], p[EYES[k][1]], p[EYES[k][2]])));
  return [eye[0], eye[1] + LID_GAIN * lidDown(p), ...headVec(p)];
}

/** Where the person actually looks: eye-in-socket + head turn. */
function look(g: Vec): Vec {
  const eye = [g[0], Math.abs(g[2]) >= HEAD_TRUST ? 0 : g[1]];
  return add(eye, scale(g.slice(2, 4), HEAD_W));
}

// ── Warnings + drawn arrow (poc/eye_arrow/eye_arrow.py) ────────────────

const MIN_CUTOFF = 1.0, BETA = 0.3;
const REF_S = 2.0;
const WARN_S = 1.0, AWAY_S = 1.5;
const EYE_AWAY = 0.4;
const HEAD_TURN = 0.5;
const LIDS_CLOSED = 0.85;
const MOVE_SHIFT = 0.5, MOVE_SIZE = 0.2;
const LID_K = 2.0;
const ARROW_X_GAIN = 3.0;
const NORMAL_S = 20.0;
const SLIDE_RESET = 0.3;
const REBASE_S = 30.0;
const OUTLINE = [FACE_L, FACE_R, FOREHEAD, CHIN];

/** One Euro filter over a vector (Casiez et al., CHI 2012); one speed for the whole vector, as in Python. */
class OneEuro {
  private x: Vec | null = null;
  private dx: Vec = [];
  private t = 0;
  constructor(private mc: number, private beta: number, private dc = 1.0) {}

  filter(x: Vec, t: number): Vec {
    if (this.x === null || x.length !== this.x.length) {
      this.x = [...x];
      this.dx = x.map(() => 0);
      this.t = t;
      return x;
    }
    const dt = Math.max(t - this.t, 1e-3);
    this.t = t;
    const alpha = (fc: number) => 1.0 / (1.0 + 1.0 / (2 * Math.PI * fc * dt));
    const prev = this.x;
    this.dx = this.dx.map((d, i) => d + alpha(this.dc) * ((x[i] - prev[i]) / dt - d));
    const a = alpha(this.mc + this.beta * norm(this.dx));
    this.x = prev.map((v, i) => v + a * (x[i] - v));
    return this.x;
  }
}

/** Red arrow direction: look() minus the person's normal, y from the lids, x stretched. */
function drawnEye(g: Vec, opening: number, normal: [Vec, number]): Vec {
  const d = look(sub(g, normal[0]));
  d[1] += LID_K * (normal[1] - opening) / normal[1];
  return [d[0] * ARROW_X_GAIN, d[1]];
}

export type Warning = 'NO FACE' | 'MULTIPLE FACES' | 'HEAD MOVED' | 'HEAD TURNED' | 'EYES CLOSED' | 'EYES AWAY';

function conditions(nFaces: number, g: Vec, centre: Vec, width: number, lids: number, ref: [Vec, number] | null): Set<Warning> {
  if (nFaces === 0) return new Set(['NO FACE']);
  const out = new Set<Warning>(nFaces > 1 ? ['MULTIPLE FACES'] : []);
  if (ref && (norm(sub(centre, ref[0])) > MOVE_SHIFT * ref[1] || Math.abs(width / ref[1] - 1) > MOVE_SIZE)) out.add('HEAD MOVED');
  if (norm(g.slice(2, 4)) > HEAD_TURN) out.add('HEAD TURNED');
  if (lids > LIDS_CLOSED) out.add('EYES CLOSED');
  else if (norm(look(g)) > EYE_AWAY) out.add('EYES AWAY');
  return out;
}

export type WarningListener = (phase: 'start' | 'end', kind: Warning, start: number, t: number) => void;

/** Shows a warning once its condition has held long enough; reports each start / end. */
export class Warnings {
  private since = new Map<Warning, number>();
  shown = new Set<Warning>();
  started = new Map<Warning, number>();
  constructor(private onChange: WarningListener) {}

  update(active: Set<Warning>, t: number): Set<Warning> {
    this.since = new Map([...active].map((k) => [k, this.since.get(k) ?? t]));
    const shown = new Set([...this.since].filter(([k, t0]) => t - t0 >= (k === 'EYES AWAY' ? AWAY_S : WARN_S)).map(([k]) => k));
    for (const k of [...shown].filter((k) => !this.shown.has(k)).sort()) {
      this.started.set(k, this.since.get(k)!); // the condition began before the hold ran out
      this.onChange('start', k, this.since.get(k)!, t);
    }
    for (const k of [...this.shown].filter((k) => !shown.has(k)).sort()) {
      this.onChange('end', k, this.started.get(k) ?? t, t);
      this.started.delete(k);
    }
    this.shown = shown;
    return shown;
  }
}

/** What one frame sends next to its JPEG (same fields as Sentinel's cam-frame). */
export interface GazeInfo {
  faces: number;
  warnings: Warning[];
  eye?: [number, number];
  head?: [number, number];
  nose?: [number, number];
  irises?: [number, number][];
}

const r = (v: number, d: number) => Number(v.toFixed(d));

/** live_camera.GazeTracker.process as a per-frame step, on landmarks already found on the mirrored frame. */
export class GazeTracker {
  private smooth = new OneEuro(MIN_CUTOFF, BETA);
  readonly warn: Warnings;
  private ref: [Vec, number] | null = null;
  private refRows: Vec[] = [];
  private tStart: number | null = null;
  private recent: [number, Vec, Vec][] = [];
  private movedSince: number | null = null;

  constructor(onWarning: WarningListener) {
    this.warn = new Warnings(onWarning);
  }

  /** faces: normalized (0-1) landmarks per face, FaceMesh indexing; w/h: frame size in px; t: seconds. */
  process(faces: { x: number; y: number }[][], w: number, h: number, t: number): GazeInfo {
    let g: Vec | null = null;
    let centre: Vec = [], width = 0, lids = 0, opening = 0;
    let normal: [Vec, number] = [[], 0];
    let p: Points = [];
    if (faces.length) {
      p = [];
      for (const i of GAZE_LANDMARKS) p[i] = [faces[0][i].x * w, faces[0][i].y * h];
      const raw = rawGaze(p);
      centre = mean(OUTLINE.map((i) => p[i]));
      width = norm(sub(p[FACE_R], p[FACE_L]));
      lids = lidDown(p);
      const s = this.smooth.filter([...raw, lidOpen(p)], t);
      g = s.slice(0, 4);
      opening = s[4];
      const recent = this.recent;
      if (recent.length && norm(g.slice(2, 4)) < HEAD_TURN &&
          norm(sub(centre, median(recent.map(([, , c]) => c)))) > SLIDE_RESET * width) {
        recent.length = 0; // slid to a new spot: re-learn the normal there
      }
      if (norm(g.slice(2, 4)) < HEAD_TURN && norm(look(g)) < EYE_AWAY) recent.push([t, s, centre]);
      while (recent.length && recent[0][0] < t - NORMAL_S) recent.shift();
      const m = recent.length ? median(recent.map(([, x]) => x)) : s;
      normal = [m.slice(0, 4), m[4]];
      if (this.ref === null) { // learning the normal position
        this.tStart = this.tStart ?? t;
        this.refRows.push([...centre, width]);
        if (t - this.tStart >= REF_S) {
          const mr = median(this.refRows);
          this.ref = [mr.slice(0, 2), mr[2]];
        }
      }
    }
    const active = g ? conditions(faces.length, g, centre, width, lids, this.ref) : new Set<Warning>(['NO FACE']);
    if (active.has('HEAD MOVED')) {
      this.movedSince = this.movedSince ?? t;
      if (t - this.movedSince >= REBASE_S) { // sat somewhere new for good: that's normal now
        this.ref = [centre, width];
        this.movedSince = null;
        active.delete('HEAD MOVED');
      }
    } else {
      this.movedSince = null;
    }
    const shown = this.warn.update(active, t);
    const info: GazeInfo = { faces: faces.length, warnings: [...shown].sort() };
    if (g) {
      const eye = drawnEye(g, opening, normal);
      info.eye = [r(eye[0], 3), r(eye[1], 3)];
      info.head = [r(g[2], 3), r(g[3], 3)];
      info.nose = [r(p[NOSE][0] / w, 4), r(p[NOSE][1] / h, 4)];
      info.irises = visibleEyes(p).map((k) => [r(p[EYES[k][2]][0] / w, 4), r(p[EYES[k][2]][1] / h, 4)]);
    }
    return info;
  }
}
