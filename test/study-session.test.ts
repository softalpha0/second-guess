import { describe, expect, it } from 'vitest';
import { shuffle, StudySession } from '../src/core/study-session';

const cards = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, front: `F${i}`, back: `B${i}` }));

describe('study session', () => {
  it('goes front → reveal → answer and records recall time', () => {
    const s = new StudySession(cards, 1000, { shuffle: false, size: 2 });
    expect(s.phase).toBe('front');
    expect(s.answer(true, 1100)).toBeNull(); // can't answer before reveal
    expect(s.reveal(3500)).toBe(2500);
    expect(s.reveal(3600)).toBeNull(); // second Space does nothing
    const r = s.answer(true, 4000)!;
    expect(r).toMatchObject({ recallMs: 2500, correct: true, card: { id: 'c0' } });
    expect(s.phase).toBe('front');
    expect(s.shownAt).toBe(4000); // next card's clock starts when it is shown
    s.reveal(5000);
    s.answer(false, 5200);
    expect(s.phase).toBe('done');
    expect(s.results.map((x) => x.correct)).toEqual([true, false]);
  });

  it('takes 20 cards by default, shuffled', () => {
    const s = new StudySession(cards, 0, { rand: () => 0 });
    expect(s.queue).toHaveLength(20);
    expect(s.queue[0].id).not.toBe('c0');
  });

  it('handles an empty deck', () => {
    expect(new StudySession([], 0).phase).toBe('done');
  });

  it('shuffle keeps every item exactly once', () => {
    expect(shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
