import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/main/store';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'sg-'));
}

describe('store', () => {
  it('lists the built-in decks with 30 cards each', () => {
    const s = new Store(tmp(), join(__dirname, '..', 'decks'));
    const decks = s.listDecks();
    expect(decks.map((d) => d.name)).toEqual(['World capitals', 'Spanish basics', 'Web dev basics']);
    expect(decks.every((d) => d.count === 30)).toBe(true);
  });

  it('imports, lists and deletes a deck', () => {
    const dir = tmp();
    const file = join(dir, 'My verbs.csv');
    writeFileSync(file, 'front,back\nser,to be\nestar,to be (state)\nbroken-line\n');
    const s = new Store(join(dir, 'data'), join(dir, 'none'));
    const r = s.importDeck(file);
    expect(r.ok).toBe(true);
    expect(r.deck).toMatchObject({ name: 'My verbs', count: 2 });
    expect(r.skipped).toHaveLength(1);
    expect(s.getDeck(r.deck!.id)!.cards[0].front).toBe('ser');
    expect(s.deleteDeck(r.deck!.id)).toBe(true);
    expect(s.listDecks()).toHaveLength(0);
  });

  it('refuses a file with no usable cards', () => {
    const dir = tmp();
    writeFileSync(join(dir, 'x.csv'), 'just one column\n');
    const r = new Store(join(dir, 'data'), dir).importDeck(join(dir, 'x.csv'));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/No cards/);
  });

  it('saves settings and reviews, and survives a damaged file', () => {
    const dir = tmp();
    const s = new Store(dir, dir);
    expect(s.getSettings().consentAt).toBeNull();
    s.updateSettings({ consentAt: '2026-11-11T10:00:00Z' });
    s.addReviews([{ deckId: 'd', cardId: 'c', at: 'now', recallMs: 1200, correct: true, signal: 'good' }]);
    expect(new Store(dir, dir).getSettings().consentAt).toBe('2026-11-11T10:00:00Z');
    expect(s.getReviews()).toHaveLength(1);
    writeFileSync(join(dir, 'reviews.json'), '{not json');
    expect(s.getReviews()).toEqual([]);
  });

  it('saves the schedule and shows due / new counts per deck', () => {
    const dir = tmp();
    const s = new Store(dir, join(__dirname, '..', 'decks'));
    const deck = s.getDeck('builtin:capitals')!;
    const st = (cardId: string, due: string) => ({
      deckId: deck.id, cardId, intervalDays: 1, due, reps: 1, lapses: 0, hesitations: 0, last: 'sure' as const, lastReviewed: '2026-11-15',
    });
    s.saveCardStates([st(deck.cards[0].id, '2026-11-16'), st(deck.cards[1].id, '2026-11-20')]);
    const caps = s.listDecks('2026-11-16').find((d) => d.id === deck.id)!;
    expect(caps).toMatchObject({ due: 1, fresh: 28 });
    expect(Object.keys(s.getSchedule(deck.id))).toHaveLength(2);
    expect(Object.keys(s.getSchedule('builtin:spanish'))).toHaveLength(0);
  });

  it('delete all removes settings, imported decks and reviews', () => {
    const dir = tmp();
    const s = new Store(dir, dir);
    s.updateSettings({ consentAt: 'x' });
    s.deleteAll();
    expect(s.getSettings().consentAt).toBeNull();
    expect(() => readFileSync(join(dir, 'settings.json'))).toThrow();
  });
});
