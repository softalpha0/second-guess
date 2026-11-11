// S2: signal replay for one card — turns a recall window into a few simple
// tracks for a small timeline: how far the head/eyes were from your usual
// direction (1 = the "looked away" line), blinks, breathing with flat parts
// marked, and expression change. Pure, unit-tested.

import type { Baseline } from './baseline';
import type { RecallSignals } from './signals';

export interface ReplayTracks {
  durationMs: number;
  /** Head/eye distance from usual, as a share of the "looked away" limit (≥1 = away). */
  away: { t: number; v: number }[];
  blinks: number[];
  /** Breathing trace scaled 0–1 for drawing. */
  breath: { t: number; v: number }[];
  /** Flat (held-breath) stretches ≥ 1.5 s. */
  flat: { from: number; to: number }[];
  /** Expression change vs resting face, in spreads (≥1.5 starts to count). */
  expr: { t: number; v: number }[];
  /** Recall time vs your warm-up pace. */
  recallMs: number;
  normalMs: number;
}

export function replayTracks(s: RecallSignals, b: Baseline, recallMs: number): ReplayTracks | null {
  const sb = b.signals;
  if (!sb) return null;
  const h = sb.head;
  const yawLim = Math.max(0.08, 4 * h.yawSpread);
  const pitchLim = Math.max(0.06, 4 * h.pitchSpread);
  const gxLim = h.gxSpread !== null ? Math.max(0.12, 4 * h.gxSpread) : null;
  const gyLim = h.gySpread !== null ? Math.max(0.12, 4 * h.gySpread) : null;
  const away = s.head.map((x) => {
    let v = Math.max(Math.abs(x.yaw - h.yaw) / yawLim, Math.abs(x.pitch - h.pitch) / pitchLim);
    if (gxLim && x.gx !== null && h.gx !== null) v = Math.max(v, Math.abs(x.gx - h.gx) / gxLim);
    if (gyLim && x.gy !== null && h.gy !== null) v = Math.max(v, Math.abs(x.gy - h.gy) / gyLim);
    return { t: x.t, v: Math.round(v * 100) / 100 };
  });

  const vals = s.breath.map((p) => p.v);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const breath = s.breath.map((p) => ({ t: p.t, v: (p.v - lo) / span }));

  // flat runs: consecutive points staying within 0.5 × usual spread
  const band = 0.5 * sb.breathSpread;
  const flat: ReplayTracks['flat'] = [];
  let start = 0;
  for (let i = 1; i <= s.breath.length; i++) {
    const seg = s.breath.slice(start, i + 1);
    const segVals = seg.map((p) => p.v);
    const broke = i === s.breath.length || Math.max(...segVals) - Math.min(...segVals) > band;
    if (broke) {
      const from = s.breath[start]?.t ?? 0;
      const to = s.breath[i - 1]?.t ?? 0;
      if (to - from >= 1500) flat.push({ from, to });
      start = i;
    }
  }

  const expr = sb.expr
    ? s.expr.map((e) => ({ t: e.t, v: Math.round(((e.v - sb.expr!.level) / sb.expr!.spread) * 100) / 100 }))
    : [];

  return { durationMs: s.durationMs, away, blinks: s.blinkOnsets, breath, flat, expr, recallMs, normalMs: b.recallMedianMs };
}
