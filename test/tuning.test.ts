import { describe, expect, it } from 'vitest';
import { tune, usableReviews } from '../src/core/tuning';

const r = (score: number, selfGuess: boolean, parts: Record<string, number> = {}) => ({
  correct: true, checkMode: true, selfGuess, score, verdict: score >= 50 ? 'hesitated' : 'sure', parts,
});

describe('tuning report', () => {
  const reviews = [
    r(70, true, { recall: 55, lookAway: 15 }),
    r(40, true, { recall: 30, lookAway: 10 }),
    r(45, false, { recall: 40, lookAway: 0 }),
    r(10, false, { recall: 10, lookAway: 0 }),
    r(5, false, { recall: 5, lookAway: 0 }),
    { correct: false, checkMode: true, selfGuess: false, score: null }, // wrong: ignored
    { correct: true, score: 80 }, // not check mode: ignored
  ];
  const t = tune(reviews);

  it('only uses judged right answers from Check mode', () => {
    expect(usableReviews(reviews)).toHaveLength(5);
    expect(t).toMatchObject({ usable: 5, guesses: 2, known: 3 });
  });

  it('reports agreement for the current settings and each threshold', () => {
    expect(t.current.percent).toBe(80); // 70 caught, 40 missed, rest agreed
    const at40 = t.thresholds.find((x) => x.threshold === 40)!;
    expect(at40).toMatchObject({ caught: 2, falseAlarms: 1, percent: 80 });
    const at30 = t.thresholds.find((x) => x.threshold === 30)!;
    expect(at30.percent).toBe(80);
  });

  it('prefers the threshold closest to 50 on a tie', () => {
    expect(t.best!.percent).toBe(80);
    expect(t.best!.threshold).toBe(50);
  });

  it('ranks signals by how well they separate guesses from known answers', () => {
    expect(t.signals.map((x) => x.signal)).toEqual(['recall', 'lookAway']);
    expect(t.signals[0]).toMatchObject({ avgOnGuesses: 42.5, avgOnKnown: 18.3, separation: 24.2 });
    expect(t.signals[1]).toMatchObject({ avgOnGuesses: 12.5, avgOnKnown: 0 });
  });

  it('handles no data', () => {
    expect(tune([]).best).toBeNull();
  });
});
