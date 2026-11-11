// Warm-up baseline (M5): "your normal", learned from 8 very easy cards.
// Every hesitation signal is later compared with these numbers, never with
// a fixed value. Pure, unit-tested.

import type { RecallSignals } from './signals';
import { median, robustSpread } from './stats';

export interface WarmupAnswer {
  recallMs: number;
  correct: boolean;
  /** Length of the question text, for the reading-time allowance. */
  frontLength?: number;
}

export interface SignalBaseline {
  /** Blinks per minute over the whole warm-up. */
  blinkPerMin: number;
  /** Typical size of the breathing trace's movement (robust spread). */
  breathSpread: number;
  /** Where your head and eyes normally point, and how much they wander. */
  head: {
    yaw: number;
    pitch: number;
    yawSpread: number;
    pitchSpread: number;
    gx: number | null;
    gy: number | null;
    gxSpread: number | null;
    gySpread: number | null;
  };
  /** 100 − NEUTRAL score: your resting face, and how much it varies. */
  expr: { level: number; spread: number } | null;
}

export interface Baseline {
  createdAt: string;
  /** Median recall time on the easy cards. */
  recallMedianMs: number;
  /** Average question length (characters) of the warm-up cards. */
  frontLength: number;
  cardsUsed: number;
  /** null when the camera was off or the signal was poor during warm-up. */
  signals: SignalBaseline | null;
  /** Why signals is null, in plain words. */
  signalsMissingReason: string | null;
}

// Floors stop a perfectly still warm-up from making tiny wobbles look huge later.
const FLOOR = { yaw: 0.02, pitch: 0.02, gaze: 0.03, breath: 0.05, expr: 3 };
const MIN_RECALL_MS = 400;
export const DEFAULT_FRONT_LENGTH = 16;

export function computeBaseline(answers: WarmupAnswer[], whole: RecallSignals | null, now = new Date()): Baseline {
  const right = answers.filter((a) => a.correct).map((a) => a.recallMs);
  const recallMedianMs = Math.max(MIN_RECALL_MS, median(right.length ? right : answers.map((a) => a.recallMs)) ?? 1500);
  const lens = answers.map((a) => a.frontLength).filter((n): n is number => typeof n === 'number');
  const frontLength = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : DEFAULT_FRONT_LENGTH;
  const base = { createdAt: now.toISOString(), recallMedianMs, frontLength, cardsUsed: right.length };

  if (!whole) return { ...base, signals: null, signalsMissingReason: 'Camera was off during the warm-up.' };
  if (!whole.quality.good) {
    return { ...base, signals: null, signalsMissingReason: 'The camera view was unclear for much of the warm-up.' };
  }

  const minutes = whole.durationMs / 60_000;
  const yaws = whole.head.map((h) => h.yaw);
  const pitches = whole.head.map((h) => h.pitch);
  const gxs = whole.head.map((h) => h.gx).filter((x): x is number => x !== null);
  const gys = whole.head.map((h) => h.gy).filter((x): x is number => x !== null);
  const exprs = whole.expr.map((e) => e.v);
  const breaths = whole.breath.map((b) => b.v);

  const signals: SignalBaseline = {
    blinkPerMin: minutes > 0 ? whole.blinkOnsets.length / minutes : 0,
    breathSpread: Math.max(FLOOR.breath, robustSpread(breaths) ?? 0),
    head: {
      yaw: median(yaws) ?? 0,
      pitch: median(pitches) ?? 0,
      yawSpread: Math.max(FLOOR.yaw, robustSpread(yaws) ?? 0),
      pitchSpread: Math.max(FLOOR.pitch, robustSpread(pitches) ?? 0),
      gx: median(gxs),
      gy: median(gys),
      gxSpread: gxs.length ? Math.max(FLOOR.gaze, robustSpread(gxs) ?? 0) : null,
      gySpread: gys.length ? Math.max(FLOOR.gaze, robustSpread(gys) ?? 0) : null,
    },
    expr: exprs.length ? { level: median(exprs) ?? 0, spread: Math.max(FLOOR.expr, robustSpread(exprs) ?? 0) } : null,
  };
  return { ...base, signals, signalsMissingReason: null };
}

/** One-line plain description for the warm-up result screen. */
export function describeBaseline(b: Baseline): string[] {
  const lines = [`You answer easy cards in about ${(b.recallMedianMs / 1000).toFixed(1)} s.`];
  if (b.signals) {
    lines.push(`You blink about ${Math.round(b.signals.blinkPerMin)} times a minute.`);
    lines.push('Your usual head position and breathing rhythm are noted.');
    if (b.signals.expr) lines.push('Your resting face is noted.');
  } else if (b.signalsMissingReason) {
    lines.push(`${b.signalsMissingReason} Only recall time will be used.`);
  }
  return lines;
}
