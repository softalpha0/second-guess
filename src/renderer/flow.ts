// Where "Study this deck" leads:
//   no consent yet        → consent → camera check → warm-up → study
//   camera on + baseline  → study straight away
//   otherwise             → camera check → warm-up → study
//   "study without camera" → study (plain flashcards)
import { camera, session } from './app';
import type { Go } from './main';

export async function beginStudy(go: Go, deckId: string): Promise<void> {
  if (session.noCamera) return go('study', { deckId });
  const settings = await window.sg.getSettings();
  if (!settings.consentAt) return go('consent', { deckId });
  if (camera.state.on && session.baseline) return go('study', { deckId });
  return go('camera-check', { deckId });
}
