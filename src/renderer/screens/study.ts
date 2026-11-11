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
import { readingAdjustedRecall, scoreHesitation, verdictText, weightsFor, type HesitationResult, type Verdict } from '../../core/hesitation';
import { replayTracks } from '../../core/replay';
import { agreement } from '../../core/check-mode';
import { addDays, cardKey, pickSession, schedule, toDay, type CardState, type Outcome } from '../../core/scheduler';
import { summarize, type Attempt } from '../../core/summary';
import { DEFAULT_SESSION_SIZE } from '../../core/study-session';

interface Answered {
  result: CardResult;
  retry: boolean;
  signal: Review['signal'];
  hesitation: HesitationResult;
  verdict: Verdict;
  overridden: boolean;
  signals: RecallSignals | null;
  /** S1 Check mode: the student's answer to "Was that a guess?". */
  selfGuess?: boolean;
}

type Pending = Promise<{ signals: RecallSignals | null; signal: Review['signal'] }>;

const AUTO_NEXT_MS = 900;
const MAX_RETRIES = 2; // a wrong card comes back at most twice in one session

export const studyScreen: Screen = async (root, go, params) => {
  if (!params.deckId) return go('decks');
  session.deckId = params.deckId;
  const deck = await window.sg.getDeck(params.deckId);
  if (!deck) {
    root.append(h('section.page', {}, h('p.notice.error', {}, 'That deck could not be found.'), h('button.btn', { onclick: () => go('decks') }, 'Back')));
    return { onKey: (e) => e.key === 'Escape' && go('decks') };
  }

  const today = toDay(new Date());
  const settings = await window.sg.getSettings();
  const weights = weightsFor(settings.signals);
  // Check mode only makes sense when the app can judge (camera + warm-up)
  const checkMode = settings.checkMode && !session.noCamera && !!session.baseline?.signals;
  session.lastReplays = [];
  const states: Record<string, CardState> = await window.sg.getSchedule(deck.id);
  const picked = pickSession(deck.cards, deck.id, states, today, DEFAULT_SESSION_SIZE);

  const view = flashcard();
  const verdictBox = h('div.verdict');
  verdictBox.hidden = true;
  const body = h('div', {}, view.el, verdictBox);
  root.append(
    h('section.page', {},
      h('h1', {}, deck.name),
      session.noCamera
        ? h('div.notice.nocam.small', {}, h('strong', {}, 'No camera mode — plain flashcards. '), session.noCameraReason ?? '')
        : null,
      picked.practice ? h('div.notice.small', {}, 'All caught up! Practising the cards that are due soonest.') : null,
      checkMode ? h('div.notice.small', {}, h('strong', {}, 'Check mode: '), 'after each right answer, tell us honestly whether it was a guess. Second Guess keeps its own verdict hidden until the summary.') : null,
      body,
    ),
  );

  const study = new StudySession(picked.cards, Date.now());
  const failedThisSession = new Set<string>();
  const retriesLeft = new Map<string, number>();
  const attempts: Attempt[] = [];
  /** Reading-adjusted recall times of right first answers so far: the deck pace. */
  const sessionRecalls: number[] = [];
  const answered: Answered[] = [];
  let pending: Pending | null = null;
  let busy = false; // waiting for signals after an answer
  let feedback: Answered | null = null; // verdict on screen, waiting to continue
  let autoTimer: ReturnType<typeof setTimeout> | null = null;
  let done = false;

  function show(): void {
    const c = study.current;
    if (!c) return;
    verdictBox.hidden = true;
    view.setProgress(`Card ${study.position.index} of ${study.position.total}${failedThisSession.has(c.id) ? ' · again' : ''}`);
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
        hesitated ? (a.retry ? 'This card comes back tomorrow. ' : 'This card comes back tomorrow instead of later. ') : '',
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
      weights,
      threshold: settings.threshold,
      frontLength: result.card.front.length,
      sessionRecalls,
    });
    if (correct && !failedThisSession.has(result.card.id) && session.baseline) {
      sessionRecalls.push(readingAdjustedRecall(result.recallMs, result.card.front.length, session.baseline));
    }
    const a: Answered = { result, retry: failedThisSession.has(result.card.id), signal, hesitation, verdict: hesitation.verdict, overridden: false, signals };

    if (!correct) return commit(a); // wrong: no check, move straight on
    feedback = a;
    if (checkMode && (a.verdict === 'sure' || a.verdict === 'hesitated')) {
      renderAsk();
      return;
    }
    renderVerdict(a);
    // a confident answer moves on by itself; a hesitation waits so it can be read
    if (a.verdict !== 'hesitated') autoTimer = setTimeout(() => void next(), AUTO_NEXT_MS);
  }

  function renderAsk(): void {
    verdictBox.className = 'verdict ask';
    verdictBox.replaceChildren(
      h('div.verdict-text', {}, 'Right! Was that a guess?'),
      h('div.verdict-sub', {}, kbd('Y'), ' Yes, I guessed    ', kbd('N'), ' No, I knew it'),
    );
    verdictBox.hidden = false;
    view.hideHint();
  }

  function answerCheck(guess: boolean): void {
    if (!feedback) return;
    feedback.selfGuess = guess;
    void next();
  }

  function override(): void {
    if (!feedback || feedback.selfGuess !== undefined || checkMode) return;
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
    const id = a.result.card.id;
    const outcome: Outcome = !a.result.correct
      ? 'wrong'
      : a.selfGuess !== undefined
        ? a.selfGuess ? 'hesitated' : 'sure' // Check mode: the student's answer decides
        : a.verdict === 'hesitated' ? 'hesitated' : a.verdict === 'sure' ? 'sure' : 'unjudged';
    const key = cardKey(deck!.id, id);
    const next = schedule({ prev: states[key] ?? null, deckId: deck!.id, cardId: id, outcome, today, failedThisSession: failedThisSession.has(id) });
    states[key] = next;
    const self = a.selfGuess;
    attempts.push({
      cardId: id, front: a.result.card.front, back: a.result.card.back, correct: a.result.correct,
      verdict: self !== undefined ? (self ? 'hesitated' : 'sure') : a.verdict,
      reasons: self !== undefined ? [] : a.hesitation.reasons,
      overridden: self !== undefined ? false : a.overridden,
      retry: a.retry, recallMs: a.result.recallMs, due: next.due,
    });
    // S2: keep this card's tracks for the summary replay (memory only)
    if (a.result.correct && a.signals && session.baseline && (a.verdict === 'sure' || a.verdict === 'hesitated')) {
      const tracks = replayTracks(a.signals, session.baseline, a.result.recallMs);
      if (tracks) session.lastReplays.push({ front: a.result.card.front, back: a.result.card.back, verdict: a.verdict, score: a.hesitation.score, reasons: a.hesitation.reasons, selfGuess: self, tracks });
    }
    if (!a.result.correct) {
      failedThisSession.add(id);
      const left = retriesLeft.get(id) ?? MAX_RETRIES;
      if (left > 0) {
        retriesLeft.set(id, left - 1);
        study.requeue(a.result.card, 3); // again in this session
      }
    }
    void window.sg.saveCardStates([next]);
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
        selfGuess: a.selfGuess,
        checkMode: checkMode || undefined,
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
    if (attempts.length === 0) return go('decks');
    const checked = !session.noCamera && !!session.baseline?.signals;
    session.lastSummary = { ...summarize(attempts, addDays(today, 1), checked), deckId: deck!.id, deckName: deck!.name, practice: picked.practice };
    const checkedOnes = answered.filter((a) => a.selfGuess !== undefined && (a.verdict === 'sure' || a.verdict === 'hesitated'));
    session.lastAgreement = checkMode ? agreement(checkedOnes.map((a) => ({ appHesitated: a.verdict === 'hesitated', selfGuess: !!a.selfGuess }))) : null;
    go('summary', { deckId: deck!.id });
  }

  show();

  return {
    onKey(e) {
      if (e.repeat) return;
      if (done) return;
      if (feedback && feedback.selfGuess === undefined && verdictBox.classList.contains('ask')) {
        if (e.key.toLowerCase() === 'y') answerCheck(true);
        else if (e.key.toLowerCase() === 'n') answerCheck(false);
        else if (e.key === 'Escape') void endEarly();
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
