// M8: session summary numbers, from the attempts in one study session.
// Pure, unit-tested.

import type { Verdict } from './hesitation';

export interface Attempt {
  cardId: string;
  front: string;
  back: string;
  correct: boolean;
  verdict: Verdict;
  reasons: string[];
  overridden: boolean;
  /** Second+ attempt at this card in the session (after a wrong answer). */
  retry: boolean;
  recallMs: number;
  /** When the card comes back after this attempt (YYYY-MM-DD). */
  due: string;
}

export interface SessionSummary {
  studied: number;
  right: number;
  wrong: number;
  sure: number;
  hesitated: number;
  /** Right, but not judged (camera view unclear, or camera off). */
  unjudged: number;
  overrides: number;
  avgRecallMs: number;
  topReasons: { reason: string; count: number }[];
  hesitatedCards: { front: string; back: string; reasons: string[]; overridden: boolean }[];
  /** Cards brought back tomorrow because they were missed or hesitated. */
  tomorrow: { front: string; back: string; why: 'hesitated' | 'wrong' }[];
  /** Other cards that are simply next due tomorrow on the normal schedule. */
  tomorrowOther: number;
  /** Was the hesitation check active at all? */
  checked: boolean;
}

export function summarize(attempts: Attempt[], tomorrowDay: string, checked: boolean): SessionSummary {
  // judge each card by its FIRST attempt; its final schedule by its LAST
  const first = new Map<string, Attempt>();
  const last = new Map<string, Attempt>();
  for (const a of attempts) {
    if (!first.has(a.cardId)) first.set(a.cardId, a);
    last.set(a.cardId, a);
  }
  const firsts = [...first.values()];
  const right = firsts.filter((a) => a.correct);
  const hesitated = right.filter((a) => a.verdict === 'hesitated');

  const reasonCounts = new Map<string, number>();
  for (const a of hesitated) {
    if (a.overridden) continue; // the student's own call, no measured reason
    for (const r of a.reasons) reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
  }

  const tomorrow: SessionSummary['tomorrow'] = [];
  let tomorrowOther = 0;
  for (const a of firsts) {
    const fin = last.get(a.cardId)!;
    if (fin.due !== tomorrowDay) continue;
    if (!a.correct) tomorrow.push({ front: a.front, back: a.back, why: 'wrong' });
    else if (a.verdict === 'hesitated') tomorrow.push({ front: a.front, back: a.back, why: 'hesitated' });
    else tomorrowOther++;
  }

  return {
    studied: firsts.length,
    right: right.length,
    wrong: firsts.length - right.length,
    sure: right.filter((a) => a.verdict === 'sure').length,
    hesitated: hesitated.length,
    unjudged: right.filter((a) => a.verdict === 'no-reading' || a.verdict === 'not-checked').length,
    overrides: attempts.filter((a) => a.overridden).length,
    avgRecallMs: firsts.length ? firsts.reduce((s, a) => s + a.recallMs, 0) / firsts.length : 0,
    topReasons: [...reasonCounts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    hesitatedCards: hesitated.map((a) => ({ front: a.front, back: a.back, reasons: a.reasons, overridden: a.overridden })),
    tomorrow,
    tomorrowOther,
    checked,
  };
}
