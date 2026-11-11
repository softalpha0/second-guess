import { describe, expect, it } from 'vitest';
import { computeBaseline, describeBaseline } from '../src/core/baseline';
import type { RecallSignals } from '../src/core/signals';

function signals(overrides: Partial<RecallSignals> = {}): RecallSignals {
  return {
    fromMs: 0,
    toMs: 60_000,
    durationMs: 60_000,
    quality: { okFraction: 1, faceRate: 25, good: true },
    blinkOnsets: Array.from({ length: 15 }, (_, i) => i * 4000),
    head: Array.from({ length: 100 }, (_, i) => ({ t: i * 600, yaw: 0.01 * (i % 3), pitch: 0.1, gx: 0, gy: 0 })),
    breath: Array.from({ length: 100 }, (_, i) => ({ t: i * 600, v: Math.sin(i / 3) })),
    expr: Array.from({ length: 100 }, (_, i) => ({ t: i * 600, v: 10 + (i % 5) })),
    talkingFraction: 0,
    ...overrides,
  };
}

const answers = [1200, 1000, 1400, 900, 1100, 5000, 1300, 1000].map((recallMs) => ({ recallMs, correct: true }));

describe('warm-up baseline', () => {
  it('uses the median recall time, so one slow card does not skew it', () => {
    expect(computeBaseline(answers, signals()).recallMedianMs).toBe(1150);
  });

  it('ignores wrong answers for recall time', () => {
    const b = computeBaseline([...answers, { recallMs: 20000, correct: false }], null);
    expect(b.recallMedianMs).toBe(1150);
    expect(b.cardsUsed).toBe(8);
  });

  it('learns blink rate, head centre and resting face', () => {
    const b = computeBaseline(answers, signals());
    expect(b.signals!.blinkPerMin).toBe(15);
    expect(b.signals!.head.pitch).toBeCloseTo(0.1);
    expect(b.signals!.head.yawSpread).toBeGreaterThanOrEqual(0.02); // floor applies
    expect(b.signals!.expr!.level).toBe(12);
  });

  it('falls back to recall time only when the camera was off or unclear', () => {
    expect(computeBaseline(answers, null).signals).toBeNull();
    const poor = computeBaseline(answers, signals({ quality: { okFraction: 0.3, faceRate: 25, good: false } }));
    expect(poor.signals).toBeNull();
    expect(describeBaseline(poor).join(' ')).toMatch(/only recall time/i);
  });

  it('never goes below a sensible minimum recall time', () => {
    expect(computeBaseline([{ recallMs: 100, correct: true }], null).recallMedianMs).toBe(400);
  });
});
