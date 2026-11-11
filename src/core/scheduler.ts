// M7: scheduler — simple growing intervals (not FSRS).
//
//   Right, sure        → next interval: 1 → 3 → 7 → 16 → 35 … days
//                        (a brand-new card known confidently starts at 3 days,
//                         so it differs from a lucky guess from day one)
//   Right, hesitated   → tomorrow, interval NOT grown
//   Wrong              → again in this session, then tomorrow (interval reset)
//   Right, no reading / camera off → scheduled normally (not judged)
//
// Days are local calendar dates "YYYY-MM-DD". Pure, unit-tested.

export interface CardState {
  deckId: string;
  cardId: string;
  /** Current interval in days (0 = new or just failed). */
  intervalDays: number;
  /** Next review date, YYYY-MM-DD. */
  due: string;
  reps: number;
  lapses: number;
  hesitations: number;
  last: Outcome;
  lastReviewed: string;
}

export type Outcome = 'sure' | 'hesitated' | 'wrong' | 'unjudged';

export const LADDER = [1, 3, 7, 16];
/** First interval for a NEW card answered right and confidently (checked by the camera). */
export const NEW_SURE_DAYS = 3;

/** Next interval after a confident right answer. */
export function grow(interval: number): number {
  if (interval <= 0) return LADDER[0];
  const i = LADDER.indexOf(interval);
  if (i >= 0 && i < LADDER.length - 1) return LADDER[i + 1];
  if (interval < LADDER[LADDER.length - 1]) return LADDER.find((d) => d > interval) ?? interval * 2;
  return Math.round(interval * 2.2);
}

export function toDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return toDay(new Date(y, m - 1, d + n));
}

export const cardKey = (deckId: string, cardId: string) => `${deckId}|${cardId}`;

export interface ScheduleInput {
  prev: CardState | null;
  deckId: string;
  cardId: string;
  outcome: Outcome;
  today: string;
  /** This card was already answered wrong earlier in this session. */
  failedThisSession?: boolean;
}

export function schedule({ prev, deckId, cardId, outcome, today, failedThisSession }: ScheduleInput): CardState {
  const base: CardState = prev ?? {
    deckId, cardId, intervalDays: 0, due: today, reps: 0, lapses: 0, hesitations: 0, last: 'unjudged', lastReviewed: today,
  };
  const s: CardState = { ...base, reps: base.reps + 1, last: outcome, lastReviewed: today };

  if (outcome === 'wrong') {
    // a second miss in the same session doesn't count as another lapse
    return { ...s, intervalDays: 0, due: addDays(today, 1), lapses: base.lapses + (failedThisSession ? 0 : 1) };
  }
  if (failedThisSession) {
    // right on the retry: still comes back tomorrow, no growth
    return { ...s, intervalDays: 0, due: addDays(today, 1) };
  }
  if (outcome === 'hesitated') {
    return { ...s, due: addDays(today, 1), hesitations: base.hesitations + 1 };
  }
  // sure, or right but not judged (no reading / camera off)
  const next = outcome === 'sure' && prev === null ? NEW_SURE_DAYS : grow(base.intervalDays);
  return { ...s, intervalDays: next, due: addDays(today, next) };
}

export interface DeckProgress {
  due: number;
  fresh: number;
  total: number;
}

export function deckProgress(cardIds: string[], deckId: string, states: Record<string, CardState>, today: string): DeckProgress {
  let due = 0;
  let fresh = 0;
  for (const id of cardIds) {
    const st = states[cardKey(deckId, id)];
    if (!st) fresh++;
    else if (st.due <= today) due++;
  }
  return { due, fresh, total: cardIds.length };
}

/**
 * Pick cards for a session: due cards first (most overdue first), then new
 * cards in deck order, up to `size`. If nothing is due or new, `practice`
 * returns the cards due soonest so the student can still study.
 */
export function pickSession<T extends { id: string }>(
  cards: T[],
  deckId: string,
  states: Record<string, CardState>,
  today: string,
  size: number,
): { cards: T[]; practice: boolean } {
  const due = cards
    .filter((c) => states[cardKey(deckId, c.id)]?.due <= today)
    .sort((a, b) => states[cardKey(deckId, a.id)].due.localeCompare(states[cardKey(deckId, b.id)].due));
  const fresh = cards.filter((c) => !states[cardKey(deckId, c.id)]);
  const picked = [...due, ...fresh].slice(0, size);
  if (picked.length) return { cards: picked, practice: false };
  const soonest = [...cards].sort((a, b) =>
    states[cardKey(deckId, a.id)].due.localeCompare(states[cardKey(deckId, b.id)].due),
  );
  return { cards: soonest.slice(0, size), practice: true };
}

/** Plain wording for when a card comes back. */
export function whenText(due: string, today: string): string {
  if (due <= today) return 'today';
  if (due === addDays(today, 1)) return 'tomorrow';
  const [y, m, d] = due.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const days = Math.round((new Date(y, m - 1, d).getTime() - new Date(ty, tm - 1, td).getTime()) / 86_400_000);
  return `in ${days} days`;
}
