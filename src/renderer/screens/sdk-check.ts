// M1 SDK check screen (developer): live readings + field report controls.
import type { SdkEvent } from '../../shared/types';
import type { LiveSnapshot } from '../../core/live-metrics';
import type { Screen } from '../main';

const TEMPLATE = `<div class="layout">
      <section class="panel">
        <h2>SDK check <span class="muted">(developer)</span></h2><p class="small muted">Live readings and the field report from M1. <button id="btn-back" class="linkish">← Back to decks</button></p><h2>Setup</h2>
        <dl class="kv">
          <dt>SDK</dt><dd id="sdk-version">…</dd>
          <dt>API key</dt><dd id="key-status">…</dd>
          <dt>Camera</dt>
          <dd><select id="camera-select"><option value="">Default camera</option></select></dd>
        </dl>
        <div class="row">
          <button id="btn-start" class="btn primary" disabled>Start</button>
          <button id="btn-stop" class="btn" disabled>Stop</button>
        </div>
        <div id="setup-error" class="banner error hidden"></div>

        <h2>Status</h2>
        <dl class="kv">
          <dt>Signals asked for</dt><dd id="metric-set">—</dd>
          <dt>Processing</dt><dd id="processing">—</dd>
          <dt>Camera signal</dt><dd id="validation">—</dd>
          <dt>Updates / sec</dt><dd id="rate">—</dd>
          <dt>Messages</dt><dd id="msg-count">0</dd>
        </dl>

        <h2>Field report</h2>
        <p class="muted small">Every field the SDK sends is recorded (names, example numbers, counts — no images). Saved automatically when you press Stop.</p>
        <div class="row">
          <button id="btn-save" class="btn">Save report now</button>
          <button id="btn-folder" class="btn">Open report folder</button>
        </div>
      </section>

      <section class="tiles">
        <div class="tile">
          <div class="label">Pulse</div>
          <div class="big" id="pulse">—</div>
          <div class="sub" id="pulse-sub">bpm</div>
        </div>
        <div class="tile">
          <div class="label">Breathing rate</div>
          <div class="big" id="breath">—</div>
          <div class="sub" id="breath-sub">per minute</div>
        </div>
        <div class="tile">
          <div class="label">Blinking</div>
          <div class="big"><span id="blink-dot" class="dot"></span> <span id="blink-count">0</span></div>
          <div class="sub">blinks counted</div>
        </div>
        <div class="tile">
          <div class="label">Talking</div>
          <div class="big" id="talking">—</div>
          <div class="sub">&nbsp;</div>
        </div>
        <div class="tile wide">
          <div class="label">Breathing trace (last 20 s)</div>
          <svg id="trace" viewBox="0 0 400 80" preserveAspectRatio="none"><polyline id="trace-line" points="" /></svg>
        </div>
        <div class="tile">
          <div class="label">Expressions</div>
          <div id="expressions" class="bars"><span class="muted">no data</span></div>
        </div>
        <div class="tile">
          <div class="label">Face landmarks</div>
          <svg id="landmarks" viewBox="0 0 100 100"></svg>
          <div class="sub" id="landmark-sub">no data</div>
        </div>
        <div class="tile wide">
          <div class="label">Log</div>
          <ul id="log" class="log"></ul>
        </div>
      </section>
    </div>`;

export const sdkCheckScreen: Screen = (root, go) => {
root.innerHTML = TEMPLATE;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector('#' + id) as T;
const el = {
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
  traceLine: root.querySelector('#trace-line') as unknown as SVGPolylineElement,
  expressions: $('expressions'),
  landmarks: root.querySelector('#landmarks') as unknown as SVGSVGElement,
  landmarkSub: $('landmark-sub'),
  log: $('log'),
};

let canStart = false;
let unsubscribe: (() => void) | null = null;

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
  unsubscribe = window.sg.onEvent(onEvent);
  const st = await window.sg.cameraState();
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
  setCamera(st.on);
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
  await window.sg.stop();
}

el.start.addEventListener('click', () => void start());
el.stop.addEventListener('click', () => void stop());
el.save.addEventListener('click', async () => {
  const file = await window.sg.saveReport();
  log(file ? `Field report saved: ${file}` : 'Nothing to save yet — start the camera first.');
});
el.folder.addEventListener('click', () => void window.sg.openReportFolder());

root.querySelector('#btn-back')!.addEventListener('click', () => go('decks'));
void init();
return {
  dispose: () => unsubscribe?.(),
  onKey: (e: KeyboardEvent) => { if (e.key === 'Escape') go('decks'); },
};
};
