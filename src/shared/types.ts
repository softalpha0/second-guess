// Messages shared between the background (main) process and the window.
import type { LiveSnapshot } from '../core/live-metrics';
import type { Card } from '../core/deck-import';
import type { RecallSignals } from '../core/signals';
import type { CardState } from '../core/scheduler';
import type { SignalKey } from '../core/hesitation';

export type SdkEvent =
  | { type: 'processing'; status: number; name: string }
  | { type: 'validation'; code: number; name: string; hint: string }
  | { type: 'live'; snapshot: LiveSnapshot; messagesPerSec: number }
  | { type: 'error'; code: number; name: string; message: string; retryable: boolean }
  | { type: 'metrics-set'; label: string; metrics: string[] }
  /** reason (when off): 'user' (Stop camera pressed), 'error: …', 'internal' (app restarted it). */
  | { type: 'camera'; on: boolean; reason?: string }
  | { type: 'log'; text: string };

export interface CameraEntry {
  id: string;
  name: string | null;
}

export interface SdkInfo {
  hasKey: boolean;
  sdkVersion: string | null;
  /** Set when the SDK's native runtime could not load on this PC. */
  loadError: string | null;
  cameras: CameraEntry[];
  cameraError: string | null;
  reportDir: string;
}

export interface Settings {
  /** When the student agreed to the consent screen (ISO date), or null. */
  consentAt: string | null;
  /** Chosen camera id, or null for the default camera. */
  cameraId: string | null;
  /** S4: hesitation threshold 0–100 (default 50). */
  threshold: number;
  /** S4: which signals are used. */
  signals: Record<SignalKey, boolean>;
  /** S1: ask "Was that a guess?" instead of showing the verdict. */
  checkMode: boolean;
  /** Could: colour theme. */
  theme: 'system' | 'dark' | 'light';
}

export interface Deck {
  id: string;
  name: string;
  source: 'builtin' | 'imported';
  cards: Card[];
}

export interface DeckSummary {
  id: string;
  name: string;
  source: 'builtin' | 'imported';
  count: number;
  /** Cards due today or earlier, and never-studied cards (M7). */
  due?: number;
  fresh?: number;
}

export interface ImportOutcome {
  ok: boolean;
  cancelled?: boolean;
  deck?: DeckSummary;
  skipped?: { line: number; reason: string }[];
  error?: string;
}

/** One answered card. Only these numbers/labels are stored — never images. */
export interface Review {
  deckId: string;
  cardId: string;
  at: string;
  recallMs: number;
  correct: boolean;
  /** Was there a usable camera reading for the recall window? */
  signal: 'good' | 'poor' | 'off';
  /** M6: final verdict after any override. */
  verdict?: 'sure' | 'hesitated' | 'no-reading' | 'not-checked';
  /** Hesitation score 0–100 (null when not judged). */
  score?: number | null;
  /** Plain reasons, e.g. ["long pause", "looked away"]. */
  reasons?: string[];
  /** The student pressed H to change the verdict. */
  overridden?: boolean;
  /** Points per signal, for tuning (numbers only). */
  parts?: Record<string, number>;
  /** S1 Check mode: the student's own answer to "Was that a guess?". */
  selfGuess?: boolean;
  checkMode?: boolean;
}

export interface CameraState {
  on: boolean;
  processing: string | null;
  validation: string | null;
}

/** What the window can call (exposed by the preload script as window.sg). */
export interface SgApi {
  info(): Promise<SdkInfo>;
  start(cameraId: string | null): Promise<{ ok: boolean; error?: string }>;
  /** reason: 'user' when the student pressed Stop camera. */
  stop(reason?: 'user' | 'internal'): Promise<void>;
  cameraState(): Promise<CameraState>;
  recallWindow(fromMs: number, toMs: number): Promise<RecallSignals>;
  saveReport(): Promise<string | null>;
  openReportFolder(): Promise<void>;
  onEvent(cb: (e: SdkEvent) => void): () => void;

  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  listDecks(): Promise<DeckSummary[]>;
  getDeck(id: string): Promise<Deck | null>;
  importDeck(): Promise<ImportOutcome>;
  deleteDeck(id: string): Promise<boolean>;
  addReviews(reviews: Review[]): Promise<void>;
  /** M7: saved schedule for a deck, keyed "deckId|cardId". */
  getSchedule(deckId: string): Promise<Record<string, CardState>>;
  saveCardStates(states: CardState[]): Promise<void>;
  getReviews(): Promise<Review[]>;
  /** S4: delete settings, imported decks, history, schedule and logs. */
  deleteAllData(): Promise<void>;
  /** Could: save all answers as a CSV file (asks where). Returns the path, or null if cancelled. */
  exportCsv(): Promise<string | null>;
  /** Presage API key (Settings). The key itself is never sent to the window. */
  keyStatus(): Promise<{ source: 'settings' | 'env' | null; hint: string | null; canSave: boolean }>;
  saveKey(key: string): Promise<{ ok: boolean; error?: string }>;
  removeKey(): Promise<void>;
  /** Opens Presage's site in the browser, where the key is created. */
  openKeyPage(): Promise<void>;
}
