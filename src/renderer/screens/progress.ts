// S3: progress over days — results per day and "lucky" cards that became sure.
import type { Screen } from '../main';
import { h, kbd } from '../ui';
import { progress } from '../../core/progress';
import { toDay } from '../../core/scheduler';
import { agreement, agreementText } from '../../core/check-mode';

const DAYS = 14;

export const progressScreen: Screen = async (root, go) => {
  const reviews = await window.sg.getReviews();
  const p = progress(reviews, DAYS, toDay(new Date()));

  // hand-written SVG: one stacked bar per day (sure / hesitated / wrong / other)
  const ns = 'http://www.w3.org/2000/svg';
  const W = 700, H = 180, pad = 24;
  const max = Math.max(1, ...p.days.map((d) => d.sure + d.hesitated + d.wrong + d.other));
  const bw = (W - pad * 2) / DAYS;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H + 24}`);
  svg.setAttribute('class', 'progress-chart');
  p.days.forEach((d, i) => {
    let y = H;
    const x = pad + i * bw + 3;
    for (const [n, cls] of [[d.sure, 'sure'], [d.other, 'unjudged'], [d.hesitated, 'hesitated'], [d.wrong, 'wrong']] as const) {
      if (!n) continue;
      const hgt = (n / max) * (H - 10);
      y -= hgt;
      const r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', String(x));
      r.setAttribute('y', String(y));
      r.setAttribute('width', String(bw - 6));
      r.setAttribute('height', String(hgt));
      r.setAttribute('class', `bar ${cls}`);
      const title = document.createElementNS(ns, 'title');
      title.textContent = `${d.day}: ${n} ${cls === 'unjudged' ? 'right (not checked)' : cls}`;
      r.append(title);
      svg.append(r);
    }
    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', String(x + (bw - 6) / 2));
    label.setAttribute('y', String(H + 16));
    label.setAttribute('class', 'axis');
    label.textContent = d.day.slice(8);
    svg.append(label);
  });

  const exportMsg = h('p.small.muted');
  const checked = reviews.filter((r) => r.checkMode && r.selfGuess !== undefined && (r.verdict === 'sure' || r.verdict === 'hesitated'));
  const agree = agreement(checked.map((r) => ({ appHesitated: r.verdict === 'hesitated', selfGuess: !!r.selfGuess })));

  root.append(
    h('section.page', {},
      h('h1', {}, 'Progress'),
      h('div.stats', {},
        h('div.stat.good-stat', {}, h('div.stat-value', {}, String(p.luckyBecameSure)), h('div.stat-label', {}, 'lucky guesses that became sure')),
        h('div.stat.hesitated', {}, h('div.stat-value', {}, String(p.stillShaky)), h('div.stat-label', {}, 'cards still shaky (last answer hesitated)')),
        h('div.stat', {}, h('div.stat-value', {}, String(p.totalReviews)), h('div.stat-label', {}, 'answers in total')),
      ),
      h('h2', {}, `Last ${DAYS} days`),
      p.totalReviews ? svg : h('p.muted', {}, 'Study a deck and your days will show up here.'),
      h('div.legend.small', {},
        h('span', {}, h('i.sw.sure'), 'knew it'), h('span', {}, h('i.sw.hesitated'), 'right but hesitated'),
        h('span', {}, h('i.sw.unjudged'), 'right, not checked'), h('span', {}, h('i.sw.wrong'), 'wrong')),
      h('h2', {}, 'Check mode'),
      h('p', {}, agreementText(agree)),
      h('div.row', {},
        h('button.btn', { onclick: () => go('decks') }, 'Back'),
        h('button.btn', { onclick: async () => {
          const file = await window.sg.exportCsv();
          if (file) exportMsg.textContent = `Saved: ${file}`;
        } }, 'Export progress (CSV)'),
      ),
      exportMsg,
      h('p.keys', {}, kbd('Esc'), ' back'),
    ),
  );
  return { onKey: (e) => e.key === 'Escape' && go('decks') };
};
