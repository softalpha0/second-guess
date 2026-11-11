// M1 SDK check screen: live readings + field report controls.
import type { SdkEvent, SgApi } from '../shared/types';
import type { LiveSnapshot } from '../core/live-metrics';

declare global {
  interface Window { sg: SgApi }
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const el = {
  camIndicator: $('cam-indicator'),
  stopTop: $<HTMLButtonElement>('btn-stop-top'),
  sdkVersion: $('sdk-version'),
  keyStatus: $('key-status'),
  cameraSelect: $<HTMLSelectElement>('camera-select'),
  start: $<HTMLButtonElement>('btn-start'),
  stop: $<HTMLButtonElement>('btn-stop'),
  setupError: $('setup-error'),
  metricSet: $('metric-set'),
  processing: $('processing'),
  validation: $('validation'),
  rate: $('rate'),
  msgCount: $('msg-count'),
  save: $<HTMLButtonElement>('btn-save'),
  folder: $<HTMLButtonElement>('btn-folder'),
  pulse: $('pulse'),
  pulseSub: $('pulse-sub'),
  breath: $('breath'),
  breathSub: $('breath-sub'),
  blinkDot: $('blink-dot'),
  blinkCount: $('blink-count'),
  talking: $('talking'),
  traceLine: document.getElementById('trace-line') as unknown as SVGPolylineElement,
  expressions: $('expressions'),
  landmarks: document.getElementById('landmarks') as unknown as SVGSVGElement,
  landmarkSub: $('landmark-sub'),
  log: $('log'),
};

let canStart = false;

function log(text: string, kind: 'info' | 'error' = 'info'): void {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
  if (kind === 'error') li.className = 'error';
  el.log.prepend(li);
  while (el.log.children.length > 200) el.log.lastElementChild?.remove();
}

function showSetupError(text: string | null): void {
  el.setupError.textContent = text ?? '';
  el.setupError.classList.toggle('hidden', !text);
}

function setCamera(on: boolean): void {
  el.camIndicator.textContent = on ? '● Camera on' : '● Camera off';
  el.camIndicator.className = `cam-indicator ${on ? 'on' : 'off'}`;
  el.stopTop.disabled = !on;
  el.stop.disabled = !on;
  el.start.disabled = on || !canStart;
  el.cameraSelect.disabled = on;
}

function fmtReading(r: { value: number; confidence?: number; stable?: boolean } | null, digits = 0): [string, string] {
  if (!r) return ['—', ''];
  const parts: string[] = [];
  if (r.confidence !== undefined) parts.push(`confidence ${r.confidence.toFixed(0)}`);
  if (r.stable !== undefined) parts.push(r.stable ? 'stable' : 'settling');
  return [r.value.toFixed(digits), parts.join(' · ')];
}

function renderLive(s: LiveSnapshot, perSec: number): void {
  el.rate.textContent = perSec.toFixed(1);
  el.msgCount.textContent = String(s.messages);

  const [p, pSub] = fmtReading(s.pulse);
  el.pulse.textContent = p;
  el.pulseSub.textContent = pSub ? `bpm · ${pSub}` : 'bpm';
  const [b, bSub] = fmtReading(s.breathingRate, 1);
  el.breath.textContent = b;
  el.breathSub.textContent = bSub ? `per minute · ${bSub}` : 'per minute';

  el.blinkDot.classList.toggle('on', s.blinking === true);
  el.blinkCount.textContent = String(s.blinkCount);
  el.talking.textContent = s.talking === null ? '—' : s.talking ? 'yes' : 'no';

  // breathing trace sparkline
  const tr = s.breathTrace;
  if (tr.length > 1) {
    const t0 = tr[0].t;
    const t1 = tr[tr.length - 1].t || t0 + 1;
    let lo = Infinity;
    let hi = -Infinity;
    for (const pt of tr) { lo = Math.min(lo, pt.v); hi = Math.max(hi, pt.v); }
    const span = hi - lo || 1;
    el.traceLine.setAttribute(
      'points',
      tr.map((pt) => `${(((pt.t - t0) / (t1 - t0 || 1)) * 400).toFixed(1)},${(76 - ((pt.v - lo) / span) * 72).toFixed(1)}`).join(' '),
    );
  }

  // expressions
  if (s.expressions && s.expressions.length) {
    el.expressions.replaceChildren(
      ...s.expressions.slice(0, 6).map((e) => {
        const row = document.createElement('div');
        row.className = 'bar';
        const name = document.createElement('span');
        name.textContent = e.name.toLowerCase();
        const track = document.createElement('div');
        track.className = 'track';
        const fill = document.createElement('div');
        fill.className = 'fill';
        // SDK scores are 0–100 on this PC (seen in M1); handle 0–1 too
        const pct = e.score > 1 ? e.score : e.score * 100;
        fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
        track.append(fill);
        const val = document.createElement('span');
        val.textContent = e.score.toFixed(1);
        row.append(name, track, val);
        return row;
      }),
    );
  }

  // landmarks: draw the points, scaled to fit
  if (s.landmarks && s.landmarks.points.length) {
    const pts = s.landmarks.points;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const q of pts) { minX = Math.min(minX, q.x); minY = Math.min(minY, q.y); maxX = Math.max(maxX, q.x); maxY = Math.max(maxY, q.y); }
    const scale = 90 / Math.max(maxX - minX || 1, maxY - minY || 1);
    const ns = 'http://www.w3.org/2000/svg';
    el.landmarks.replaceChildren(
      ...pts.map((q) => {
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', (5 + (q.x - minX) * scale).toFixed(1));
        c.setAttribute('cy', (5 + (q.y - minY) * scale).toFixed(1));
        c.setAttribute('r', '0.8');
        return c;
      }),
    );
    el.landmarkSub.textContent = `${s.landmarks.count} points · ${s.landmarks.stable ? 'stable' : 'settling'} · x ${minX.toFixed(2)}–${maxX.toFixed(2)}`;
  }
}

function onEvent(e: SdkEvent): void {
  switch (e.type) {
    case 'processing':
      el.processing.textContent = e.name;
      log(`Processing: ${e.name}`);
      break;
    case 'validation': {
      el.validation.textContent = e.hint ? `${e.name} — ${e.hint}` : e.name;
      el.validation.className = e.name === 'Ok' ? 'good' : 'warn';
      break;
    }
    case 'live':
      renderLive(e.snapshot, e.messagesPerSec);
      break;
    case 'error':
      log(`Error ${e.name} (${e.code}): ${e.message}${e.retryable ? ' [retryable]' : ''}`, 'error');
      break;
    case 'metrics-set':
      el.metricSet.textContent = e.label;
      log(`Asking SDK for: ${e.metrics.join(', ')}`);
      break;
    case 'camera':
      setCamera(e.on);
      break;
    case 'log':
      log(e.text);
      break;
  }
}

async function init(): Promise<void> {
  window.sg.onEvent(onEvent);
  const info = await window.sg.info();

  el.sdkVersion.textContent = info.sdkVersion ? `v${info.sdkVersion}` : 'not loaded';
  el.keyStatus.textContent = info.hasKey ? 'found in .env' : 'missing';
  el.keyStatus.className = info.hasKey ? 'good' : 'bad';

  for (const c of info.cameras) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name ?? c.id;
    el.cameraSelect.append(opt);
  }
  log(`Cameras found: ${info.cameras.length}${info.cameraError ? ` (camera list error: ${info.cameraError})` : ''}`);
  log(`Reports folder: ${info.reportDir}`);

  if (info.loadError) {
    showSetupError(`The SDK could not load on this PC: ${info.loadError}`);
  } else if (!info.hasKey) {
    showSetupError('No API key found. Copy .env.example to .env, paste your SMARTSPECTRA_API_KEY, then restart the app.');
  }
  canStart = !info.loadError && info.hasKey;
  setCamera(false);
}

async function start(): Promise<void> {
  showSetupError(null);
  el.start.disabled = true;
  const res = await window.sg.start(el.cameraSelect.value || null);
  if (!res.ok) {
    showSetupError(res.error ?? 'Could not start.');
    log(res.error ?? 'Could not start.', 'error');
    setCamera(false);
  }
}

async function stop(): Promise<void> {
  el.stop.disabled = true;
  el.stopTop.disabled = true;
  await window.sg.stop();
}

el.start.addEventListener('click', () => void start());
el.stop.addEventListener('click', () => void stop());
el.stopTop.addEventListener('click', () => void stop());
el.save.addEventListener('click', async () => {
  const file = await window.sg.saveReport();
  log(file ? `Field report saved: ${file}` : 'Nothing to save yet — start the camera first.');
});
el.folder.addEventListener('click', () => void window.sg.openReportFolder());

void init();
