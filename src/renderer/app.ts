// Shared app state: camera status (from the SDK in the background process),
// the warm-up baseline for this app session, and whether we're in
// "study without camera" mode.

import type { SdkEvent } from '../shared/types';
import type { Baseline } from '../core/baseline';

export interface CameraStatus {
  on: boolean;
  processing: string | null;
  validation: string | null;
  lastError: string | null;
}

type Listener = (s: CameraStatus) => void;

class CameraStore {
  state: CameraStatus = { on: false, processing: null, validation: null, lastError: null };
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
};

/** Top-of-window banner (e.g. "Camera off — plain flashcards"). */
export function setBanner(text: string | null): void {
  const el = document.getElementById('banner')!;
  el.textContent = text ?? '';
  el.hidden = !text;
}
