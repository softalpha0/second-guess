// Per-frame signal features and the "recall window" extractor.
//
// The background process feeds every decoded SDK message into a
// SignalBuffer. When a card is answered, the app asks for the signals
// between "front shown" and "Space pressed" (the recall window).
// Nothing here is an image: only numbers derived from face points,
// blink flags, the breathing trace and expression scores.
// Pure, unit-tested.

import type { DecodedMetrics, Point } from './live-metrics';

/** Face-mesh point numbers (478-point mesh: 468 face + 10 iris). */
export const LM = {
  noseTip: 1,
  faceLeft: 234,
  faceRight: 454,
  forehead: 10,
  chin: 152,
  rEyeOuter: 33,
  rEyeInner: 133,
  rEyeTop: 159,
  rEyeBottom: 145,
  lEyeInner: 362,
  lEyeOuter: 263,
  lEyeTop: 386,
  lEyeBottom: 374,
  rIris: 468,
  lIris: 473,
} as const;

export interface HeadSample {
  /** Head turn left/right: nose offset from face centre, as a share of face width (≈ −0.5…0.5). */
  yaw: number;
  /** Head tilt up/down: nose offset from face centre, as a share of face height. */
  pitch: number;
  /** Eye direction left/right inside the eye, share of eye width (null without iris points). */
  gx: number | null;
  /** Eye direction up/down, share of eye width. */
  gy: number | null;
}

/** Head and eye direction from one set of face points; null if the points are unusable. */
export function headFromLandmarks(p: Point[]): HeadSample | null {
  const g = (i: number) => p[i];
  if (p.length < 468) return null;
  const nose = g(LM.noseTip);
  const fl = g(LM.faceLeft);
  const fr = g(LM.faceRight);
  const top = g(LM.forehead);
  const chin = g(LM.chin);
  const w = Math.abs(fr.x - fl.x);
  const h = Math.abs(chin.y - top.y);
  if (w < 20 || h < 20) return null; // face too small to judge
  const yaw = (nose.x - (fl.x + fr.x) / 2) / w;
  const pitch = (nose.y - (top.y + chin.y) / 2) / h;

  let gx: number | null = null;
  let gy: number | null = null;
  if (p.length >= 478) {
    const eye = (outer: number, inner: number, topI: number, bottom: number, iris: number) => {
      const a = g(outer);
      const b = g(inner);
      const ew = Math.hypot(b.x - a.x, b.y - a.y);
      if (ew < 5) return null;
      const ir = g(iris);
      return {
        x: (ir.x - (a.x + b.x) / 2) / ew,
        y: (ir.y - (g(topI).y + g(bottom).y) / 2) / ew,
      };
    };
    const r = eye(LM.rEyeOuter, LM.rEyeInner, LM.rEyeTop, LM.rEyeBottom, LM.rIris);
    const l = eye(LM.lEyeOuter, LM.lEyeInner, LM.lEyeTop, LM.lEyeBottom, LM.lIris);
    if (r && l) {
      gx = (r.x + l.x) / 2;
      gy = (r.y + l.y) / 2;
    }
  }
  return { yaw, pitch, gx, gy };
}

/**
 * Maps SDK timestamps (microseconds) onto this computer's clock (ms).
 * offset = smallest (arrival time − reading time) seen so far: delivery
 * delays only make it bigger, so the minimum is the best estimate.
 */
export class ClockAligner {
  private offset: number | null = null;
  observe(sdkTsUs: number, arrivalMs: number): void {
    const o = arrivalMs - sdkTsUs / 1000;
    if (this.offset === null || o < this.offset) this.offset = o;
  }
  toMs(sdkTsUs: number): number {
    return sdkTsUs / 1000 + (this.offset ?? 0);
  }
}

export interface RecallSignals {
  fromMs: number;
  toMs: number;
  durationMs: number;
  quality: {
    /** Share of the window where the SDK said the camera signal was Ok. */
    okFraction: number;
    /** Face-point readings per second (≈25 when the face is tracked). */
    faceRate: number;
    good: boolean;
  };
  /** Blink starts, ms from window start. */
  blinkOnsets: number[];
  /** Head/eye direction, ~10 per second, t in ms from window start. */
  head: ({ t: number } & HeadSample)[];
  /** Chest breathing trace, ~12 per second. */
  breath: { t: number; v: number }[];
  /** 100 − NEUTRAL expression score (0 = fully neutral face), ~10 per second. */
  expr: { t: number; v: number }[];
  /** Share of frames where the SDK detected talking. */
  talkingFraction: number;
}

interface Timed<T> {
  t: number;
  v: T;
}

const KEEP_MS = 5 * 60_000;

export class SignalBuffer {
  private clock = new ClockAligner();
  private blink: Timed<boolean>[] = [];
  private talk: Timed<boolean>[] = [];
  private breath: Timed<number>[] = [];
  private head: Timed<HeadSample>[] = [];
  private expr: Timed<number>[] = [];
  private validation: Timed<string>[] = [];

  /** Record the SDK's camera-signal status (arrival time, ms). */
  addValidation(name: string, nowMs: number): void {
    const last = this.validation[this.validation.length - 1];
    if (!last || last.v !== name) this.validation.push({ t: nowMs, v: name });
  }

  /** Camera stopped: later windows count as "no reading". */
  markStopped(nowMs: number): void {
    this.addValidation('Stopped', nowMs);
  }

  ingest(m: DecodedMetrics, nowMs: number): void {
    const all: { timestamp?: number }[] = [
      ...(m.face?.blinking ?? []),
      ...(m.face?.landmarks ?? []),
      ...(m.breathing?.upperTrace ?? []),
      ...(m.face?.expression ?? []),
    ];
    for (const r of all) if (r.timestamp) this.clock.observe(r.timestamp, nowMs);
    const t = (ts?: number) => (ts ? this.clock.toMs(ts) : nowMs);

    for (const b of m.face?.blinking ?? []) this.blink.push({ t: t(b.timestamp), v: b.detected === true });
    for (const b of m.face?.talking ?? []) this.talk.push({ t: t(b.timestamp), v: b.detected === true });
    for (const b of m.breathing?.upperTrace ?? []) {
      if (typeof b.value === 'number') this.breath.push({ t: t(b.timestamp), v: b.value });
    }
    for (const l of m.face?.landmarks ?? []) {
      const h = headFromLandmarks((l.value ?? []).map((q) => ({ x: q.x ?? 0, y: q.y ?? 0 })));
      if (h) this.head.push({ t: t(l.timestamp), v: h });
    }
    for (const e of m.face?.expression ?? []) {
      const neutral = (e.scores ?? []).find((s) => String(s.type) === 'NEUTRAL')?.confidence;
      if (typeof neutral === 'number') this.expr.push({ t: t(e.timestamp), v: Math.max(0, 100 - neutral) });
    }
    this.prune(nowMs);
  }

  private prune(nowMs: number): void {
    const cut = nowMs - KEEP_MS;
    for (const s of [this.blink, this.talk, this.breath, this.head, this.expr]) {
      let i = 0;
      while (i < s.length && s[i].t < cut) i++;
      if (i) s.splice(0, i);
    }
    // keep the last validation before the cut so state is known
    while (this.validation.length > 1 && this.validation[1].t < cut) this.validation.shift();
  }

  window(fromMs: number, toMs: number): RecallSignals {
    const durationMs = Math.max(0, toMs - fromMs);
    const inWin = <T>(s: Timed<T>[]) => s.filter((x) => x.t >= fromMs && x.t <= toMs);
    const rel = (t: number) => Math.round(t - fromMs);

    // share of time with validation Ok (sampled every 50 ms)
    let ok = 0;
    let steps = 0;
    for (let t = fromMs; t <= toMs; t += 50) {
      steps++;
      let state: string | null = null;
      for (const v of this.validation) {
        if (v.t <= t) state = v.v;
        else break;
      }
      if (state === 'Ok') ok++;
    }
    const okFraction = steps ? ok / steps : 0;

    const head = inWin(this.head);
    const faceRate = durationMs > 0 ? head.length / (durationMs / 1000) : 0;

    // blink onsets: false → true, using the state just before the window
    const before = this.blink.filter((b) => b.t < fromMs);
    let prev = before.length ? before[before.length - 1].v : false;
    const blinkOnsets: number[] = [];
    for (const b of inWin(this.blink)) {
      if (b.v && !prev) blinkOnsets.push(rel(b.t));
      prev = b.v;
    }

    const thin = <T>(s: Timed<T>[], minGapMs: number) => {
      const out: Timed<T>[] = [];
      for (const x of s) if (!out.length || x.t - out[out.length - 1].t >= minGapMs) out.push(x);
      return out;
    };
    const talk = inWin(this.talk);

    return {
      fromMs,
      toMs,
      durationMs,
      quality: {
        okFraction,
        faceRate,
        good: durationMs >= 300 && okFraction >= 0.7 && faceRate >= 8,
      },
      blinkOnsets,
      head: thin(head, 90).map((h) => ({ t: rel(h.t), ...h.v })),
      breath: thin(inWin(this.breath), 75).map((b) => ({ t: rel(b.t), v: b.v })),
      expr: thin(inWin(this.expr), 90).map((e) => ({ t: rel(e.t), v: e.v })),
      talkingFraction: talk.length ? talk.filter((x) => x.v).length / talk.length : 0,
    };
  }
}
