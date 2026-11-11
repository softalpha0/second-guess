// Shared app state: camera status (from the SDK in the background process),
// the warm-up baseline for this app session, and whether we're in
// "study without camera" mode.

import type { SdkEvent } from '../shared/types';
import type { Baseline } from '../core/baseline';
import type { SessionSummary } from '../core/summary';

export interface CameraStatus {
  on: boolean;
  processing: string | null;
  validation: string | null;
  lastError: string | null;
  /** Why the camera last went off: 'user', 'internal' or 'error: …'. */
  offReason: string | null;
}

type Listener = (s: CameraStatus) => void;

class CameraStore {
  state: CameraStatus = { on: false, processing: null, validation: null, lastError: null, offReason: null };
  private listeners = new Set<Listener>();

  async init(): Promise<void> {
    const s = await window.sg.cameraState();
    this.state = { ...this.state, ...s };
    window.sg.onEvent((e: SdkEvent) => this.onEvent(e));
    this.notify();
  }

  private onEvent(e: SdkEvent): void {
    if (e.type === 'camera') {
      this.state.on = e.on;
      this.state.offReason = e.on ? null : e.reason ?? null;
      if (!e.on) {
        this.state.validation = null;
        this.state.processing = null;
      }
    } else if (e.type === 'processing') this.state.processing = e.name;
    else if (e.type === 'validation') {
      if (this.state.validation === e.name) return; // ~25/s: only notify on change
      this.state.validation = e.name;
    } else if (e.type === 'error') this.state.lastError = `${e.name}: ${e.message}`;
    else return;
    this.notify();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn(this.state);
  }
}

export const camera = new CameraStore();

export const session = {
  /** Learned in the warm-up; kept only while the app is open (light and seating change). */
  baseline: null as Baseline | null,
  /** The student chose to study without the camera. */
  noCamera: false,
  /** Deck being studied, so "Turn camera back on" can come back to it. */
  deckId: null as string | null,
  /** Why we're in no-camera mode, in plain words (M9). */
  noCameraReason: null as string | null,
  /** Last finished session, for the summary screen (M8). */
  lastSummary: null as (SessionSummary & { deckId: string; deckName: string; practice: boolean }) | null,
};

/** Top-of-window banner (e.g. "Camera off — plain flashcards"), with an optional button. */
export function setBanner(text: string | null, action?: { label: string; run: () => void }): void {
  const el = document.getElementById('banner')!;
  el.replaceChildren();
  el.hidden = !text;
  if (!text) return;
  el.append(text);
  if (action) {
    const b = document.createElement('button');
    b.className = 'btn small';
    b.textContent = action.label;
    b.addEventListener('click', () => {
      setBanner(null);
      action.run();
    });
    el.append(' ', b);
  }
}
