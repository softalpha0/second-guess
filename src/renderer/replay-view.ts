// S2: draws one card's recall window as a small timeline (hand-written SVG).
import type { ReplayTracks } from '../core/replay';

const ns = 'http://www.w3.org/2000/svg';
const W = 700;
const LEFT = 110;
const LANE = 34;

function el(tag: string, attrs: Record<string, string | number>, text?: string): SVGElement {
  const e = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text) e.textContent = text;
  return e;
}

export function replayView(t: ReplayTracks): SVGSVGElement {
  const lanes = ['Time to reveal', 'Looking away', 'Blinks', 'Breathing', 'Expression'];
  const H = lanes.length * LANE + 18;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}` }) as SVGSVGElement;
  const dur = Math.max(1, t.durationMs);
  const x = (ms: number) => LEFT + (Math.min(ms, dur) / dur) * (W - LEFT - 10);
  const y0 = (i: number) => i * LANE + 6;
  const lineFor = (pts: { t: number; v: number }[], lane: number, vmax: number, cls: string) => {
    if (pts.length < 2) return null;
    const top = y0(lane) + 2;
    const h = LANE - 10;
    const d = pts.map((p) => `${x(p.t).toFixed(1)},${(top + h - (Math.min(Math.max(p.v, 0), vmax) / vmax) * h).toFixed(1)}`).join(' ');
    return el('polyline', { points: d, class: `line ${cls}` });
  };
  const limit = (lane: number, v: number, vmax: number) => {
    const top = y0(lane) + 2;
    const h = LANE - 10;
    const yy = top + h - (v / vmax) * h;
    return el('line', { x1: LEFT, x2: W - 10, y1: yy, y2: yy, class: 'limit' });
  };

  lanes.forEach((name, i) => svg.append(el('text', { x: 0, y: y0(i) + LANE / 2, class: 'lane-label' }, name)));

  // lane 0: your time vs your usual pace (both scaled to the longer one)
  const longest = Math.max(t.recallMs, t.normalMs);
  const bw = (ms: number) => (ms / longest) * (W - LEFT - 10);
  svg.append(el('rect', { x: LEFT, y: y0(0) + 4, width: bw(t.normalMs), height: 8, class: 'normal-bar' }));
  svg.append(el('rect', { x: LEFT, y: y0(0) + 15, width: bw(t.recallMs), height: 8, class: 'recall-bar' }));
  svg.append(el('text', { x: W - 10, y: y0(0) + 12, class: 'lane-label', 'text-anchor': 'end' }, `usual ${(t.normalMs / 1000).toFixed(1)} s · this card ${(t.recallMs / 1000).toFixed(1)} s`));

  // lane 1: looking away (1 = the "away" line)
  svg.append(limit(1, 1, 2));
  const away = lineFor(t.away, 1, 2, 'away-line');
  if (away) svg.append(away);

  // lane 2: blinks
  for (const b of t.blinks) svg.append(el('line', { x1: x(b), x2: x(b), y1: y0(2) + 6, y2: y0(2) + LANE - 8, class: 'blink' }));

  // lane 3: breathing with flat parts shaded
  for (const f of t.flat) svg.append(el('rect', { x: x(f.from), y: y0(3) + 2, width: Math.max(2, x(f.to) - x(f.from)), height: LANE - 10, class: 'flat' }));
  const br = lineFor(t.breath, 3, 1, 'breath-line');
  if (br) svg.append(br);

  // lane 4: expression change (1.5 = starts to count)
  if (t.expr.length) {
    svg.append(limit(4, 1.5, 4));
    const ex = lineFor(t.expr, 4, 4, 'expr-line');
    if (ex) svg.append(ex);
  }

  svg.append(el('text', { x: LEFT, y: H - 2, class: 'lane-label' }, 'card shown'));
  svg.append(el('text', { x: W - 10, y: H - 2, class: 'lane-label', 'text-anchor': 'end' }, 'Space pressed'));
  return svg;
}
