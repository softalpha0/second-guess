// M5: 60-second warm-up with 8 very easy cards. Learns your normal recall
// time, blink rate, head position, breathing and resting face.
import type { Screen } from '../main';
import { h, kbd } from '../ui';
import { camera, session } from '../app';
import { flashcard } from '../flashcard';
import { StudySession } from '../../core/study-session';
import { computeBaseline, describeBaseline } from '../../core/baseline';
import type { Card } from '../../core/deck-import';

const WARMUP_CARDS: Card[] = [
  ['2 + 2', '4'],
  ['Opposite of hot', 'cold'],
  ['Number of days in a week', '7'],
  ['First letter of the alphabet', 'A'],
  ['10 − 5', '5'],
  ['Colour of the sky on a clear day', 'blue'],
  ['Opposite of up', 'down'],
  ['3 × 3', '9'],
].map(([front, back], i) => ({ id: `warmup-${i}`, front, back }));

export const warmupScreen: Screen = (root, go, params) => {
  const view = flashcard();
  const body = h('div');
  root.append(
    h('section.page', {},
      h('h1', {}, 'Warm-up'),
      h('p.muted', {}, 'Eight very easy cards so Second Guess learns your normal pace. Answer naturally.'),
      body,
    ),
  );

  let study: StudySession;
  let startedAt = 0;
  let finished = false;

  function begin(): void {
    finished = false;
    startedAt = Date.now();
    study = new StudySession(WARMUP_CARDS, startedAt, { size: 8 });
    body.replaceChildren(view.el);
    show();
  }

  function show(): void {
    const c = study.current!;
    view.setProgress(`Warm-up card ${study.position.index} of ${study.position.total}`);
    if (study.phase === 'front') view.showFront(c.front);
    else view.showBack(c.front, c.back);
  }

  async function finish(): Promise<void> {
    finished = true;
    const endedAt = Date.now();
    const whole = camera.state.on ? await window.sg.recallWindow(startedAt, endedAt) : null;
    const baseline = computeBaseline(study.results.map((r) => ({ recallMs: r.recallMs, correct: r.correct })), whole);
    session.baseline = baseline;
    const lines = describeBaseline(baseline);
    body.replaceChildren(
      h('div.result', {},
        h('h2', {}, baseline.signals ? 'Got it — your normal is set.' : 'Warm-up done.'),
        h('ul', {}, ...lines.map((l) => h('li', {}, l))),
        whole && !baseline.signals
          ? h('p.notice.error', {}, 'Try the warm-up again with your face and shoulders in view, so hesitation can be checked.')
          : null,
        h('div.row', {},
          h('button.btn.primary', { onclick: () => go(params.deckId ? 'study' : 'decks', params) }, 'Start studying'),
          h('button.btn', { onclick: begin }, 'Redo warm-up'),
        ),
        h('p.keys', {}, kbd('Enter'), ' start studying   ', kbd('R'), ' redo warm-up'),
      ),
    );
  }

  begin();

  return {
    onKey(e) {
      if (e.repeat) return;
      if (finished) {
        if (e.key === 'Enter') go(params.deckId ? 'study' : 'decks', params);
        else if (e.key.toLowerCase() === 'r') begin();
        else if (e.key === 'Escape') go('decks');
        return;
      }
      if (e.key === 'Escape') return go('decks');
      if (e.key === ' ' && study.phase === 'front') {
        e.preventDefault();
        study.reveal(Date.now());
        show();
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && study.phase === 'back') {
        study.answer(e.key === 'ArrowRight', Date.now());
        if (study.current === null) void finish();
        else show();
      }
    },
  };
};
