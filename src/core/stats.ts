// Tiny statistics helpers. Pure.
export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Robust spread: median absolute deviation scaled to match a standard deviation. */
export function robustSpread(xs: number[]): number | null {
  const m = median(xs);
  if (m === null) return null;
  return (median(xs.map((x) => Math.abs(x - m))) ?? 0) * 1.4826;
}
