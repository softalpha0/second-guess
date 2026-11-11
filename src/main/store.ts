// Local storage: small JSON files in the app's user-data folder.
//   settings.json  – consent date, chosen camera
//   decks.json     – imported decks (built-in decks are read from /decks)
//   reviews.json   – one entry per answered card (no images, no signal series)
// No Electron imports, so it can be tested with a temp folder.

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { hashText, importCsv, importDeckFile, type Card } from '../core/deck-import';
import type { DeckSummary, Deck, Review, Settings, ImportOutcome } from '../shared/types';
import { cardKey, deckProgress, toDay, type CardState } from '../core/scheduler';

const BUILTIN_NAMES: Record<string, string> = {
  capitals: 'World capitals',
  spanish: 'Spanish basics',
  webdev: 'Web dev basics',
};

export class Store {
  constructor(
    private dataDir: string,
    private builtinDir: string,
  ) {
    mkdirSync(dataDir, { recursive: true });
  }

  private read<T>(file: string, fallback: T): T {
    const p = join(this.dataDir, file);
    if (!existsSync(p)) return fallback;
    try {
      return JSON.parse(readFileSync(p, 'utf8')) as T;
    } catch {
      // A damaged file shouldn't stop the app; keep a copy and start fresh.
      renameSync(p, `${p}.damaged-${Date.now()}`);
      return fallback;
    }
  }

  /** Write to a temp file then rename, so a crash never leaves half a file. */
  private write(file: string, data: unknown): void {
    const p = join(this.dataDir, file);
    writeFileSync(`${p}.tmp`, JSON.stringify(data, null, 2), 'utf8');
    renameSync(`${p}.tmp`, p);
  }

  getSettings(): Settings {
    return { consentAt: null, cameraId: null, ...this.read<Partial<Settings>>('settings.json', {}) };
  }

  updateSettings(patch: Partial<Settings>): Settings {
    const next = { ...this.getSettings(), ...patch };
    this.write('settings.json', next);
    return next;
  }

  private builtinDecks(): Deck[] {
    if (!existsSync(this.builtinDir)) return [];
    return readdirSync(this.builtinDir)
      .filter((f) => f.endsWith('.csv'))
      .sort()
      .map((f) => {
        const key = basename(f, '.csv');
        const { cards } = importCsv(readFileSync(join(this.builtinDir, f), 'utf8'));
        return { id: `builtin:${key}`, name: BUILTIN_NAMES[key] ?? key, source: 'builtin' as const, cards };
      });
  }

  private importedDecks(): Deck[] {
    return this.read<Deck[]>('decks.json', []);
  }

  listDecks(today = toDay(new Date())): DeckSummary[] {
    const states = this.allStates();
    return [...this.builtinDecks(), ...this.importedDecks()].map((d) => {
      const p = deckProgress(d.cards.map((c) => c.id), d.id, states, today);
      return { id: d.id, name: d.name, source: d.source, count: d.cards.length, due: p.due, fresh: p.fresh };
    });
  }

  private allStates(): Record<string, CardState> {
    return this.read<Record<string, CardState>>('schedule.json', {});
  }

  getSchedule(deckId: string): Record<string, CardState> {
    return Object.fromEntries(Object.entries(this.allStates()).filter(([, s]) => s.deckId === deckId));
  }

  saveCardStates(states: CardState[]): void {
    const all = this.allStates();
    for (const s of states) all[cardKey(s.deckId, s.cardId)] = s;
    this.write('schedule.json', all);
  }

  getDeck(id: string): Deck | null {
    return [...this.builtinDecks(), ...this.importedDecks()].find((d) => d.id === id) ?? null;
  }

  importDeck(filePath: string): ImportOutcome {
    let text: string;
    try {
      text = readFileSync(filePath, 'utf8');
    } catch (err) {
      return { ok: false, error: `Could not read the file: ${String(err)}` };
    }
    const name = basename(filePath).replace(/\.(csv|txt|tsv)$/i, '');
    const { cards, skipped } = importDeckFile(filePath, text);
    if (cards.length === 0) {
      return { ok: false, error: 'No cards found. Each line needs a front and a back (CSV: front,back — Anki: tab-separated).', skipped };
    }
    const decks = this.importedDecks();
    const id = `imported:${hashText(name + Date.now())}`;
    const deck: Deck = { id, name, source: 'imported', cards: cards as Card[] };
    decks.push(deck);
    this.write('decks.json', decks);
    return { ok: true, deck: { id, name, source: 'imported', count: cards.length }, skipped };
  }

  deleteDeck(id: string): boolean {
    const decks = this.importedDecks();
    const next = decks.filter((d) => d.id !== id);
    if (next.length === decks.length) return false;
    this.write('decks.json', next);
    // forget its schedule too
    const states = this.allStates();
    for (const k of Object.keys(states)) if (states[k].deckId === id) delete states[k];
    this.write('schedule.json', states);
    return true;
  }

  addReviews(reviews: Review[]): void {
    const all = this.read<Review[]>('reviews.json', []);
    all.push(...reviews);
    this.write('reviews.json', all);
  }

  getReviews(): Review[] {
    return this.read<Review[]>('reviews.json', []);
  }

  /** Settings → Delete all data (used from S4; available now for testing). */
  deleteAll(): void {
    for (const f of ['settings.json', 'decks.json', 'reviews.json', 'schedule.json']) rmSync(join(this.dataDir, f), { force: true });
  }
}
