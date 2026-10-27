import { describe, expect, it } from 'vitest';
import fixture from './clip1.fixture.json';
import { GazeTracker, GAZE_LANDMARKS } from '../../../src/services/gaze/gazeTracker';

// Sentinel's Python GazeTracker run on poc/gaze/clip1.mp4 with FaceLandmarker
// landmarks (the browser's model): per frame the landmarks it read + its output.
interface Fixture {
  w: number;
  h: number;
  frames: { t: number; faces: Record<string, [number, number]>[]; info: Record<string, unknown> }[];
  events: [string, string, number, number][];
}
const fx = fixture as unknown as Fixture;

describe('gazeTracker matches Sentinel live_camera.py', () => {
  const events: [string, string, number, number][] = [];
  const tracker = new GazeTracker((ph, k, s, t) => events.push([ph, k, Number(s.toFixed(3)), Number(t.toFixed(3))]));
  const out = fx.frames.map(({ t, faces }) => {
    const landmarks = faces.map((f) => {
      const pts: { x: number; y: number }[] = [];
      for (const i of GAZE_LANDMARKS) pts[i] = { x: f[i][0], y: f[i][1] };
      return pts;
    });
    return tracker.process(landmarks, fx.w, fx.h, t);
  });

  it('same warning starts and ends at the same times', () => {
    expect(events).toEqual(fx.events);
  });

  it('same faces, warnings and arrow numbers on every frame', () => {
    out.forEach((info, i) => {
      const want = fx.frames[i].info as Record<string, number[] | number[][] | string[] | number>;
      expect(info.faces).toBe(want.faces);
      expect(info.warnings).toEqual(want.warnings);
      for (const k of ['eye', 'head', 'nose', 'irises'] as const) {
        const got = (info[k] ?? []).flat() as number[];
        const exp = ((want[k] as number[] | number[][]) ?? []).flat() as number[];
        expect(got.length).toBe(exp.length);
        // Rounded to 3-4 decimals on both sides: allow one unit in the last place.
        got.forEach((v, j) => expect(Math.abs(v - exp[j])).toBeLessThanOrEqual(k === 'eye' || k === 'head' ? 1.01e-3 : 1.01e-4));
      }
    });
  });
});
