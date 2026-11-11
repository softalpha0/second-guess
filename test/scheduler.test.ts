import { describe, expect, it } from 'vitest';
import { addDays, cardKey, deckProgress, grow, pickSession, schedule, whenText, type CardState } from '../src/core/scheduler';

const T = '2026-11-16';
const run = (outcomes: Parameters<typeof schedule>[0]['outcome'][], start: CardState | null = null) =>
  outcomes.reduce<CardState | null>((prev, outcome) => schedule({ prev, deckId: 'd', cardId: 'c', outcome, today: T }), start)!;

describe('intervals', () => {
  it('grow 1 → 3 → 7 → 16 → 35', () => {
    expect([0, 1, 3, 7, 16].map(grow)).toEqual([1, 3, 7, 16, 35]);
  });
  it('dates roll over months and years', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 7)).toBe('2027-01-07');
  });
});

describe('schedule', () => {
  it('confident right answers space out (a new card starts at 3 days)', () => {
    expect(run(['sure']).due).toBe(addDays(T, 3));
    const s = run(['sure', 'sure', 'sure']);
    expect(s.intervalDays).toBe(16);
    expect(s.due).toBe(addDays(T, 16));
  });

  it('a new card: knew it → 3 days, hesitated → tomorrow, not judged → 1 day', () => {
    expect(run(['sure']).intervalDays).toBe(3);
    expect(run(['hesitated']).due).toBe(addDays(T, 1));
    expect(run(['unjudged']).intervalDays).toBe(1);
  });

  it('a hesitated right answer comes back tomorrow and does not grow', () => {
    const before = run(['sure', 'sure']); // interval 7 → would be 16 next
    const s = schedule({ prev: before, deckId: 'd', cardId: 'c', outcome: 'hesitated', today: T });
    expect(s.due).toBe(addDays(T, 1));
    expect(s.intervalDays).toBe(7);
    expect(s.hesitations).toBe(1);
    // known for real next time → continues from where it was
    expect(schedule({ prev: s, deckId: 'd', cardId: 'c', outcome: 'sure', today: T }).intervalDays).toBe(16);
  });

  it('wrong resets the interval and comes back tomorrow', () => {
    const s = run(['sure', 'sure', 'wrong']);
    expect(s).toMatchObject({ intervalDays: 0, due: addDays(T, 1), lapses: 1 });
  });

  it('right on the retry in the same session still comes back tomorrow', () => {
    const wrong = run(['sure', 'wrong']);
    const retry = schedule({ prev: wrong, deckId: 'd', cardId: 'c', outcome: 'sure', today: T, failedThisSession: true });
    expect(retry).toMatchObject({ intervalDays: 0, due: addDays(T, 1), lapses: 1 });
  });

  it('a second miss in the same session is not another lapse', () => {
    const wrong = run(['wrong']);
    const again = schedule({ prev: wrong, deckId: 'd', cardId: 'c', outcome: 'wrong', today: T, failedThisSession: true });
    expect(again.lapses).toBe(1);
  });

  it('right but not judged (no reading) is scheduled normally', () => {
    expect(run(['unjudged', 'unjudged']).intervalDays).toBe(3);
  });
});

describe('picking a session', () => {
  const cards = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
  const st = (id: string, due: string): CardState => ({
    deckId: 'd', cardId: id, intervalDays: 3, due, reps: 1, lapses: 0, hesitations: 0, last: 'sure', lastReviewed: T,
  });

  it('due cards first (most overdue first), then new ones', () => {
    const states = { [cardKey('d', 'c')]: st('c', '2026-11-15'), [cardKey('d', 'a')]: st('a', '2026-11-10'), [cardKey('d', 'b')]: st('b', '2026-11-20') };
    const r = pickSession(cards, 'd', states, T, 10);
    expect(r.cards.map((c) => c.id)).toEqual(['a', 'c', 'd', 'e']);
    expect(r.practice).toBe(false);
    expect(deckProgress(cards.map((c) => c.id), 'd', states, T)).toEqual({ due: 2, fresh: 2, total: 5 });
  });

  it('when everything is done, offers practice with the soonest cards', () => {
    const states = Object.fromEntries(cards.map((c, i) => [cardKey('d', c.id), st(c.id, addDays(T, 5 - i))]));
    const r = pickSession(cards, 'd', states, T, 2);
    expect(r.practice).toBe(true);
    expect(r.cards.map((c) => c.id)).toEqual(['e', 'd']);
  });

  it('respects the session size', () => {
    expect(pickSession(cards, 'd', {}, T, 3).cards).toHaveLength(3);
  });
});

describe('wording', () => {
  it('says today / tomorrow / in N days', () => {
    expect(whenText(T, T)).toBe('today');
    expect(whenText(addDays(T, 1), T)).toBe('tomorrow');
    expect(whenText(addDays(T, 7), T)).toBe('in 7 days');
  });
});
