// M6: hesitation score (0–100) and plain reasons for a RIGHT answer.
//
// Several weak signals from the recall window, each compared with the
// student's own warm-up baseline (never a fixed number), are turned into a
// 0–1 "strength", weighted and added up. Over the threshold → "hesitated";
// the two biggest contributors become the reasons shown.
// If the camera reading was poor, we don't judge. Pure, unit-tested.
//
// Words used: "hesitated" and the plain reason only — never stress,
// anxiety, emotion or health.

import type { Baseline } from './baseline';
import type { RecallSignals } from './signals';
import { median } from './stats';

export type SignalKey = 'recall' | 'lookAway' | 'blink' | 'breath' | 'expression' | 'pulse';

/** Starting weights (points at full strength). Tune with Check mode data (S1). */
export const DEFAULT_WEIGHTS: Record<SignalKey, number> = {
  recall: 55, // high
  lookAway: 30, // medium
  breath: 20, // medium
  blink: 15, // medium
  expression: 15, // low–medium
  pulse: 0, // too sparse per card (≈2 readings/min on our PC) — see CLAUDE.md
};

export const DEFAULT_THRESHOLD = 50;

/** Which signals the student has switched on in Settings (S4). Pulse is off by default. */
export const DEFAULT_ENABLED: Record<SignalKey, boolean> = {
  recall: true, lookAway: true, breath: true, blink: true, expression: true, pulse: false,
};

/** Weights with switched-off signals set to 0. */
export function weightsFor(enabled: Partial<Record<SignalKey, boolean>>): Record<SignalKey, number> {
  const w = { ...DEFAULT_WEIGHTS };
  for (const k of Object.keys(w) as SignalKey[]) if (enabled[k] === false) w[k] = 0;
  return w;
}

/**
 * Reading allowance: longer questions take longer to read, which isn't
 * hesitation. Each character beyond the warm-up's average length earns this
 * many ms (≈ a comfortable reading speed).
 */
export const READ_MS_PER_CHAR = 35;

/**
 * The pace a recall is compared with. The warm-up cards are trivial ("2 + 2"),
 * so real cards take longer even when known (first real data: "long pause" gave
 * 48 points on average to cards the student knew). So: at least 1.5× the
 * warm-up pace, and — once a few right answers exist in this session — the
 * median of those (reading-adjusted), whichever is slower. The median ignores
 * the occasional guess as long as most answers are known.
 */
export const WARMUP_FACTOR = 1.5;
export const MIN_SESSION_ANSWERS = 4;

export function recallReference(baseline: Baseline, sessionRecalls: number[] = []): number {
  const warm = baseline.recallMedianMs * WARMUP_FACTOR;
  if (sessionRecalls.length < MIN_SESSION_ANSWERS) return warm;
  return Math.max(warm, median(sessionRecalls) ?? warm);
}

export function readingAdjustedRecall(recallMs: number, frontLength: number | undefined, baseline: Baseline): number {
  if (frontLength === undefined) return recallMs;
  const extra = Math.max(0, frontLength - (baseline.frontLength ?? 16)) * READ_MS_PER_CHAR;
  return Math.max(Math.min(recallMs, baseline.recallMedianMs), recallMs - extra);
}

export type Verdict =
  | 'sure' // right, no hesitation
  | 'hesitated' // right, but hesitated
  | 'no-reading' // camera on, but the view was unclear → not judged
  | 'not-checked'; // wrong answer, or camera off / no baseline

export interface HesitationResult {
  verdict: Verdict;
  /** 0–100, or null when not judged. */
  score: number | null;
  /** Up to two plain reasons, e.g. ["long pause", "looked away"]. */
  reasons: string[];
  /** Points from each signal (for tuning and the replay view). */
  parts: Partial<Record<SignalKey, number>>;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** 0 at `lo`, 1 at `hi`, straight line between. */
const ramp = (x: number, lo: number, hi: number) => clamp01((x - lo) / (hi - lo));

// ---- individual signals → strength 0–1 (+ which words to use) ----

/** Recall time vs warm-up median. ~1.4× → 0, 2× → 0.33, 4× → 1 (log scale: doubling matters, not seconds). */
export function recallStrength(recallMs: number, baselineMs: number): number {
  return ramp(Math.log2(recallMs / baselineMs), 0.5, 2);
}

/** Longest stretch with head or eyes turned away from the usual direction. 0.6 s → 0, 1.8 s → 1. */
export function lookAwayStrength(s: RecallSignals, b: NonNullable<Baseline['signals']>): { strength: number; longestMs: number } {
  const h = b.head;
  const yawLim = Math.max(0.08, 4 * h.yawSpread);
  const pitchLim = Math.max(0.06, 4 * h.pitchSpread);
  const gxLim = h.gxSpread !== null ? Math.max(0.12, 4 * h.gxSpread) : null;
  const gyLim = h.gySpread !== null ? Math.max(0.12, 4 * h.gySpread) : null;
  const away = (x: RecallSignals['head'][number]) =>
    Math.abs(x.yaw - h.yaw) > yawLim ||
    Math.abs(x.pitch - h.pitch) > pitchLim ||
    (gxLim !== null && x.gx !== null && h.gx !== null && Math.abs(x.gx - h.gx) > gxLim) ||
    (gyLim !== null && x.gy !== null && h.gy !== null && Math.abs(x.gy - h.gy) > gyLim);

  let longest = 0;
  let runStart: number | null = null;
  let lastT = 0;
  for (const x of s.head) {
    // a gap of >400 ms without face points ends a run (face lost ≠ looked away)
    if (runStart !== null && x.t - lastT > 400) {
      longest = Math.max(longest, lastT - runStart);
      runStart = null;
    }
    if (away(x)) runStart ??= x.t;
    else if (runStart !== null) {
      longest = Math.max(longest, x.t - runStart);
      runStart = null;
    }
    lastT = x.t;
  }
  if (runStart !== null) longest = Math.max(longest, lastT - runStart);
  return { strength: ramp(longest, 600, 1800), longestMs: longest };
}

/** Blink burst (many more than usual) or blink suppression (none when some were expected). */
export function blinkStrength(s: RecallSignals, b: NonNullable<Baseline['signals']>): { strength: number; kind: 'burst' | 'none' | null } {
  const expected = (b.blinkPerMin * s.durationMs) / 60_000;
  const count = s.blinkOnsets.length;
  const burst = ramp(count - expected, 2, 5);
  const none = count === 0 ? ramp(expected, 1.5, 4) : 0;
  if (burst === 0 && none === 0) return { strength: 0, kind: null };
  return burst >= none ? { strength: burst, kind: 'burst' } : { strength: none, kind: 'none' };
}

/** Longest stretch where the breathing trace stays almost flat. 2 s → 0, 4 s → 1. */
export function breathStrength(s: RecallSignals, b: NonNullable<Baseline['signals']>): { strength: number; longestMs: number } {
  const band = 0.5 * b.breathSpread;
  const pts = s.breath;
  let longest = 0;
  let start = 0;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    lo = Math.min(lo, pts[i].v);
    hi = Math.max(hi, pts[i].v);
    // shrink from the left until the run fits inside the band again
    while (hi - lo > band && start < i) {
      start++;
      lo = Infinity;
      hi = -Infinity;
      for (let j = start; j <= i; j++) {
        lo = Math.min(lo, pts[j].v);
        hi = Math.max(hi, pts[j].v);
      }
    }
    longest = Math.max(longest, pts[i].t - pts[start].t);
  }
  return { strength: ramp(longest, 2000, 4000), longestMs: longest };
}

/** Face moved away from your resting expression (average over the window). */
export function expressionStrength(s: RecallSignals, b: NonNullable<Baseline['signals']>): number {
  if (!b.expr || s.expr.length === 0) return 0;
  const mean = s.expr.reduce((a, e) => a + e.v, 0) / s.expr.length;
  return ramp((mean - b.expr.level) / b.expr.spread, 1.5, 4);
}

// ---- combine ----

export interface ScoreInput {
  correct: boolean;
  recallMs: number;
  signals: RecallSignals | null;
  baseline: Baseline | null;
  weights?: Record<SignalKey, number>;
  threshold?: number;
  /** Question length in characters (reading allowance). */
  frontLength?: number;
  /** Reading-adjusted recall times of earlier RIGHT answers in this session. */
  sessionRecalls?: number[];
}

export function scoreHesitation(input: ScoreInput): HesitationResult {
  const { correct, recallMs, signals, baseline } = input;
  const w = input.weights ?? DEFAULT_WEIGHTS;
  const threshold = input.threshold ?? DEFAULT_THRESHOLD;
  const none = (verdict: Verdict): HesitationResult => ({ verdict, score: null, reasons: [], parts: {} });

  if (!correct) return none('not-checked');
  if (!baseline || !baseline.signals || !signals) return none('not-checked');
  if (!signals.quality.good) return none('no-reading');

  const b = baseline.signals;
  const candidates: { key: SignalKey; points: number; reason: string }[] = [];
  const add = (key: SignalKey, strength: number, reason: string) =>
    candidates.push({ key, points: w[key] * strength, reason });

  const adjusted = readingAdjustedRecall(recallMs, input.frontLength, baseline);
  add('recall', recallStrength(adjusted, recallReference(baseline, input.sessionRecalls)), 'long pause');
  add('lookAway', lookAwayStrength(signals, b).strength, 'looked away');
  const blink = blinkStrength(signals, b);
  add('blink', blink.strength, blink.kind === 'none' ? 'stopped blinking' : 'blinked a lot');
  add('breath', breathStrength(signals, b).strength, 'held breath');
  add('expression', expressionStrength(signals, b), 'expression changed');
  // pulse: weight 0 by default and no per-card reading — left out on purpose.

  const parts: HesitationResult['parts'] = {};
  for (const c of candidates) if (w[c.key] > 0) parts[c.key] = Math.round(c.points * 10) / 10;
  const score = Math.min(100, Math.round(candidates.reduce((a, c) => a + c.points, 0)));
  const reasons = candidates
    .filter((c) => c.points >= 8) // too small to be worth mentioning
    .sort((a, b2) => b2.points - a.points)
    .slice(0, 2)
    .map((c) => c.reason);

  return { verdict: score >= threshold ? 'hesitated' : 'sure', score, reasons, parts };
}

/** "Right — but you hesitated: long pause, looked away" */
export function verdictText(r: HesitationResult): string {
  switch (r.verdict) {
    case 'hesitated':
      return r.reasons.length ? `Right — but you hesitated: ${r.reasons.join(', ')}` : 'Right — but you hesitated';
    case 'sure':
      return 'Right — you knew it';
    case 'no-reading':
      return 'Right — no reading (camera view unclear)';
    default:
      return 'Right';
  }
}
