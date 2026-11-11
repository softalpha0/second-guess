import { describe, expect, it } from 'vitest';
import { importAnki, importCsv, importDeckFile, parseDelimited, stripHtml } from '../src/core/deck-import';

describe('CSV import', () => {
  it('reads front,back rows and skips a header', () => {
    const r = importCsv('front,back\nHola,Hello\nAdiós,Goodbye\n');
    expect(r.cards.map((c) => [c.front, c.back])).toEqual([['Hola', 'Hello'], ['Adiós', 'Goodbye']]);
    expect(r.skipped).toEqual([]);
  });

  it('handles quotes, commas and newlines inside quotes, and Windows line endings', () => {
    const r = importCsv('"Capital of France, Europe",Paris\r\n"Say ""hi""","line1\nline2"\r\n');
    expect(r.cards[0]).toMatchObject({ front: 'Capital of France, Europe', back: 'Paris' });
    expect(r.cards[1]).toMatchObject({ front: 'Say "hi"', back: 'line1\nline2' });
  });

  it('reports rows it cannot use, with line numbers', () => {
    const r = importCsv('a,b\nonly-one-column\n,empty front\nc,d\na,duplicate');
    expect(r.cards).toHaveLength(2);
    expect(r.skipped.map((s) => s.line)).toEqual([2, 3, 5]);
    expect(r.skipped[0].reason).toMatch(/two columns/);
  });

  it('ignores blank lines and a byte-order mark', () => {
    expect(importCsv('﻿a,b\n\n\nc,d').cards).toHaveLength(2);
  });

  it('gives the same card the same id every time', () => {
    expect(importCsv('Hola,Hello').cards[0].id).toBe(importCsv('Hola,Bye').cards[0].id);
  });
});

describe('Anki plain-text import', () => {
  it('reads tab-separated notes with header lines and HTML', () => {
    const text = '#separator:tab\n#html:true\nperro\tdog<br>(animal)\n<b>gato</b>\tcat &amp; kitten\n';
    const r = importAnki(text);
    expect(r.cards.map((c) => [c.front, c.back])).toEqual([
      ['perro', 'dog\n(animal)'],
      ['gato', 'cat & kitten'],
    ]);
  });

  it('respects #separator:semicolon and #html:false', () => {
    const r = importAnki('#separator:semicolon\n#html:false\n<b>x</b>;y');
    expect(r.cards[0]).toMatchObject({ front: '<b>x</b>', back: 'y' });
  });

  it('keeps line numbers correct after header lines', () => {
    const r = importAnki('#separator:tab\nonlyfront\n');
    expect(r.skipped[0].line).toBe(2);
  });

  it('ignores extra columns such as tags', () => {
    expect(importAnki('front\tback\ttag1 tag2').cards[0]).toMatchObject({ front: 'front', back: 'back' });
  });
});

describe('format detection', () => {
  it('uses CSV for .csv and Anki for tab text', () => {
    expect(importDeckFile('x.csv', 'a,b').cards[0].back).toBe('b');
    expect(importDeckFile('x.txt', 'a\tb').cards[0].back).toBe('b');
    expect(importDeckFile('x.txt', 'a,b').cards[0].back).toBe('b');
  });
});

describe('helpers', () => {
  it('stripHtml decodes numeric entities and drops tags', () => {
    expect(stripHtml('<div>caf&#233;</div><div>&#x263A;</div>')).toBe('café\n☺');
  });
  it('parseDelimited keeps empty trailing fields', () => {
    expect(parseDelimited('a,', ',')[0].fields).toEqual(['a', '']);
  });
});
