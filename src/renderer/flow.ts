// Where "Study this deck" leads:
//   no key / SDK can't load → plain flashcards straight away (M9), with a notice
//   no consent yet           → consent → camera check → warm-up → study
//   camera on + baseline     → study straight away
//   otherwise                → camera check → warm-up → study
//   "study without camera"   → study (plain flashcards)
import { camera, session } from './app';
import type { Go } from './main';

export async function beginStudy(go: Go, deckId: string): Promise<void> {
  if (!session.noCamera) {
    const info = await window.sg.info();
    if (info.loadError || !info.hasKey) {
      session.noCamera = true;
      session.noCameraReason = info.loadError
        ? 'The camera part (SmartSpectra SDK) could not load on this computer.'
        : 'No Presage API key was found, so the camera can\u2019t be used.';
    }
  }
  if (session.noCamera) return go('study', { deckId });
  const settings = await window.sg.getSettings();
  if (!settings.consentAt) return go('consent', { deckId });
  if (camera.state.on && session.baseline) return go('study', { deckId });
  return go('camera-check', { deckId });
}
