// Home: pick a deck (↑/↓ + Enter), import CSV / Anki text (I), delete imported (Delete).
import type { Screen } from '../main';
import type { DeckSummary } from '../../shared/types';
import { h, kbd } from '../ui';
import { session } from '../app';
import { beginStudy } from '../flow';

function deckMeta(d: DeckSummary): string {
  const parts: string[] = [];
  if (d.due) parts.push(`${d.due} due`);
  if (d.fresh) parts.push(d.fresh === d.count ? `${d.count} new` : `${d.fresh} new`);
  if (!d.due && !d.fresh) parts.push('all caught up');
  parts.push(`${d.count} cards`);
  if (d.source === 'imported') parts.push('imported');
  return parts.join(' · ');
}

export const decksScreen: Screen = async (root, go) => {
  let decks: DeckSummary[] = await window.sg.listDecks();
  const info = await window.sg.info();
  if (info.loadError || !info.hasKey) {
    session.noCamera = true;
    session.noCameraReason = info.loadError
      ? 'The camera part (SmartSpectra SDK) could not load on this computer.'
      : 'No Presage API key was found, so the camera can\u2019t be used.';
  }
  const canUseCamera = !info.loadError && info.hasKey;
  let selected = 0;
  const list = h('ul.deck-list', { role: 'listbox' });
  const message = h('div.notice');
  message.hidden = true;

  function say(text: string | null, kind: 'info' | 'error' = 'info'): void {
    message.hidden = !text;
    message.textContent = text ?? '';
    message.className = `notice ${kind}`;
  }

  function render(): void {
    list.replaceChildren(
      ...decks.map((d, i) =>
        h(
          `li.deck${i === selected ? '.selected' : ''}`,
          { role: 'option', 'aria-selected': i === selected, onclick: () => { selected = i; render(); }, ondblclick: () => void study() },
          h('span.deck-name', {}, d.name),
          h('span.deck-meta', {}, deckMeta(d)),
          h('button.btn.small', { onclick: (e: Event) => { e.stopPropagation(); selected = i; void study(); } }, 'Study'),
        ),
      ),
    );
  }

  async function study(): Promise<void> {
    const d = decks[selected];
    if (d) await beginStudy(go, d.id);
  }

  async function doImport(): Promise<void> {
    say(null);
    const r = await window.sg.importDeck();
    if (r.cancelled) return;
    if (!r.ok) {
      say(r.error ?? 'Import failed.', 'error');
      return;
    }
    decks = await window.sg.listDecks();
    selected = decks.findIndex((d) => d.id === r.deck!.id);
    render();
    const skipped = r.skipped ?? [];
    const detail = skipped.length
      ? ` ${skipped.length} line${skipped.length > 1 ? 's' : ''} skipped (e.g. line ${skipped[0].line}: ${skipped[0].reason}).`
      : '';
    say(`Imported "${r.deck!.name}": ${r.deck!.count} cards.${detail}`);
  }

  async function doDelete(): Promise<void> {
    const d = decks[selected];
    if (!d || d.source !== 'imported') return;
    if (!confirm(`Delete the imported deck "${d.name}"?`)) return;
    await window.sg.deleteDeck(d.id);
    decks = await window.sg.listDecks();
    selected = Math.min(selected, decks.length - 1);
    render();
    say(`Deleted "${d.name}".`);
  }

  const modeLine = session.noCamera
    ? h('div.notice.nocam', {},
        h('strong', {}, 'No camera mode — plain flashcards. '),
        `${session.noCameraReason ?? ''} Cards are still scheduled, but right answers aren\u2019t checked for hesitation. `,
        canUseCamera
          ? h('button.btn.small', { onclick: () => { session.noCamera = false; session.noCameraReason = null; go('decks'); } }, 'Use the camera again')
          : h('span.small.muted', {}, 'To turn it on: add SMARTSPECTRA_API_KEY to the .env file and restart the app.'))
    : null;

  root.append(
    h('section.page', {},
      h('h1', {}, 'Your decks'),
      h('p.muted', {}, 'Pick a deck to study. Second Guess notices when a right answer was really a guess.'),
      modeLine,
      list,
      message,
      h('div.row', {},
        h('button.btn', { onclick: () => void doImport() }, 'Import deck…'),
        h('span.small.muted', {}, 'CSV with front,back — or Anki “Notes in Plain Text” export'),
      ),
      h('p.keys', {}, kbd('↑'), kbd('↓'), ' choose   ', kbd('Enter'), ' study   ', kbd('I'), ' import   ', kbd('Delete'), ' remove imported deck   ', kbd('P'), ' progress   ', kbd('S'), ' settings   ', kbd('?'), ' all shortcuts'),
      h('p.small', {}, h('button.linkish.muted', { onclick: () => go('sdk-check') }, 'SDK check (developer)')),
    ),
  );
  render();

  return {
    onKey(e) {
      if (e.key === 'ArrowDown') { selected = Math.min(decks.length - 1, selected + 1); render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { selected = Math.max(0, selected - 1); render(); e.preventDefault(); }
      else if (e.key === 'Enter') void study();
      else if (e.key.toLowerCase() === 'i') void doImport();
      else if (e.key === 'Delete') void doDelete();
      else if (e.key.toLowerCase() === 's') go('settings');
      else if (e.key.toLowerCase() === 'p') go('progress');
    },
  };
};
