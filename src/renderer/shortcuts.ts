// Could: keyboard shortcut overlay — press ? on any screen.
import { h, kbd } from './ui';
import type { ScreenName } from './main';

type Row = [keys: string[], what: string];

const COMMON: Row[] = [[['?'], 'show / hide this list'], [['Esc'], 'back / close']];

const BY_SCREEN: Partial<Record<ScreenName, Row[]>> = {
  decks: [[['↑', '↓'], 'choose a deck'], [['Enter'], 'study it'], [['I'], 'import a deck'], [['Delete'], 'remove an imported deck'], [['P'], 'progress'], [['S'], 'settings']],
  consent: [[['Space'], 'tick the box'], [['Enter'], 'continue']],
  'camera-check': [[['Enter'], 'start the warm-up (when the camera is ready)']],
  warmup: [[['Space'], 'show the answer'], [['→'], 'I was right'], [['←'], 'I was wrong'], [['R'], 'redo the warm-up (at the end)']],
  study: [
    [['Space'], 'show the answer'], [['→'], 'I was right'], [['←'], 'I was wrong'],
    [['H'], 'change the verdict ("No, I knew it" / "Actually, I guessed")'],
    [['Y', 'N'], 'Check mode: was that a guess?'], [['Space'], 'next card (after a verdict)'], [['Esc'], 'end the session'],
  ],
  summary: [[['Enter'], 'back to decks'], [['A'], 'study more']],
  settings: [[['Tab'], 'move between settings'], [['Space'], 'tick / untick']],
  progress: [],
};

export function shortcutsFor(screen: ScreenName): Row[] {
  return [...(BY_SCREEN[screen] ?? []), ...COMMON];
}

export function toggleShortcuts(rows: Row[]): void {
  const open = document.getElementById('shortcuts');
  if (open) {
    open.remove();
    return;
  }
  const close = () => document.getElementById('shortcuts')?.remove();
  const overlay = h('div.overlay', { id: 'shortcuts', onclick: (e: Event) => e.target === e.currentTarget && close() },
    h('div.overlay-card', { role: 'dialog', 'aria-label': 'Keyboard shortcuts' },
      h('h2', {}, 'Keyboard shortcuts'),
      h('table.keys-table', {}, ...rows.map(([keys, what]) => h('tr', {}, h('td', {}, ...keys.map(kbd)), h('td', {}, what)))),
      h('button.btn.small', { onclick: close }, 'Close'),
    ),
  );
  document.body.append(overlay);
}
