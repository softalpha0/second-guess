// M4 + M6: keyboard study loop with the hesitation check.
//   Front → Space (recall window ends) → back → → Right / ← Wrong.
//   On a Right answer the recall-window signals are scored against the
//   warm-up baseline: "Right — you knew it" or "Right — but you hesitated:
//   long pause, looked away". H overrides the verdict (counted).
import type { Screen } from '../main';
import type { Review } from '../../shared/types';
import type { RecallSignals } from '../../core/signals';
import { h, kbd } from '../ui';
import { camera, session } from '../app';
import { flashcard } from '../flashcard';
import { StudySession, type CardResult } from '../../core/study-session';
import { scoreHesitation, verdictText, type HesitationResult, type Verdict } from '../../core/hesitation';

interface Answered {
  result: CardResult;
  signal: Review['signal'];
  hesitation: HesitationResult;
  verdict: Verdict;
  overridden: boolean;
}

type Pending = Promise<{ signals: RecallSignals | null; signal: Review['signal'] }>;

const AUTO_NEXT_MS = 900;

export const studyScreen: Screen = async (root, go, params) => {
  if (!params.deckId) return go('decks');
  session.deckId = params.deckId;
  const deck = await window.sg.getDeck(params.deckId);
  if (!deck) {
    root.append(h('section.page', {}, h('p.notice.error', {}, 'That deck could not be found.'), h('button.btn', { onclick: () => go('decks') }, 'Back')));
    return { onKey: (e) => e.key === 'Escape' && go('decks') };
  }

  const view = flashcard();
  const verdictBox = h('div.verdict');
  verdictBox.hidden = true;
  const body = h('div', {}, view.el, verdictBox);
  root.append(h('section.page', {}, h('h1', {}, deck.name), body));

  const study = new StudySession(deck.cards, Date.now());
  const answered: Answered[] = [];
  let pending: Pending | null = null;
  let busy = false; // waiting for signals after an answer
  let feedback: Answered | null = null; // verdict on screen, waiting to continue
  let autoTimer: ReturnType<typeof setTimeout> | null = null;
  let done = false;
  let summaryShown = false;

  function show(): void {
    const c = study.current;
    if (!c) return;
    verdictBox.hidden = true;
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

  function renderVerdict(a: Answered): void {
    const shown: HesitationResult = { ...a.hesitation, verdict: a.verdict };
    if (a.overridden && a.verdict === 'sure') shown.reasons = [];
    const hesitated = a.verdict === 'hesitated';
    const text = a.overridden
      ? hesitated ? 'Right — but you say you guessed' : 'Right — you say you knew it'
      : verdictText(shown);
    verdictBox.className = `verdict ${hesitated ? 'hesitated' : a.verdict === 'sure' ? 'sure' : 'neutral'}`;
    verdictBox.replaceChildren(
      h('div.verdict-text', {}, text),
      h('div.verdict-sub', {},
        hesitated ? 'This card comes back sooner. ' : '',
        kbd('H'), hesitated ? ' No, I knew it    ' : ' Actually, I guessed    ',
        kbd('Space'), ' next',
      ),
    );
    verdictBox.hidden = false;
    view.hideHint();
  }

  async function answer(correct: boolean): Promise<void> {
    if (busy || feedback) return;
    const result = study.answer(correct, Date.now());
    if (!result) return;
    busy = true;
    const { signals, signal } = await (pending ?? Promise.resolve({ signals: null, signal: 'off' as const }));
    pending = null;
    busy = false;
    const hesitation = scoreHesitation({
      correct,
      recallMs: result.recallMs,
      signals: session.noCamera ? null : signals,
      baseline: session.baseline,
    });
    const a: Answered = { result, signal, hesitation, verdict: hesitation.verdict, overridden: false };

    if (!correct) return commit(a); // wrong: no check, move straight on
    feedback = a;
    renderVerdict(a);
    // a confident answer moves on by itself; a hesitation waits so it can be read
    if (a.verdict !== 'hesitated') autoTimer = setTimeout(() => void next(), AUTO_NEXT_MS);
  }

  function override(): void {
    if (!feedback) return;
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = null;
    const a = feedback;
    const original = a.hesitation.verdict;
    if (!a.overridden) {
      a.overridden = true;
      a.verdict = a.verdict === 'hesitated' ? 'sure' : 'hesitated';
    } else {
      a.overridden = false; // pressing H again undoes it
      a.verdict = original;
    }
    renderVerdict(a);
  }

  async function next(): Promise<void> {
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = null;
    const a = feedback;
    feedback = null;
    if (a) await commit(a);
  }

  async function commit(a: Answered): Promise<void> {
    answered.push(a);
    const last = study.current === null;
    if (last) done = true;
    else show();
    await window.sg.addReviews([
      {
        deckId: deck!.id,
        cardId: a.result.card.id,
        at: new Date(a.result.shownAt).toISOString(),
        recallMs: a.result.recallMs,
        correct: a.result.correct,
        signal: a.signal,
        verdict: a.verdict,
        score: a.hesitation.score,
        reasons: a.hesitation.reasons,
        overridden: a.overridden,
        parts: a.hesitation.parts as Record<string, number>,
      },
    ]);
    if (last) finish();
  }

  /** Esc mid-session: end now with what's been answered so far. */
  async function endEarly(): Promise<void> {
    if (feedback) await next();
    done = true;
    if (pending) await pending; // revealed but not answered: drop it
    finish();
  }

  function finish(): void {
    done = true;
    const total = answered.length;
    if (total === 0) return go('decks');
    const right = answered.filter((a) => a.result.correct);
    const guessed = right.filter((a) => a.verdict === 'hesitated');
    const avg = answered.reduce((s, a) => s + a.result.recallMs, 0) / total / 1000;
    const readings = answered.filter((a) => a.signal === 'good').length;
    body.replaceChildren(
      h('div.result', {},
        h('h2', {}, 'Session done'),
        h('ul', {},
          h('li', {}, `${right.length} of ${total} right.`),
          session.baseline?.signals ? h('li', {}, h('strong', {}, `${guessed.length} right but hesitated`), ' — these come back sooner.') : null,
          h('li', {}, `Average time to reveal: ${avg.toFixed(1)} s.`),
          session.noCamera ? null : h('li', {}, `${readings} of ${total} cards had a clear camera reading.`),
        ),
        guessed.length
          ? h('ul.guess-list', {}, ...guessed.map((a) => h('li', {}, h('strong', {}, a.result.card.front), ` — ${a.result.card.back}`,
              h('span.muted', {}, a.overridden ? '  (you said you guessed)' : a.hesitation.reasons.length ? `  (${a.hesitation.reasons.join(', ')})` : ''))))
          : null,
        h('p.small.muted', {}, 'The full summary and scheduling come in the next steps.'),
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
      if (feedback) {
        if (e.key.toLowerCase() === 'h') override();
        else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); void next(); }
        else if (e.key === 'Escape') void endEarly();
        return;
      }
      if (e.key === 'Escape') void endEarly();
      else if (e.key === ' ') {
        e.preventDefault();
        reveal();
      } else if (e.key === 'ArrowRight') void answer(true);
      else if (e.key === 'ArrowLeft') void answer(false);
    },
    dispose() {
      if (autoTimer) clearTimeout(autoTimer);
    },
  };
};
