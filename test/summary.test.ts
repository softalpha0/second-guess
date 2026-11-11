import { describe, expect, it } from 'vitest';
import { summarize, type Attempt } from '../src/core/summary';

const TOM = '2026-11-17';
const at = (o: Partial<Attempt> & { cardId: string }): Attempt => ({
  front: o.cardId.toUpperCase(), back: 'x', correct: true, verdict: 'sure', reasons: [], overridden: false,
  retry: false, recallMs: 1000, due: '2026-11-19', ...o,
});

describe('session summary', () => {
  const attempts = [
    at({ cardId: 'a' }),
    at({ cardId: 'b', verdict: 'hesitated', reasons: ['long pause', 'looked away'], due: TOM, recallMs: 5000 }),
    at({ cardId: 'c', verdict: 'hesitated', reasons: ['long pause'], due: TOM }),
    at({ cardId: 'd', correct: false, verdict: 'not-checked', due: TOM }),
    at({ cardId: 'd', correct: true, retry: true, due: TOM }), // right on retry
    at({ cardId: 'e', verdict: 'no-reading' }),
    at({ cardId: 'f', verdict: 'hesitated', overridden: true, reasons: [], due: TOM }),
    at({ cardId: 'g', verdict: 'not-checked', due: TOM }), // just next due tomorrow
  ];
  const s = summarize(attempts, TOM, true);

  it('counts cards by their first attempt', () => {
    expect(s).toMatchObject({ studied: 7, right: 6, wrong: 1, sure: 1, hesitated: 3, unjudged: 2, overrides: 1, tomorrowOther: 1 });
  });

  it('ranks the reasons, ignoring overridden cards', () => {
    expect(s.topReasons).toEqual([{ reason: 'long pause', count: 2 }, { reason: 'looked away', count: 1 }]);
  });

  it('lists cards coming back tomorrow with why', () => {
    expect(s.tomorrow.map((t) => [t.front, t.why])).toEqual([['B', 'hesitated'], ['C', 'hesitated'], ['D', 'wrong'], ['F', 'hesitated']]);
  });

  it('averages recall time over first attempts', () => {
    expect(s.avgRecallMs).toBeCloseTo((1000 * 6 + 5000) / 7);
  });

  it('handles an empty session', () => {
    expect(summarize([], TOM, false)).toMatchObject({ studied: 0, avgRecallMs: 0, tomorrow: [] });
  });
});
