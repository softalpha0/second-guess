import { describe, expect, it } from 'vitest';
import { createSchema, recordMessage, schemaToList, truncateArrays } from '../src/core/field-schema';

describe('field schema recorder', () => {
  it('records nested fields, types, ranges and array lengths', () => {
    const s = createSchema();
    recordMessage(s, { cardio: { pulseRate: [{ value: 70, stable: true }] } });
    recordMessage(s, { cardio: { pulseRate: [{ value: 80 }, { value: 75 }] } });
    const byPath = Object.fromEntries(schemaToList(s).map((f) => [f.path, f]));

    expect(byPath['cardio.pulseRate'].minLength).toBe(1);
    expect(byPath['cardio.pulseRate'].maxLength).toBe(2);
    expect(byPath['cardio.pulseRate[].value']).toMatchObject({ types: ['number'], min: 70, max: 80, example: 70 });
    expect(byPath['cardio.pulseRate[].stable']).toMatchObject({ types: ['boolean'], count: 1 });
  });

  it('collects distinct string values such as expression names', () => {
    const s = createSchema();
    recordMessage(s, { scores: [{ type: 'HAPPY' }, { type: 'NEUTRAL' }, { type: 'HAPPY' }] });
    expect(s.get('scores[].type')?.values).toEqual(['HAPPY', 'NEUTRAL']);
  });

  it('samples very long arrays without walking every item', () => {
    const s = createSchema();
    const points = Array.from({ length: 500 }, (_, i) => ({ x: i, y: i }));
    recordMessage(s, { landmarks: [{ value: points }] });
    expect(s.get('landmarks[].value')?.maxLength).toBe(500);
    expect(s.get('landmarks[].value[].x')?.count).toBe(8);
    expect(s.get('landmarks[].value[].x')?.max).toBe(499); // last item is still included
  });

  it('truncates arrays for readable samples', () => {
    expect(truncateArrays({ a: [1, 2, 3, 4, 5] }, 2)).toEqual({ a: [1, 2, '… 3 more'] });
  });
});
