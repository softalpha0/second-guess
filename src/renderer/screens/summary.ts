// M8: session summary — what you studied, which right answers were guesses,
// the most common reasons, and what comes back tomorrow.
import type { Screen } from '../main';
import { h, kbd } from '../ui';
import { session } from '../app';
import { beginStudy } from '../flow';
import { replayView } from '../replay-view';
import { agreementText } from '../../core/check-mode';

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

  function checkBlock(): HTMLElement | null {
    const a = session.lastAgreement;
    if (!a) return null;
    return h('div.block', {},
      h('h2', {}, 'Check mode result'),
      h('p', {}, agreementText(a)),
      a.total
        ? h('ul.small', {},
            h('li', {}, `You guessed and Second Guess noticed: ${a.caught}`),
            h('li', {}, `You guessed but it said "knew it": ${a.missed}`),
            h('li', {}, `You knew it but it said "hesitated": ${a.falseAlarms}`),
            h('li', {}, `You knew it and it agreed: ${a.bothSure}`))
        : null,
    );
  }

  function replayBlock(): HTMLElement | null {
    const reps = session.lastReplays;
    if (!reps.length) return null;
    const holder = h('div');
    const list = h('ul.card-list', {}, ...reps.map((r) => {
      const row = h('li', {},
        h(`span.tag.${r.verdict === 'hesitated' ? 'hesitated' : 'sure-tag'}`, {}, r.verdict === 'hesitated' ? 'hesitated' : 'knew it'),
        ' ', h('strong', {}, r.front), ' — ', r.back,
        h('span.muted.small', {}, ` · score ${r.score ?? '—'}${r.selfGuess !== undefined ? ` · you said: ${r.selfGuess ? 'guess' : 'knew it'}` : ''}  `),
      );
      const btn = h('button.btn.small', {}, 'Replay') as HTMLButtonElement;
      let open: HTMLElement | null = null;
      btn.addEventListener('click', () => {
        if (open) { open.remove(); open = null; btn.textContent = 'Replay'; return; }
        open = h('div.replay', {}, replayView(r.tracks),
          h('div.small.muted', {}, r.reasons.length ? `Reasons: ${r.reasons.join(', ')}` : 'No hesitation signs above the line.'));
        row.append(open);
        btn.textContent = 'Hide';
      });
      row.insertBefore(btn, row.children[row.children.length - 1].nextSibling);
      return row;
    }));
    holder.append(h('h2', {}, 'Signal replay'), h('p.small.muted', {}, 'What the camera noticed while you were recalling each answer (numbers only — no video was kept).'), list);
    return h('div.block', {}, holder);
  }

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

      checkBlock(),
      replayBlock(),

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
      if (e.target instanceof HTMLButtonElement && e.key === 'Enter') return; // let focused buttons work
      if (e.key === 'Enter' || e.key === 'Escape') go('decks');
      else if (e.key.toLowerCase() === 'a') void beginStudy(go, s.deckId);
    },
  };
};
