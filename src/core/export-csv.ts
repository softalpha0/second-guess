// "Export progress as CSV": one row per answered card. Pure, unit-tested.

export interface ExportRow {
  at: string;
  deck: string;
  front: string;
  back: string;
  correct: boolean;
  verdict?: string;
  score?: number | null;
  reasons?: string[];
  recallMs: number;
  overridden?: boolean;
  selfGuess?: boolean;
  signal: string;
}

/** Quote a CSV field when needed (commas, quotes, line breaks); also blocks spreadsheet formulas. */
export function csvField(v: unknown): string {
  let s = v === undefined || v === null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // a cell starting with = could run as a formula in Excel
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: ExportRow[]): string {
  const header = ['date', 'deck', 'front', 'back', 'correct', 'verdict', 'hesitation_score', 'reasons', 'recall_seconds', 'you_overrode', 'you_said_guess', 'camera_reading'];
  const lines = rows.map((r) =>
    [
      r.at,
      r.deck,
      r.front,
      r.back,
      r.correct ? 'yes' : 'no',
      r.verdict ?? '',
      r.score ?? '',
      (r.reasons ?? []).join('; '),
      (r.recallMs / 1000).toFixed(2),
      r.overridden ? 'yes' : '',
      r.selfGuess === undefined ? '' : r.selfGuess ? 'yes' : 'no',
      r.signal,
    ].map(csvField).join(','),
  );
  return [header.join(','), ...lines].join('\r\n') + '\r\n';
}
