// M2: consent, shown before the camera is ever turned on.
import type { Screen } from '../main';
import { h, kbd } from '../ui';
import { session } from '../app';

export const consentScreen: Screen = (root, go, params) => {
  const tick = h('input', { type: 'checkbox', id: 'agree' }) as HTMLInputElement;
  const cont = h('button.btn.primary', { disabled: true }, 'Continue') as HTMLButtonElement;
  tick.addEventListener('change', () => (cont.disabled = !tick.checked));

  async function agree(): Promise<void> {
    if (!tick.checked) return;
    await window.sg.updateSettings({ consentAt: new Date().toISOString() });
    go('camera-check', params);
  }
  function withoutCamera(): void {
    session.noCamera = true;
    go('study', params);
  }
  cont.addEventListener('click', () => void agree());

  root.append(
    h('section.page.narrow', {},
      h('h1', {}, 'Before the camera turns on'),
      h('p', {}, 'Second Guess uses your webcam to notice ', h('strong', {}, 'hesitation'), ' while you recall an answer. Please read what that means.'),
      h('h2', {}, 'What it looks at'),
      h('ul', {},
        h('li', {}, 'How long you take before you reveal the answer.'),
        h('li', {}, 'Blinking, where your head and eyes point, breathing movement, and changes in facial expression.'),
        h('li', {}, 'Each is compared only with ', h('em', {}, 'your own'), ' 60-second warm-up — never with other people.'),
      ),
      h('h2', {}, 'What is kept'),
      h('ul', {},
        h('li', {}, 'For each card: whether you hesitated, the reason (e.g. “long pause”) and your recall time.'),
        h('li', {}, 'Stored only in files on this computer.'),
        h('li', {}, h('strong', {}, 'No video, frames or images are stored or sent by Second Guess.')),
      ),
      h('h2', {}, 'What leaves this computer'),
      h('ul', {},
        h('li', {}, 'The camera is processed on this computer by the SmartSpectra SDK from Presage.'),
        h('li', {}, 'The SDK connects to Presage’s servers to check the app’s API key and download its models. These requests are linked to the API key.'),
        h('li', {}, 'SDK telemetry is turned off. No video and no measured values are sent.'),
        h('li', {}, 'No AI services are used.'),
      ),
      h('h2', {}, 'Good to know'),
      h('ul', {},
        h('li', {}, 'A “Camera on” light and a ', h('strong', {}, 'Stop camera'), ' button stay at the top of the window.'),
        h('li', {}, 'Second Guess measures study hesitation only. It is not a medical device and says nothing about health or feelings.'),
      ),
      h('label.agree', { for: 'agree' }, tick, ' I understand and agree to turn on the camera.'),
      h('div.row', {},
        cont,
        h('button.btn', { onclick: withoutCamera }, 'Study without camera'),
        h('button.btn.ghost', { onclick: () => go('decks') }, 'Back'),
      ),
      h('p.keys', {}, kbd('Space'), ' tick   ', kbd('Enter'), ' continue   ', kbd('Esc'), ' back'),
    ),
  );

  return {
    onKey(e) {
      if (e.key === ' ' && document.activeElement !== tick) { tick.checked = !tick.checked; cont.disabled = !tick.checked; e.preventDefault(); }
      else if (e.key === 'Enter') void agree();
      else if (e.key === 'Escape') go('decks');
    },
  };
};
