// The card on screen, shared by the warm-up and the study loop.
import { h, kbd, multiline } from './ui';

export interface FlashcardView {
  el: HTMLElement;
  showFront(front: string): void;
  showBack(front: string, back: string): void;
  setChip(text: string | null, kind?: 'good' | 'warn' | 'muted'): void;
  setProgress(text: string): void;
  hideHint(): void;
}

export function flashcard(): FlashcardView {
  const progress = h('div.card-progress');
  const chip = h('span.chip');
  chip.hidden = true;
  const front = h('div.card-front');
  const divider = h('hr.card-divider');
  const back = h('div.card-back');
  const hint = h('div.card-hint');
  const card = h('div.flashcard', {}, front, divider, back);
  const el = h('div.flashcard-wrap', {}, h('div.card-top', {}, progress, chip), card, hint);

  return {
    el,
    showFront(text) {
      front.replaceChildren(multiline(text));
      back.replaceChildren();
      divider.hidden = true;
      back.hidden = true;
      hint.replaceChildren('Think of the answer, then press ', kbd('Space'));
      chip.hidden = true;
    },
    showBack(f, b) {
      front.replaceChildren(multiline(f));
      back.replaceChildren(multiline(b));
      divider.hidden = false;
      back.hidden = false;
      hint.replaceChildren(kbd('→'), ' I was right    ', kbd('←'), ' I was wrong');
    },
    setChip(text, kind = 'muted') {
      chip.hidden = !text;
      chip.textContent = text ?? '';
      chip.className = `chip ${kind}`;
    },
    setProgress(text) {
      progress.textContent = text;
    },
    hideHint() {
      hint.replaceChildren();
    },
  };
}
