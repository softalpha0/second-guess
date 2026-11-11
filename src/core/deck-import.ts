// Deck import: CSV (`front,back`) and Anki "Notes in Plain Text" export
// (tab-separated, optional `#key:value` header lines, may contain HTML).
// Pure functions, unit-tested.

export interface Card {
  id: string;
  front: string;
  back: string;
}

export interface ImportResult {
  cards: Card[];
  /** Lines that couldn't be used, with the reason (1-based line numbers). */
  skipped: { line: number; reason: string }[];
}

/** Small stable hash, used for card ids (same text → same id). */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Split delimited text into rows of fields. Handles "quoted fields",
 * doubled "" quotes inside them, delimiters/newlines inside quotes,
 * and \r\n line endings. Returns each row with its starting line number.
 */
export function parseDelimited(text: string, delimiter: string): { line: number; fields: string[] }[] {
  const rows: { line: number; fields: string[] }[] = [];
  let field = '';
  let fields: string[] = [];
  let inQuotes = false;
  let line = 1;
  let rowLine = 1;
  let fieldStarted = false;

  const endField = () => {
    fields.push(field);
    field = '';
    fieldStarted = false;
  };
  const endRow = () => {
    endField();
    rows.push({ line: rowLine, fields });
    fields = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else {
        if (c === '\n') line++;
        field += c;
      }
      continue;
    }
    if (c === '"' && !fieldStarted && field === '') {
      inQuotes = true;
      fieldStarted = true;
    } else if (c === delimiter) {
      endField();
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endRow();
      line++;
      rowLine = line;
    } else {
      field += c;
      fieldStarted = true;
    }
  }
  if (field !== '' || fields.length > 0) endRow();
  return rows;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

/** Anki fields may contain HTML: keep line breaks, drop tags, decode common entities. */
export function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, code: string) => {
      const lower = code.toLowerCase();
      if (ENTITIES[lower] !== undefined) return ENTITIES[lower];
      if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16));
      if (lower.startsWith('#')) return String.fromCodePoint(parseInt(lower.slice(1), 10));
      return m;
    })
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function toCards(rows: { line: number; fields: string[] }[], clean: (s: string) => string): ImportResult {
  const cards: Card[] = [];
  const skipped: ImportResult['skipped'] = [];
  const seen = new Set<string>();
  for (const { line, fields } of rows) {
    if (fields.length === 1 && fields[0].trim() === '') continue; // blank line
    const front = clean(fields[0] ?? '');
    const back = clean(fields[1] ?? '');
    if (!front || !back) {
      skipped.push({ line, reason: fields.length < 2 ? 'needs two columns (front and back)' : 'front or back is empty' });
      continue;
    }
    const id = hashText(front);
    if (seen.has(id)) {
      skipped.push({ line, reason: 'duplicate front' });
      continue;
    }
    seen.add(id);
    cards.push({ id, front, back });
  }
  return { cards, skipped };
}

/** CSV with `front,back`. A first row "front,back" (any case) is treated as a header. */
export function importCsv(text: string): ImportResult {
  const rows = parseDelimited(text.replace(/^﻿/, ''), ',');
  if (rows.length && rows[0].fields.map((f) => f.trim().toLowerCase()).join(',') === 'front,back') rows.shift();
  return toCards(rows, (s) => s.trim());
}

/** Anki "Notes in Plain Text" (.txt): tab-separated, `#separator:` / `#html:` header lines. */
export function importAnki(text: string): ImportResult {
  let body = text.replace(/^﻿/, '');
  let delimiter = '\t';
  let html = true;
  const lines = body.split(/\r?\n/);
  let headerLines = 0;
  for (const l of lines) {
    if (!l.startsWith('#')) break;
    const m = /^#(\w+):(.*)$/.exec(l);
    if (m) {
      const key = m[1].toLowerCase();
      const val = m[2].trim().toLowerCase();
      if (key === 'separator') delimiter = { tab: '\t', comma: ',', semicolon: ';', space: ' ', pipe: '|', colon: ':' }[val] ?? (val.length === 1 ? val : '\t');
      if (key === 'html') html = val === 'true';
    }
    headerLines++;
  }
  body = lines.slice(headerLines).join('\n');
  const rows = parseDelimited(body, delimiter).map((r) => ({ ...r, line: r.line + headerLines }));
  return toCards(rows, (s) => (html ? stripHtml(s) : s.trim()));
}

/** Pick the importer from the file name and content. */
export function importDeckFile(fileName: string, text: string): ImportResult {
  const isCsv = fileName.toLowerCase().endsWith('.csv');
  if (isCsv) return importCsv(text);
  const firstLine = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? '';
  if (firstLine.startsWith('#') || text.includes('\t')) return importAnki(text);
  return importCsv(text);
}
