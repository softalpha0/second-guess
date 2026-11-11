// Study loop (M4) as a small state machine:
//   front shown → Space (reveal) → Right / Wrong → next card.
// The recall window is front shown → reveal. Pure, unit-tested.

import type { Card } from './deck-import';

export type Phase = 'front' | 'back' | 'done';

export interface CardResult {
  card: Card;
  shownAt: number;
  revealedAt: number;
  recallMs: number;
  correct: boolean;
}

export const DEFAULT_SESSION_SIZE = 20;

/** Fisher–Yates shuffle with an injectable random source (for tests). */
export function shuffle<T>(xs: T[], rand: () => number = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class StudySession {
  readonly queue: Card[];
  private i = 0;
  phase: Phase = 'front';
  shownAt = 0;
  revealedAt = 0;
  readonly results: CardResult[] = [];

  constructor(cards: Card[], now: number, opts: { size?: number; shuffle?: boolean; rand?: () => number } = {}) {
    const ordered = opts.shuffle === false ? cards : shuffle(cards, opts.rand);
    this.queue = ordered.slice(0, opts.size ?? DEFAULT_SESSION_SIZE);
    this.shownAt = now;
    if (this.queue.length === 0) this.phase = 'done';
  }

  get current(): Card | null {
    return this.phase === 'done' ? null : this.queue[this.i];
  }

  get position(): { index: number; total: number } {
    return { index: Math.min(this.i + 1, this.queue.length), total: this.queue.length };
  }

  /**
   * Wrong answer: bring the card back later in this session, `gap` cards from
   * now (or at the end if fewer are left). Call after answer().
   */
  requeue(card: Card, gap = 3): void {
    const at = Math.min(this.i + gap, this.queue.length);
    this.queue.splice(at, 0, card);
    if (this.phase === 'done') {
      this.phase = 'front';
      this.shownAt = this.revealedAt;
    }
  }

  /** Space: show the answer. Returns the recall time, or null if not on a front. */
  reveal(now: number): number | null {
    if (this.phase !== 'front') return null;
    this.phase = 'back';
    this.revealedAt = now;
    return now - this.shownAt;
  }

  /** → / ←: mark Right or Wrong and move on. Returns the result, or null if not on a back. */
  answer(correct: boolean, now: number): CardResult | null {
    if (this.phase !== 'back') return null;
    const card = this.queue[this.i];
    const result: CardResult = {
      card,
      shownAt: this.shownAt,
      revealedAt: this.revealedAt,
      recallMs: this.revealedAt - this.shownAt,
      correct,
    };
    this.results.push(result);
    this.i++;
    if (this.i >= this.queue.length) this.phase = 'done';
    else {
      this.phase = 'front';
      this.shownAt = now;
    }
    return result;
  }
}
