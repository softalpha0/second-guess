// M4: keyboard study loop. Front → Space → back → → Right / ← Wrong.
// The recall window (front shown → Space) is measured and, when the camera
// is on, its signals are fetched for the hesitation check (M6).
import type { Screen } from '../main';
import type { Review } from '../../shared/types';
import type { RecallSignals } from '../../core/signals';
import { h, kbd } from '../ui';
import { camera, session } from '../app';
import { flashcard } from '../flashcard';
import { StudySession, type CardResult } from '../../core/study-session';

interface Answered {
  result: CardResult;
  signals: RecallSignals | null;
  signal: Review['signal'];
}

export const studyScreen: Screen = async (root, go, params) => {
  if (!params.deckId) return go('decks');
  session.deckId = params.deckId;
  const deck = await window.sg.getDeck(params.deckId);
  if (!deck) {
    root.append(h('section.page', {}, h('p.notice.error', {}, 'That deck could not be found.'), h('button.btn', { onclick: () => go('decks') }, 'Back')));
    return { onKey: (e) => e.key === 'Escape' && go('decks') };
  }

  const view = flashcard();
  const body = h('div', {}, view.el);
  root.append(h('section.page', {}, h('h1', {}, deck.name), body));

  const study = new StudySession(deck.cards, Date.now());
  const answered: Answered[] = [];
  let pending: Promise<{ signals: RecallSignals | null; signal: Review['signal'] }> | null = null;
  let done = false;
  let summaryShown = false;

  function show(): void {
    const c = study.current;
    if (!c) return;
    view.setProgress(`Card ${study.position.index} of ${study.position.total}`);
    if (study.phase === 'front') view.showFront(c.front);
    else view.showBack(c.front, c.back);
  }

  function reveal(): void {
    if (study.reveal(Date.now()) === null) return;
    show();
    const from = study.shownAt;
    const to = study.revealedAt;
    if (camera.state.on && !session.noCamera) {
      view.setChip('checking…');
      pending = window.sg.recallWindow(from, to).then((signals) => {
        const signal: Review['signal'] = signals.quality.good ? 'good' : 'poor';
        view.setChip(signal === 'good' ? 'camera reading ✓' : 'no reading (camera view unclear)', signal === 'good' ? 'good' : 'warn');
        return { signals, signal };
      });
    } else {
      pending = Promise.resolve({ signals: null, signal: 'off' as const });
      view.setChip(session.noCamera ? null : 'camera off', 'muted');
    }
  }

  async function answer(correct: boolean): Promise<void> {
    const result = study.answer(correct, Date.now());
    if (!result) return;
    const p = pending ?? Promise.resolve({ signals: null, signal: 'off' as const });
    pending = null;
    const last = study.current === null;
    if (last) done = true; // block keys while the summary loads
    else show();
    const { signals, signal } = await p;
    answered.push({ result, signals, signal });
    await window.sg.addReviews([
      { deckId: deck!.id, cardId: result.card.id, at: new Date(result.shownAt).toISOString(), recallMs: result.recallMs, correct, signal },
    ]);
    if (last) finish();
  }

  /** Esc mid-session: end now with what's been answered so far. */
  async function endEarly(): Promise<void> {
    done = true;
    if (pending) await pending; // revealed but not answered: drop it
    finish();
  }

  function finish(): void {
    done = true;
    const total = answered.length;
    if (total === 0) return go('decks');
    const right = answered.filter((a) => a.result.correct).length;
    const avg = answered.reduce((s, a) => s + a.result.recallMs, 0) / total / 1000;
    const readings = answered.filter((a) => a.signal === 'good').length;
    body.replaceChildren(
      h('div.result', {},
        h('h2', {}, 'Session done'),
        h('ul', {},
          h('li', {}, `${right} of ${total} right.`),
          h('li', {}, `Average time to reveal: ${avg.toFixed(1)} s.`),
          session.noCamera ? null : h('li', {}, `${readings} of ${total} cards had a clear camera reading.`),
        ),
        h('p.small.muted', {}, 'The full summary (which right answers were guesses) comes in a later step.'),
        h('div.row', {},
          h('button.btn.primary', { onclick: () => go('decks') }, 'Back to decks'),
          h('button.btn', { onclick: () => go('study', params) }, 'Study again'),
        ),
        h('p.keys', {}, kbd('Enter'), ' back to decks   ', kbd('A'), ' study again'),
      ),
    );
    summaryShown = true;
  }

  show();

  return {
    onKey(e) {
      if (e.repeat) return;
      if (done) {
        if (!summaryShown) return;
        if (e.key === 'Enter' || e.key === 'Escape') go('decks');
        else if (e.key.toLowerCase() === 'a') go('study', params);
        return;
      }
      if (e.key === 'Escape') void endEarly();
      else if (e.key === ' ') {
        e.preventDefault();
        reveal();
      } else if (e.key === 'ArrowRight') void answer(true);
      else if (e.key === 'ArrowLeft') void answer(false);
    },
  };
};
