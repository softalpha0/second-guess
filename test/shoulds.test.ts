import { describe, expect, it } from 'vitest';
import { agreement, agreementText } from '../src/core/check-mode';
import { progress } from '../src/core/progress';
import { replayTracks } from '../src/core/replay';
import type { Baseline } from '../src/core/baseline';
import type { RecallSignals } from '../src/core/signals';

describe('S1 check mode agreement', () => {
  it('counts caught guesses, misses, false alarms and agreement', () => {
    const a = agreement([
      { appHesitated: true, selfGuess: true },
      { appHesitated: false, selfGuess: true },
      { appHesitated: true, selfGuess: false },
      { appHesitated: false, selfGuess: false },
      { appHesitated: false, selfGuess: false },
    ]);
    expect(a).toMatchObject({ total: 5, agreed: 3, percent: 60, caught: 1, missed: 1, falseAlarms: 1, bothSure: 2 });
    expect(agreementText(a)).toBe('In 5 right answers, Second Guess agreed with you on 60%.');
  });
  it('says so when there is nothing yet', () => {
    expect(agreement([]).percent).toBeNull();
    expect(agreementText(agreement([]))).toMatch(/No Check mode/);
  });
});

describe('S3 progress', () => {
  const r = (cardId: string, at: string, verdict: string, correct = true) => ({ deckId: 'd', cardId, at, verdict, correct });
  it('counts lucky cards that became sure, and per-day results', () => {
    const p = progress([
      r('a', '2026-11-16T10:00:00', 'hesitated'),
      r('a', '2026-11-17T10:00:00', 'sure'),
      r('b', '2026-11-16T10:00:00', 'hesitated'),
      r('b', '2026-11-17T10:00:00', 'hesitated'),
      r('c', '2026-11-17T11:00:00', 'not-checked', false),
    ], 3, '2026-11-17');
    expect(p.luckyBecameSure).toBe(1);
    expect(p.stillShaky).toBe(1);
    expect(p.days.map((d) => d.day)).toEqual(['2026-11-15', '2026-11-16', '2026-11-17']);
    expect(p.days[2]).toMatchObject({ sure: 1, hesitated: 1, wrong: 1 });
  });
  it('in Check mode the student\'s own answer counts', () => {
    const p = progress([{ deckId: 'd', cardId: 'a', at: '2026-11-17T10:00:00', correct: true, verdict: 'hesitated', selfGuess: false }], 1, '2026-11-17');
    expect(p.days[0]).toMatchObject({ sure: 1, hesitated: 0 });
  });
});

describe('S2 replay tracks', () => {
  const b: Baseline = {
    createdAt: 'x', recallMedianMs: 1000, frontLength: 16, cardsUsed: 8, signalsMissingReason: null,
    signals: {
      blinkPerMin: 15, breathSpread: 1,
      head: { yaw: 0, pitch: 0, yawSpread: 0.02, pitchSpread: 0.02, gx: null, gy: null, gxSpread: null, gySpread: null },
      expr: { level: 10, spread: 4 },
    },
  };
  const s: RecallSignals = {
    fromMs: 0, toMs: 4000, durationMs: 4000, quality: { okFraction: 1, faceRate: 25, good: true },
    blinkOnsets: [1200],
    head: [{ t: 0, yaw: 0, pitch: 0, gx: null, gy: null }, { t: 100, yaw: 0.16, pitch: 0, gx: null, gy: null }],
    breath: Array.from({ length: 40 }, (_, i) => ({ t: i * 100, v: i < 10 ? Math.sin(i) * 2 : 0.1 })),
    expr: [{ t: 0, v: 18 }],
    talkingFraction: 0,
  };
  it('scales head distance to the looked-away line and finds flat breathing', () => {
    const r = replayTracks(s, b, 4000)!;
    expect(r.away[1].v).toBe(2); // 0.16 vs limit 0.08
    expect(r.flat.length).toBe(1);
    expect(r.flat[0].to - r.flat[0].from).toBeGreaterThanOrEqual(2500);
    expect(r.expr[0].v).toBe(2);
    expect(r.blinks).toEqual([1200]);
  });
  it('returns null without a camera baseline', () => {
    expect(replayTracks(s, { ...b, signals: null }, 1000)).toBeNull();
  });
});

import { csvField, toCsv } from '../src/core/export-csv';
describe('CSV export', () => {
  it('quotes commas and quotes, and blocks formulas', () => {
    expect(csvField('Paris, France')).toBe('"Paris, France"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)");
  });
  it('writes a header and one row per answer', () => {
    const csv = toCsv([{ at: '2026-11-16T10:00:00Z', deck: 'Caps', front: 'Capital of Peru?', back: 'Lima', correct: true, verdict: 'hesitated', score: 62, reasons: ['long pause', 'looked away'], recallMs: 4210, signal: 'good' }]);
    const [head, row] = csv.trim().split('\r\n');
    expect(head.startsWith('date,deck,front,back,correct')).toBe(true);
    expect(row).toBe('2026-11-16T10:00:00Z,Caps,Capital of Peru?,Lima,yes,hesitated,62,long pause; looked away,4.21,,,good');
  });
});
