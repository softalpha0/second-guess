// M8: session summary — what you studied, which right answers were guesses,
// the most common reasons, and what comes back tomorrow.
import type { Screen } from '../main';
import { h, kbd } from '../ui';
import { session } from '../app';
import { beginStudy } from '../flow';

export const summaryScreen: Screen = (root, go) => {
  const s = session.lastSummary;
  if (!s) return go('decks');

  const tile = (value: string | number, label: string, kind = '') =>
    h(`div.stat${kind ? '.' + kind : ''}`, {}, h('div.stat-value', {}, String(value)), h('div.stat-label', {}, label));

  // one bar: sure | hesitated | unjudged | wrong
  const seg = (n: number, cls: string, title: string) =>
    n > 0 ? h(`div.seg.${cls}`, { title: `${title}: ${n}`, 'data-w': n }) : null;
  const bar = h('div.split-bar', {},
    seg(s.sure, 'sure', 'Right, knew it'),
    seg(s.hesitated, 'hesitated', 'Right, but hesitated'),
    seg(s.unjudged, 'unjudged', 'Right, not checked'),
    seg(s.wrong, 'wrong', 'Wrong'),
  );
  for (const el of Array.from(bar.children) as HTMLElement[]) el.style.flexGrow = el.dataset.w ?? '1';

  const legend = h('div.legend.small', {},
    s.checked ? h('span', {}, h('i.sw.sure'), 'knew it') : h('span', {}, h('i.sw.sure'), 'right'),
    s.checked ? h('span', {}, h('i.sw.hesitated'), 'right but hesitated') : null,
    s.unjudged && s.checked ? h('span', {}, h('i.sw.unjudged'), 'right, no reading') : null,
    h('span', {}, h('i.sw.wrong'), 'wrong'),
  );

  root.append(
    h('section.page', {},
      h('h1', {}, 'Session summary'),
      h('p.muted', {}, s.deckName, s.practice ? ' · practice' : ''),
      h('div.stats', {},
        tile(s.studied, 'cards studied'),
        tile(s.right, 'right'),
        s.checked ? tile(s.hesitated, 'right but hesitated', 'hesitated') : null,
        tile(s.wrong, 'wrong'),
      ),
      bar,
      legend,
      !s.checked
        ? h('p.notice.small', {}, 'Hesitation wasn’t checked in this session (camera off or no warm-up), so every right answer was scheduled normally.')
        : null,

      s.checked && s.hesitatedCards.length
        ? h('div.block', {},
            h('h2', {}, 'Right — but you hesitated'),
            s.topReasons.length
              ? h('p.small.muted', {}, 'Most common: ', s.topReasons.map((r) => `${r.reason} (${r.count})`).join(', '))
              : null,
            h('ul.card-list', {}, ...s.hesitatedCards.map((c) =>
              h('li', {}, h('strong', {}, c.front), ' — ', c.back,
                h('span.muted', {}, c.overridden ? '  · you said you guessed' : c.reasons.length ? `  · ${c.reasons.join(', ')}` : '')))),
          )
        : s.checked
          ? h('div.block', {}, h('h2', {}, 'No lucky guesses this time'), h('p.small.muted', {}, 'Every right answer looked confident.'))
          : null,

      h('div.block', {},
        h('h2', {}, `Coming back tomorrow (${s.tomorrow.length})`),
        s.tomorrow.length
          ? h('ul.card-list', {}, ...s.tomorrow.map((c) =>
              h('li', {}, h(`span.tag.${c.why}`, {}, c.why === 'wrong' ? 'missed' : 'hesitated'), ' ', h('strong', {}, c.front), ' — ', c.back)))
          : h('p.small.muted', {}, 'No missed or hesitated cards.'),
        s.tomorrowOther
          ? h('p.small.muted', {}, `Also due tomorrow on the normal schedule: ${s.tomorrowOther} card${s.tomorrowOther > 1 ? 's' : ''}.`)
          : h('p.small.muted', {}, 'Cards you knew are spaced out over the coming days.'),
      ),

      h('p.small.muted', {},
        `Average time to reveal: ${(s.avgRecallMs / 1000).toFixed(1)} s`,
        s.overrides ? ` · you changed ${s.overrides} verdict${s.overrides > 1 ? 's' : ''} with H` : ''),
      h('div.row', {},
        h('button.btn.primary', { onclick: () => go('decks') }, 'Back to decks'),
        h('button.btn', { onclick: () => void beginStudy(go, s.deckId) }, 'Study more'),
      ),
      h('p.keys', {}, kbd('Enter'), ' back to decks   ', kbd('A'), ' study more'),
    ),
  );

  return {
    onKey(e) {
      if (e.key === 'Enter' || e.key === 'Escape') go('decks');
      else if (e.key.toLowerCase() === 'a') void beginStudy(go, s.deckId);
    },
  };
};
