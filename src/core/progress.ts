// S3: progress over days, from the review history. Pure, unit-tested.

export interface ReviewLike {
  deckId: string;
  cardId: string;
  at: string; // ISO time
  correct: boolean;
  verdict?: string;
  /** Check mode: the student's own answer overrides the app's hidden verdict. */
  selfGuess?: boolean;
}

export interface DayStat {
  day: string; // YYYY-MM-DD (local)
  sure: number;
  hesitated: number;
  wrong: number;
  other: number;
}

export interface Progress {
  days: DayStat[];
  /** Cards that were once right-but-hesitated and later answered right and sure. */
  luckyBecameSure: number;
  /** Cards whose most recent answer is still right-but-hesitated. */
  stillShaky: number;
  totalReviews: number;
}

function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function progress(reviews: ReviewLike[], lastNDays: number, today: string): Progress {
  const sorted = [...reviews].sort((a, b) => a.at.localeCompare(b.at));
  // day buckets for the last N days (oldest first)
  const [ty, tm, td] = today.split('-').map(Number);
  const days: DayStat[] = [];
  for (let i = lastNDays - 1; i >= 0; i--) {
    const d = new Date(ty, tm - 1, td - i);
    days.push({ day: localDay(d.toISOString()), sure: 0, hesitated: 0, wrong: 0, other: 0 });
  }
  const byDay = new Map(days.map((d) => [d.day, d]));

  const wasLucky = new Set<string>();
  const became = new Set<string>();
  const lastVerdict = new Map<string, string>();
  for (const r of sorted) {
    const key = `${r.deckId}|${r.cardId}`;
    const verdict = r.selfGuess !== undefined ? (r.selfGuess ? 'hesitated' : 'sure') : r.verdict;
    const kind = !r.correct ? 'wrong' : verdict === 'hesitated' ? 'hesitated' : verdict === 'sure' ? 'sure' : 'other';
    const bucket = byDay.get(localDay(r.at));
    if (bucket) bucket[kind as 'sure' | 'hesitated' | 'wrong' | 'other']++;
    if (kind === 'hesitated') wasLucky.add(key);
    if (kind === 'sure' && wasLucky.has(key)) became.add(key);
    lastVerdict.set(key, kind);
  }
  let stillShaky = 0;
  for (const v of lastVerdict.values()) if (v === 'hesitated') stillShaky++;
  return { days, luckyBecameSure: became.size, stillShaky, totalReviews: reviews.length };
}
