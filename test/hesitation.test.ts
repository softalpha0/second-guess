import { describe, expect, it } from 'vitest';
import {
  blinkStrength, breathStrength, expressionStrength, lookAwayStrength, recallStrength,
  scoreHesitation, verdictText, weightsFor,
} from '../src/core/hesitation';
import type { Baseline } from '../src/core/baseline';
import type { RecallSignals } from '../src/core/signals';

const baseline: Baseline = {
  createdAt: 'x',
  recallMedianMs: 1000,
  cardsUsed: 8,
  frontLength: 16,
  signalsMissingReason: null,
  signals: {
    blinkPerMin: 15,
    breathSpread: 1,
    head: { yaw: 0, pitch: 0, yawSpread: 0.02, pitchSpread: 0.02, gx: 0, gy: 0, gxSpread: 0.03, gySpread: 0.03 },
    expr: { level: 10, spread: 4 },
  },
};
const B = baseline.signals!;

/** A calm recall window: forward face, normal blinking, breathing, neutral face. */
function calm(durationMs: number, over: Partial<RecallSignals> = {}): RecallSignals {
  const n = Math.floor(durationMs / 100);
  return {
    fromMs: 0,
    toMs: durationMs,
    durationMs,
    quality: { okFraction: 1, faceRate: 25, good: true },
    blinkOnsets: Array.from({ length: Math.round((15 * durationMs) / 60000) }, (_, i) => 500 + i * 4000),
    head: Array.from({ length: n }, (_, i) => ({ t: i * 100, yaw: 0, pitch: 0, gx: 0, gy: 0 })),
    breath: Array.from({ length: n }, (_, i) => ({ t: i * 100, v: 2 * Math.sin((i / 40) * 2 * Math.PI) })),
    expr: Array.from({ length: n }, (_, i) => ({ t: i * 100, v: 10 })),
    talkingFraction: 0,
    ...over,
  };
}

describe('single signals', () => {
  it('recall time: normal pace counts 0, double counts some, 4× counts fully', () => {
    expect(recallStrength(1000, 1000)).toBe(0);
    expect(recallStrength(2000, 1000)).toBeCloseTo(1 / 3);
    expect(recallStrength(4000, 1000)).toBe(1);
  });

  it('looked away: counts the longest stretch away, not a quick glance', () => {
    const glance = calm(4000);
    for (const h of glance.head) if (h.t >= 1000 && h.t < 1300) h.yaw = 0.3;
    expect(lookAwayStrength(glance, B).strength).toBe(0);

    const away = calm(4000);
    for (const h of away.head) if (h.t >= 1000 && h.t < 3000) h.yaw = 0.3;
    expect(lookAwayStrength(away, B).longestMs).toBeGreaterThanOrEqual(1900);
    expect(lookAwayStrength(away, B).strength).toBe(1);
  });

  it('looked away: eyes alone count too', () => {
    const s = calm(4000);
    for (const h of s.head) if (h.t >= 500 && h.t < 2500) h.gy = -0.3; // eyes up
    expect(lookAwayStrength(s, B).strength).toBe(1);
  });

  it('looked away: losing the face is not counted as looking away', () => {
    const s = calm(4000);
    s.head = s.head.filter((h) => h.t < 1000 || h.t > 3000);
    for (const h of s.head) if (h.t >= 900 && h.t < 1000) h.yaw = 0.3;
    expect(lookAwayStrength(s, B).longestMs).toBeLessThan(600);
  });

  it('blinks: a burst counts, the usual number does not', () => {
    expect(blinkStrength(calm(4000), B).strength).toBe(0);
    const burst = calm(4000, { blinkOnsets: [200, 600, 1000, 1400, 1800, 2200] });
    expect(blinkStrength(burst, B)).toMatchObject({ kind: 'burst' });
    expect(blinkStrength(burst, B).strength).toBeGreaterThan(0.5);
  });

  it('blinks: no blinks over a long window counts as "stopped blinking"', () => {
    const r = blinkStrength(calm(16000, { blinkOnsets: [] }), B); // 4 expected
    expect(r.kind).toBe('none');
    expect(r.strength).toBe(1);
    expect(blinkStrength(calm(3000, { blinkOnsets: [] }), B).strength).toBe(0); // too short to tell
  });

  it('breath: a flat trace for 4 s counts, normal breathing does not', () => {
    expect(breathStrength(calm(6000), B).strength).toBe(0);
    const held = calm(6000);
    for (const p of held.breath) if (p.t >= 1000 && p.t <= 5200) p.v = 0.1;
    expect(breathStrength(held, B).strength).toBe(1);
  });

  it('expression: compared with your resting face', () => {
    expect(expressionStrength(calm(3000), B)).toBe(0);
    const s = calm(3000);
    for (const e of s.expr) e.v = 30; // 5 spreads above rest
    expect(expressionStrength(s, B)).toBe(1);
  });
});

describe('hesitation score', () => {
  it('a quick, calm right answer is "sure"', () => {
    const r = scoreHesitation({ correct: true, recallMs: 1100, signals: calm(1100), baseline });
    expect(r.verdict).toBe('sure');
    expect(r.score).toBeLessThan(10);
    expect(verdictText(r)).toBe('Right — you knew it');
  });

  it('a long pause with looking away is "hesitated", with both reasons', () => {
    const s = calm(4000);
    for (const h of s.head) if (h.t >= 1000 && h.t < 3000) h.yaw = 0.3;
    const r = scoreHesitation({ correct: true, recallMs: 4000, signals: s, baseline });
    expect(r.verdict).toBe('hesitated');
    expect(r.reasons).toEqual(['long pause', 'looked away']);
    expect(verdictText(r)).toBe('Right — but you hesitated: long pause, looked away');
  });

  it('a very long pause alone is enough', () => {
    const r = scoreHesitation({ correct: true, recallMs: 5000, signals: calm(5000), baseline });
    expect(r.verdict).toBe('hesitated');
    expect(r.reasons[0]).toBe('long pause');
  });

  it('a slightly slow answer alone is not enough', () => {
    expect(scoreHesitation({ correct: true, recallMs: 2000, signals: calm(2000), baseline }).verdict).toBe('sure');
  });

  it('poor camera view → not judged ("no reading")', () => {
    const s = calm(4000, { quality: { okFraction: 0.2, faceRate: 3, good: false } });
    const r = scoreHesitation({ correct: true, recallMs: 9000, signals: s, baseline });
    expect(r).toMatchObject({ verdict: 'no-reading', score: null });
  });

  it('wrong answers, camera off, or no camera baseline → not checked', () => {
    expect(scoreHesitation({ correct: false, recallMs: 9000, signals: calm(9000), baseline }).verdict).toBe('not-checked');
    expect(scoreHesitation({ correct: true, recallMs: 9000, signals: null, baseline }).verdict).toBe('not-checked');
    expect(scoreHesitation({ correct: true, recallMs: 9000, signals: calm(9000), baseline: { ...baseline, signals: null } }).verdict).toBe('not-checked');
  });

  it('long questions get a reading allowance', () => {
    // 4 s on a 16-char question is a long pause; on a 76-char question 2.1 s of it is reading
    const short = scoreHesitation({ correct: true, recallMs: 4000, signals: calm(4000), baseline, frontLength: 16 });
    const long = scoreHesitation({ correct: true, recallMs: 4000, signals: calm(4000), baseline, frontLength: 76 });
    expect(short.parts.recall).toBe(55);
    expect(long.parts.recall!).toBeLessThan(20);
  });

  it('switched-off signals are ignored', () => {
    const s = calm(4000);
    for (const h of s.head) if (h.t >= 1000 && h.t < 3000) h.yaw = 0.3;
    const r = scoreHesitation({ correct: true, recallMs: 1000, signals: s, baseline, weights: weightsFor({ lookAway: false }) });
    expect(r.verdict).toBe('sure');
    expect(r.parts.lookAway).toBeUndefined();
  });

  it('threshold is adjustable', () => {
    const s = calm(2500);
    const low = scoreHesitation({ correct: true, recallMs: 2500, signals: s, baseline, threshold: 10 });
    expect(low.verdict).toBe('hesitated');
  });

  it('never uses health or feeling words', () => {
    const s = calm(16000, { blinkOnsets: [] });
    for (const e of s.expr) e.v = 40;
    for (const h of s.head) h.yaw = 0.3;
    const r = scoreHesitation({ correct: true, recallMs: 16000, signals: s, baseline });
    expect(verdictText(r)).not.toMatch(/stress|anx|emotion|nervous|heart|health|pulse/i);
  });
});
