import { describe, expect, it } from 'vitest';
import { LiveTracker } from '../src/core/live-metrics';

describe('live tracker', () => {
  it('shows the newest pulse and breathing rate', () => {
    const t = new LiveTracker();
    const s = t.ingest({
      cardio: { pulseRate: [{ value: 70, confidence: 0.9, timestamp: 1 }, { value: 72, timestamp: 2 }] },
      breathing: { rate: [{ value: 14, timestamp: 2 }] },
    });
    expect(s.pulse?.value).toBe(72);
    expect(s.breathingRate?.value).toBe(14);
  });

  it('counts each blink once, even if readings are resent', () => {
    const t = new LiveTracker();
    const blinks = [
      { detected: false, timestamp: 1 },
      { detected: true, timestamp: 2 },
      { detected: true, timestamp: 3 },
      { detected: false, timestamp: 4 },
    ];
    t.ingest({ face: { blinking: blinks.slice(0, 3) } });
    // second message resends old readings plus a new blink
    const s = t.ingest({ face: { blinking: [...blinks, { detected: true, timestamp: 5 }] } });
    expect(s.blinkCount).toBe(2);
    expect(s.blinking).toBe(true);
  });

  it('does not duplicate resent breathing trace points', () => {
    const t = new LiveTracker();
    t.ingest({ breathing: { upperTrace: [{ value: 1, timestamp: 1 }, { value: 2, timestamp: 2 }] } });
    const s = t.ingest({ breathing: { upperTrace: [{ value: 2, timestamp: 2 }, { value: 3, timestamp: 3 }] } });
    expect(s.breathTrace.map((p) => p.v)).toEqual([1, 2, 3]);
  });

  it('keeps only the last 20 seconds of breathing trace', () => {
    const t = new LiveTracker();
    const s = t.ingest({
      breathing: { upperTrace: [{ value: 1, timestamp: 0 }, { value: 2, timestamp: 25_000_000 }] },
    });
    expect(s.breathTrace.map((p) => p.v)).toEqual([2]);
  });

  it('sorts expression scores, highest first', () => {
    const t = new LiveTracker();
    const s = t.ingest({
      face: { expression: [{ timestamp: 1, scores: [{ type: 'NEUTRAL', confidence: 0.2 }, { type: 'HAPPY', confidence: 0.7 }] }] },
    });
    expect(s.expressions?.[0]).toEqual({ name: 'HAPPY', score: 0.7 });
  });
});
