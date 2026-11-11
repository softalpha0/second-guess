import { describe, expect, it } from 'vitest';
import { ClockAligner, headFromLandmarks, LM, SignalBuffer } from '../src/core/signals';
import type { Point } from '../src/core/live-metrics';

/** A simple fake face: 478 points, with the ones we use placed sensibly. */
function face(opts: { noseDx?: number; irisDx?: number } = {}): Point[] {
  const p: Point[] = Array.from({ length: 478 }, () => ({ x: 500, y: 350 }));
  p[LM.faceLeft] = { x: 400, y: 350 };
  p[LM.faceRight] = { x: 600, y: 350 };
  p[LM.forehead] = { x: 500, y: 250 };
  p[LM.chin] = { x: 500, y: 450 };
  p[LM.noseTip] = { x: 500 + (opts.noseDx ?? 0), y: 350 };
  p[LM.rEyeOuter] = { x: 430, y: 320 };
  p[LM.rEyeInner] = { x: 470, y: 320 };
  p[LM.rEyeTop] = { x: 450, y: 315 };
  p[LM.rEyeBottom] = { x: 450, y: 325 };
  p[LM.lEyeInner] = { x: 530, y: 320 };
  p[LM.lEyeOuter] = { x: 570, y: 320 };
  p[LM.lEyeTop] = { x: 550, y: 315 };
  p[LM.lEyeBottom] = { x: 550, y: 325 };
  p[LM.rIris] = { x: 450 + (opts.irisDx ?? 0), y: 320 };
  p[LM.lIris] = { x: 550 + (opts.irisDx ?? 0), y: 320 };
  return p;
}

describe('head and eye direction', () => {
  it('is centred for a forward face', () => {
    const h = headFromLandmarks(face())!;
    expect(h.yaw).toBeCloseTo(0);
    expect(h.pitch).toBeCloseTo(0);
    expect(h.gx).toBeCloseTo(0);
  });
  it('detects a head turn and an eye shift', () => {
    expect(headFromLandmarks(face({ noseDx: 40 }))!.yaw).toBeCloseTo(0.2);
    expect(headFromLandmarks(face({ irisDx: 8 }))!.gx).toBeCloseTo(0.2);
  });
  it('rejects too few points', () => {
    expect(headFromLandmarks(face().slice(0, 100))).toBeNull();
  });
  it('works without iris points (468-point mesh)', () => {
    expect(headFromLandmarks(face().slice(0, 468))!.gx).toBeNull();
  });
});

describe('clock aligner', () => {
  it('uses the smallest delay seen', () => {
    const c = new ClockAligner();
    c.observe(1_000_000, 5000); // reading at 1 s arrived at 5 s → offset 4000
    c.observe(2_000_000, 5500); // offset 3500 (less delay)
    expect(c.toMs(3_000_000)).toBe(6500);
  });
});

describe('recall window', () => {
  // 25 frames per second for 4 s, SDK clock = local clock (offset 0)
  function fill(buf: SignalBuffer, blinkAtFrames: number[] = []) {
    buf.addValidation('Ok', 0);
    for (let f = 0; f < 100; f++) {
      const t = f * 40;
      buf.ingest(
        {
          face: {
            blinking: [{ detected: blinkAtFrames.includes(f) || undefined, timestamp: t * 1000 }],
            landmarks: [{ value: face(), timestamp: t * 1000 }],
            expression: [{ timestamp: t * 1000, scores: [{ type: 'NEUTRAL', confidence: 80 }] }],
          },
          breathing: { upperTrace: [{ value: Math.sin(f / 5), timestamp: t * 1000 }] },
        },
        t,
      );
    }
  }

  it('reports good quality, blinks and thinned series', () => {
    const buf = new SignalBuffer();
    fill(buf, [10, 11, 50]);
    const w = buf.window(0, 3960);
    expect(w.quality.good).toBe(true);
    expect(w.quality.okFraction).toBe(1);
    expect(w.blinkOnsets).toEqual([400, 2000]); // frames 10–11 are one blink
    expect(w.head.length).toBeGreaterThan(30);
    expect(w.head.length).toBeLessThanOrEqual(45);
    expect(w.expr[0].v).toBe(20);
  });

  it('marks a window as poor when the camera signal is not Ok', () => {
    const buf = new SignalBuffer();
    fill(buf);
    buf.addValidation('NoFaceFound', 1000);
    expect(buf.window(1000, 3000).quality.good).toBe(false);
  });

  it('marks a window as poor when there are no face readings', () => {
    const buf = new SignalBuffer();
    buf.addValidation('Ok', 0);
    expect(buf.window(0, 2000).quality.good).toBe(false);
  });

  it('treats time after the camera stopped as no reading', () => {
    const buf = new SignalBuffer();
    fill(buf);
    buf.markStopped(2000);
    expect(buf.window(2000, 3900).quality.okFraction).toBe(0);
  });
});
