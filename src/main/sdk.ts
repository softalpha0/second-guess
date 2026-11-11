// SmartSpectra SDK session, run in the background (main) process.
//
// - Starts the native camera through the SDK (1280x720, 30 fps, telemetry off).
// - Asks for every signal Second Guess might use. If the API key isn't allowed
//   one of them, falls back step by step to a smaller set and says which one.
// - Decodes each metrics message, feeds the live tracker and the field recorder.
// - Never touches video frames: we don't subscribe to 'videoOutput' at all.
//
// No Electron imports here, so the same code runs in the headless probe.

import type { SdkEvent, SdkInfo, CameraEntry } from '../shared/types';
import { LiveTracker, type DecodedMetrics } from '../core/live-metrics';
import { createSchema, recordMessage, schemaToList, truncateArrays, type FieldSchema } from '../core/field-schema';

type SdkModule = typeof import('@smartspectra/node-sdk');
type SdkInstance = InstanceType<SdkModule['SmartSpectraSDK']>;

// Metric sets, richest first. Names are SDK MetricType keys.
const METRIC_SETS: { label: string; metrics: string[] }[] = [
  {
    label: 'full (breathing + pulse + face + expressions)',
    metrics: ['CHEST_BREATHING', 'BREATHING_RATE', 'PULSE_RATE', 'FACE_LANDMARKS', 'BLINKING', 'TALKING', 'EXPRESSIONS'],
  },
  {
    label: 'no expressions',
    metrics: ['CHEST_BREATHING', 'BREATHING_RATE', 'PULSE_RATE', 'FACE_LANDMARKS', 'BLINKING', 'TALKING'],
  },
  { label: 'no landmarks', metrics: ['CHEST_BREATHING', 'BREATHING_RATE', 'PULSE_RATE', 'BLINKING', 'TALKING'] },
  { label: 'breathing + pulse + blinking', metrics: ['CHEST_BREATHING', 'BREATHING_RATE', 'PULSE_RATE', 'BLINKING'] },
  { label: 'breathing + pulse', metrics: ['CHEST_BREATHING', 'BREATHING_RATE', 'PULSE_RATE'] },
  { label: 'breathing only', metrics: ['CHEST_BREATHING', 'ABDOMEN_BREATHING', 'BREATHING_RATE'] },
];

const ERR_METRIC_NOT_AUTHORIZED = 13;
const ERR_CONFIGURATION_FAILED = 3;
const MAX_SAMPLES = 12;

function nameOf(table: Record<string, number>, value: number): string {
  const hit = Object.entries(table).find(([, v]) => v === value);
  return hit ? hit[0].replace(/^k/, '') : `#${value}`;
}

export interface FieldReport {
  createdAt: string;
  sdkVersion: string | null;
  platform: string;
  metricSet: string | null;
  requestedMetrics: string[];
  durationSec: number;
  messageCount: number;
  messagesPerSec: number;
  validationCodesSeen: Record<string, number>;
  processingStatusesSeen: string[];
  errorsSeen: { code: string; message: string }[];
  fields: ReturnType<typeof schemaToList>;
  /** A few decoded messages with long arrays cut short. Numbers only — no images. */
  samples: unknown[];
}

export class SdkSession {
  private mod: SdkModule | null = null;
  private Metrics: { decode(b: Uint8Array): unknown; toObject(m: unknown, o: object): unknown } | null = null;
  private loadError: string | null = null;
  private sdk: SdkInstance | null = null;
  private setIndex = 0;
  private cameraId: string | null = null;
  private tracker = new LiveTracker();
  private schema: FieldSchema = createSchema();
  private samples: unknown[] = [];
  private startedAt = 0;
  private messageCount = 0;
  private rateWindow: number[] = [];
  private validationSeen: Record<string, number> = {};
  private statusesSeen: string[] = [];
  private errorsSeen: { code: string; message: string }[] = [];
  private lastSampleAt = 0;
  private running = false;
  private switching = false;

  constructor(
    private apiKey: string | undefined,
    private emit: (e: SdkEvent) => void,
  ) {}

  /** Load the SDK lazily so a broken native runtime doesn't crash the app. */
  private load(): SdkModule | null {
    if (this.mod || this.loadError) return this.mod;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.mod = require('@smartspectra/node-sdk') as SdkModule;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.Metrics = require('@smartspectra/node-sdk/messages').Metrics;
    } catch (err) {
      this.loadError = err instanceof Error ? err.message : String(err);
    }
    return this.mod;
  }

  info(reportDir: string): SdkInfo {
    const mod = this.load();
    let cameras: CameraEntry[] = [];
    let cameraError: string | null = null;
    if (mod) {
      try {
        cameras = mod.SmartSpectraSDK.availableCameras().map((c) => ({ id: c.id, name: c.name }));
      } catch (err) {
        cameraError = err instanceof Error ? err.message : String(err);
      }
    }
    return {
      hasKey: !!this.apiKey,
      sdkVersion: mod ? mod.SmartSpectraSDK.version : null,
      loadError: this.loadError,
      cameras,
      cameraError,
      reportDir,
    };
  }

  get isRunning(): boolean {
    return this.running;
  }

  async start(cameraId: string | null): Promise<{ ok: boolean; error?: string }> {
    const mod = this.load();
    if (!mod) return { ok: false, error: `SDK could not load: ${this.loadError}` };
    if (!this.apiKey) return { ok: false, error: 'No API key. Add SMARTSPECTRA_API_KEY to the .env file.' };
    if (this.running) return { ok: true };
    this.cameraId = cameraId;
    this.setIndex = 0;
    this.resetStats();
    return this.startWithCurrentSet();
  }

  private resetStats(): void {
    this.tracker = new LiveTracker();
    this.schema = createSchema();
    this.samples = [];
    this.startedAt = Date.now();
    this.messageCount = 0;
    this.rateWindow = [];
    this.validationSeen = {};
    this.statusesSeen = [];
    this.errorsSeen = [];
    this.lastSampleAt = 0;
  }

  private async startWithCurrentSet(): Promise<{ ok: boolean; error?: string }> {
    const mod = this.mod!;
    const set = METRIC_SETS[this.setIndex];
    const codes = set.metrics.map((n) => (mod.MetricType as Record<string, number>)[n]);
    this.emit({ type: 'metrics-set', label: set.label, metrics: set.metrics });

    const sdk = new mod.SmartSpectraSDK({
      apiKey: this.apiKey,
      requestedMetrics: codes,
      enableTelemetry: false,
      enableAccumulatedOutput: false,
    });
    this.sdk = sdk;

    sdk.on('processingStatus', (status) => {
      const name = nameOf(mod.ProcessingStatus, status);
      if (!this.statusesSeen.includes(name)) this.statusesSeen.push(name);
      this.emit({ type: 'processing', status, name });
      // A failure after start (e.g. key rejected): release the camera, unless
      // we're about to retry with a smaller metric set.
      if (status === mod.ProcessingStatus.kError) {
        setTimeout(() => {
          if (!this.switching && this.sdk === sdk) void this.teardown();
        }, 500);
      }
    });
    sdk.on('validationStatus', (code, _ts, hint) => {
      const name = nameOf(mod.ValidationCode, code);
      this.validationSeen[name] = (this.validationSeen[name] ?? 0) + 1;
      this.emit({ type: 'validation', code, name, hint });
    });
    sdk.on('metrics', (buf) => this.onMetrics(buf));
    sdk.on('error', (code, message, retryable) => {
      const name = nameOf(mod.SmartSpectraErrorCode, code);
      this.errorsSeen.push({ code: name, message });
      this.emit({ type: 'error', code, name, message, retryable });
      if (code === ERR_METRIC_NOT_AUTHORIZED) void this.fallBack(`${name}: ${message}`);
    });

    const selection = this.cameraId ? mod.CameraSelection.byId(this.cameraId) : mod.CameraSelection.default;
    try {
      sdk.useCamera(selection, { width: 1280, height: 720, fps: 30 });
      sdk.start();
      this.running = true;
      this.emit({ type: 'camera', on: true });
      return { ok: true };
    } catch (err) {
      const e = err as { code?: number; message?: string };
      const name = nameOf(mod.SmartSpectraErrorCode, e.code ?? -1);
      this.errorsSeen.push({ code: name, message: e.message ?? String(err) });
      if (e.code === ERR_METRIC_NOT_AUTHORIZED || e.code === ERR_CONFIGURATION_FAILED) {
        return this.fallBack(`${name}: ${e.message}`);
      }
      await this.teardown();
      return { ok: false, error: `${name}: ${e.message ?? String(err)}` };
    }
  }

  /** The key isn't allowed some metric: retry with the next smaller set. */
  private async fallBack(reason: string): Promise<{ ok: boolean; error?: string }> {
    if (this.switching) return { ok: true };
    this.switching = true;
    try {
      await this.teardown();
      if (this.setIndex >= METRIC_SETS.length - 1) {
        return { ok: false, error: `No metric set was accepted. Last error: ${reason}` };
      }
      this.setIndex += 1;
      this.emit({ type: 'log', text: `Not allowed (${reason}). Trying smaller set: ${METRIC_SETS[this.setIndex].label}` });
      return await this.startWithCurrentSet();
    } finally {
      this.switching = false;
    }
  }

  private onMetrics(buf: Buffer | Uint8Array): void {
    if (!this.Metrics) return;
    let obj: DecodedMetrics;
    try {
      const msg = this.Metrics.decode(buf);
      obj = this.Metrics.toObject(msg, { longs: Number, enums: String, defaults: false }) as DecodedMetrics;
    } catch (err) {
      this.emit({ type: 'log', text: `Could not decode a metrics message: ${String(err)}` });
      return;
    }
    const now = Date.now();
    this.messageCount += 1;
    this.rateWindow.push(now);
    while (this.rateWindow.length && this.rateWindow[0] < now - 5000) this.rateWindow.shift();

    recordMessage(this.schema, obj);
    // keep the first few messages, then one every 10 s
    if (this.samples.length < 3 || (this.samples.length < MAX_SAMPLES && now - this.lastSampleAt > 10_000)) {
      this.samples.push({ atSec: (now - this.startedAt) / 1000, message: truncateArrays(obj, 3) });
      this.lastSampleAt = now;
    }

    const snapshot = this.tracker.ingest(obj);
    this.emit({ type: 'live', snapshot, messagesPerSec: this.rateWindow.length / 5 });
  }

  report(): FieldReport {
    const durationSec = this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0;
    const set = this.mod ? METRIC_SETS[this.setIndex] : null;
    return {
      createdAt: new Date().toISOString(),
      sdkVersion: this.mod ? this.mod.SmartSpectraSDK.version : null,
      platform: `${process.platform}-${process.arch}`,
      metricSet: set?.label ?? null,
      requestedMetrics: set?.metrics ?? [],
      durationSec,
      messageCount: this.messageCount,
      messagesPerSec: durationSec > 0 ? this.messageCount / durationSec : 0,
      validationCodesSeen: this.validationSeen,
      processingStatusesSeen: this.statusesSeen,
      errorsSeen: this.errorsSeen,
      fields: schemaToList(this.schema),
      samples: this.samples,
    };
  }

  private async teardown(): Promise<void> {
    const sdk = this.sdk;
    this.sdk = null;
    if (this.running) this.emit({ type: 'camera', on: false });
    this.running = false;
    if (!sdk) return;
    try {
      await sdk.stopAsync();
    } catch {
      /* already stopped */
    }
    try {
      await sdk.destroy();
    } catch {
      /* already destroyed */
    }
  }

  async stop(): Promise<void> {
    await this.teardown();
  }
}
