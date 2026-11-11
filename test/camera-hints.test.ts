import { describe, expect, it } from 'vitest';
import { cameraHint, ReadyGate } from '../src/core/camera-hints';

describe('camera hints', () => {
  it('turns SDK codes into plain words', () => {
    expect(cameraHint('TooDark')).toMatch(/more light/i);
    expect(cameraHint('FaceTooFar')).toMatch(/closer/i);
    expect(cameraHint('SomethingNew')).toMatch(/keep your face/i);
  });
});

describe('ready gate', () => {
  it('is ready only after Ok holds for 2 seconds without a break', () => {
    const g = new ReadyGate(2000);
    expect(g.update('Ok', 0)).toBe(false);
    expect(g.update('Ok', 1500)).toBe(false);
    expect(g.update('TooDark', 1600)).toBe(false); // break resets
    expect(g.update('Ok', 1700)).toBe(false);
    expect(g.update('Ok', 3600)).toBe(false);
    expect(g.update('Ok', 3700)).toBe(true);
    expect(g.progress(3700)).toBe(1);
  });
});
