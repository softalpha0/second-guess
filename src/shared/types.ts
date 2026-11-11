// Messages shared between the background (main) process and the window.
import type { LiveSnapshot } from '../core/live-metrics';

export type SdkEvent =
  | { type: 'processing'; status: number; name: string }
  | { type: 'validation'; code: number; name: string; hint: string }
  | { type: 'live'; snapshot: LiveSnapshot; messagesPerSec: number }
  | { type: 'error'; code: number; name: string; message: string; retryable: boolean }
  | { type: 'metrics-set'; label: string; metrics: string[] }
  | { type: 'camera'; on: boolean }
  | { type: 'log'; text: string };

export interface CameraEntry {
  id: string;
  name: string | null;
}

export interface SdkInfo {
  hasKey: boolean;
  sdkVersion: string | null;
  /** Set when the SDK's native runtime could not load on this PC. */
  loadError: string | null;
  cameras: CameraEntry[];
  cameraError: string | null;
  reportDir: string;
}

/** What the window can call (exposed by the preload script as window.sg). */
export interface SgApi {
  info(): Promise<SdkInfo>;
  start(cameraId: string | null): Promise<{ ok: boolean; error?: string }>;
  stop(): Promise<void>;
  saveReport(): Promise<string | null>;
  openReportFolder(): Promise<void>;
  onEvent(cb: (e: SdkEvent) => void): () => void;
}
