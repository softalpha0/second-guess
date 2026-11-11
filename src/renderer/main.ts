// Window entry: header (camera indicator + Stop camera), simple screen router,
// and keyboard routing to the active screen.

import { camera, session, setBanner } from './app';
import type { SgApi } from '../shared/types';
import { decksScreen } from './screens/decks';
import { consentScreen } from './screens/consent';
import { cameraCheckScreen } from './screens/camera-check';
import { warmupScreen } from './screens/warmup';
import { studyScreen } from './screens/study';
import { sdkCheckScreen } from './screens/sdk-check';
import { summaryScreen } from './screens/summary';

declare global {
  interface Window {
    sg: SgApi;
  }
}

export interface ScreenHandle {
  onKey?(e: KeyboardEvent): void;
  dispose?(): void;
}
export type ScreenName = 'decks' | 'consent' | 'camera-check' | 'warmup' | 'study' | 'sdk-check' | 'summary';
export type Go = (name: ScreenName, params?: Record<string, string>) => void;
export type Screen = (root: HTMLElement, go: Go, params: Record<string, string>) => ScreenHandle | void | Promise<ScreenHandle | void>;

const screens: Record<ScreenName, Screen> = {
  decks: decksScreen,
  consent: consentScreen,
  'camera-check': cameraCheckScreen,
  warmup: warmupScreen,
  study: studyScreen,
  'sdk-check': sdkCheckScreen,
  summary: summaryScreen,
};

const view = document.getElementById('view')!;
let active: ScreenHandle | void;
let navToken = 0;

export const go: Go = (name, params = {}) => {
  active?.dispose?.();
  active = undefined;
  view.replaceChildren();
  view.scrollTop = 0;
  const token = ++navToken;
  Promise.resolve(screens[name](view, go, params)).then((handle) => {
    if (token === navToken) active = handle;
    else handle?.dispose?.(); // user navigated away while it was loading
  });
};

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) {
    if (e.key !== 'Escape') return;
  }
  active?.onKey?.(e);
});

// Header: camera indicator and Stop camera, visible on every screen.
const indicator = document.getElementById('cam-indicator')!;
const stopBtn = document.getElementById('btn-stop-camera') as HTMLButtonElement;
stopBtn.addEventListener('click', () => void window.sg.stop('user'));
document.getElementById('brand')!.addEventListener('click', () => go('decks'));

let wasOn = false;
camera.subscribe((s) => {
  indicator.textContent = s.on ? '● Camera on' : '● Camera off';
  indicator.className = `cam-indicator ${s.on ? 'on' : 'off'}`;
  stopBtn.hidden = !s.on;
  if (wasOn && !s.on && s.offReason !== 'internal') {
    session.baseline = null;
    const why =
      s.offReason === 'user'
        ? 'You stopped the camera.'
        : `The camera stopped by itself (${(s.offReason ?? 'unknown reason').replace(/^error: /, '')}).`;
    setBanner(`${why} You can keep studying as plain flashcards — answers won’t be checked for hesitation.`, {
      label: 'Turn camera back on',
      run: () => go('camera-check', session.deckId ? { deckId: session.deckId } : {}),
    });
  }
  if (s.on) setBanner(null);
  wasOn = s.on;
});

// Handy for automated UI checks; harmless otherwise.
(window as unknown as { __sgGo: Go }).__sgGo = go;

void camera.init().then(() => go('decks'));
