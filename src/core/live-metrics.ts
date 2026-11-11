// Turns the stream of decoded SDK messages into a small "live snapshot"
// for the screen: latest pulse, breathing, blinking, expressions, landmarks.
//
// The SDK may send each reading once, or resend older readings in later
// messages. To be safe we keep, per signal, the timestamp of the newest
// reading already used, and ignore anything not newer. Pure, unit-tested.

export interface Reading {
  value: number;
  confidence?: number;
  stable?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface LiveSnapshot {
  pulse: Reading | null;
  breathingRate: Reading | null;
  /** Recent chest-breathing trace values, oldest first. */
  breathTrace: { t: number; v: number }[];
  blinking: boolean | null;
  blinkCount: number;
  talking: boolean | null;
  /** Expression scores from the newest reading, highest first. */
  expressions: { name: string; score: number }[] | null;
  landmarks: { count: number; stable: boolean; points: Point[] } | null;
  messages: number;
}

// Loose shapes of the decoded message (protobuf toObject, longs as numbers).
type Ts = number | undefined;
interface M { value?: number; confidence?: number; stable?: boolean; timestamp?: Ts }
interface D { detected?: boolean; stable?: boolean; timestamp?: Ts }
interface L { value?: Point[]; stable?: boolean; timestamp?: Ts }
interface E { stable?: boolean; timestamp?: Ts; scores?: { type?: string | number; confidence?: number }[] }
export interface DecodedMetrics {
  breathing?: { rate?: M[]; upperTrace?: M[] };
  cardio?: { pulseRate?: M[] };
  face?: { blinking?: D[]; talking?: D[]; landmarks?: L[]; expression?: E[] };
}

const TRACE_WINDOW_US = 20_000_000; // keep the last 20 s of breathing trace

export class LiveTracker {
  private last = new Map<string, number>();
  private snap: LiveSnapshot = {
    pulse: null,
    breathingRate: null,
    breathTrace: [],
    blinking: null,
    blinkCount: 0,
    talking: null,
    expressions: null,
    landmarks: null,
    messages: 0,
  };

  /** Items newer than the last one used for this signal, oldest first. */
  private fresh<T extends { timestamp?: Ts }>(key: string, items: T[] | undefined): T[] {
    if (!items || items.length === 0) return [];
    const lastTs = this.last.get(key) ?? -Infinity;
    const out = items
      .filter((i) => (i.timestamp ?? 0) > lastTs)
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    if (out.length > 0) this.last.set(key, out[out.length - 1].timestamp ?? 0);
    return out;
  }

  ingest(m: DecodedMetrics): LiveSnapshot {
    const s = this.snap;
    s.messages += 1;

    const latest = (items: M[]): Reading | null => {
      const r = items[items.length - 1];
      return r && typeof r.value === 'number'
        ? { value: r.value, confidence: r.confidence, stable: r.stable }
        : null;
    };

    const pulse = this.fresh('pulse', m.cardio?.pulseRate);
    if (pulse.length) s.pulse = latest(pulse) ?? s.pulse;

    const br = this.fresh('breathRate', m.breathing?.rate);
    if (br.length) s.breathingRate = latest(br) ?? s.breathingRate;

    for (const p of this.fresh('breathTrace', m.breathing?.upperTrace)) {
      if (typeof p.value === 'number') s.breathTrace.push({ t: p.timestamp ?? 0, v: p.value });
    }
    if (s.breathTrace.length) {
      const cutoff = s.breathTrace[s.breathTrace.length - 1].t - TRACE_WINDOW_US;
      s.breathTrace = s.breathTrace.filter((p) => p.t >= cutoff);
    }

    for (const b of this.fresh('blink', m.face?.blinking)) {
      const now = b.detected === true;
      if (now && s.blinking !== true) s.blinkCount += 1; // count each new blink once
      s.blinking = now;
    }

    const talk = this.fresh('talk', m.face?.talking);
    if (talk.length) s.talking = talk[talk.length - 1].detected === true;

    const expr = this.fresh('expr', m.face?.expression);
    if (expr.length) {
      const scores = expr[expr.length - 1].scores ?? [];
      s.expressions = scores
        .map((sc) => ({ name: String(sc.type ?? 'UNKNOWN'), score: sc.confidence ?? 0 }))
        .sort((a, b) => b.score - a.score);
    }

    const lm = this.fresh('landmarks', m.face?.landmarks);
    if (lm.length) {
      const l = lm[lm.length - 1];
      const points = (l.value ?? []).map((p) => ({ x: p.x ?? 0, y: p.y ?? 0 }));
      s.landmarks = { count: points.length, stable: l.stable === true, points };
    }

    return { ...s, breathTrace: [...s.breathTrace] };
  }
}
