// Tuning helper (Nov 19): from Check-mode reviews (the student's honest Y/N
// plus the per-signal points the app gave), find how well each threshold
// would have agreed, and which signals actually separate guesses from
// known answers. Pure, unit-tested; used by `npm run tune`.

import { agreement, type Agreement } from './check-mode';

export interface TuneReview {
  correct: boolean;
  checkMode?: boolean;
  selfGuess?: boolean;
  verdict?: string;
  score?: number | null;
  parts?: Record<string, number>;
}

export interface ThresholdRow extends Agreement {
  threshold: number;
}

export interface SignalRow {
  signal: string;
  /** Average points this signal gave on cards you said were guesses / known. */
  avgOnGuesses: number;
  avgOnKnown: number;
  /** avgOnGuesses − avgOnKnown: bigger = more useful. */
  separation: number;
}

export interface TuneReport {
  usable: number;
  guesses: number;
  known: number;
  current: Agreement;
  thresholds: ThresholdRow[];
  best: ThresholdRow | null;
  signals: SignalRow[];
}

/** Right answers from Check mode that were actually judged (have a score). */
export function usableReviews(reviews: TuneReview[]): (TuneReview & { score: number; selfGuess: boolean })[] {
  return reviews.filter(
    (r): r is TuneReview & { score: number; selfGuess: boolean } =>
      r.correct && !!r.checkMode && typeof r.selfGuess === 'boolean' && typeof r.score === 'number',
  );
}

export function tune(reviews: TuneReview[], thresholds = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80]): TuneReport {
  const rs = usableReviews(reviews);
  const current = agreement(rs.map((r) => ({ appHesitated: r.verdict === 'hesitated', selfGuess: r.selfGuess })));
  const rows: ThresholdRow[] = thresholds.map((t) => ({
    threshold: t,
    ...agreement(rs.map((r) => ({ appHesitated: r.score >= t, selfGuess: r.selfGuess }))),
  }));
  // best agreement; on a tie prefer the one closest to the default 50
  const best = rs.length
    ? [...rows].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0) || Math.abs(a.threshold - 50) - Math.abs(b.threshold - 50))[0]
    : null;

  const keys = [...new Set(rs.flatMap((r) => Object.keys(r.parts ?? {})))].sort();
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const signals = keys
    .map((k) => {
      const g = avg(rs.filter((r) => r.selfGuess).map((r) => r.parts?.[k] ?? 0));
      const n = avg(rs.filter((r) => !r.selfGuess).map((r) => r.parts?.[k] ?? 0));
      return { signal: k, avgOnGuesses: Math.round(g * 10) / 10, avgOnKnown: Math.round(n * 10) / 10, separation: Math.round((g - n) * 10) / 10 };
    })
    .sort((a, b) => b.separation - a.separation);

  return {
    usable: rs.length,
    guesses: rs.filter((r) => r.selfGuess).length,
    known: rs.filter((r) => !r.selfGuess).length,
    current,
    thresholds: rows,
    best,
    signals,
  };
}
