// Messages shared between the background (main) process and the window.
import type { LiveSnapshot } from '../core/live-metrics';
import type { Card } from '../core/deck-import';
import type { RecallSignals } from '../core/signals';

export type SdkEvent =
  | { type: 'processing'; status: number; name: string }
  | { type: 'validation'; code: number; name: string; hint: string }
  | { type: 'live'; snapshot: LiveSnapshot; messagesPerSec: number }
  | { type: 'error'; code: number; name: string; message: string; retryable: boolean }
  | { type: 'metrics-set'; label: string; metrics: string[] }
  | { type: 'camera'; on: boolean }
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
  stop(): Promise<void>;
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
}
