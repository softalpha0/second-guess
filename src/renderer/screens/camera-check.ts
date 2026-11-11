// M2: camera check. Turns the SDK's camera-signal status into plain hints and
// enables "Start warm-up" only after the signal has been good for 2 seconds.
// The "mirror" shows where your face points are in the picture — not video.
import type { Screen } from '../main';
import type { SdkEvent } from '../../shared/types';
import { h, kbd } from '../ui';
import { camera, session } from '../app';
import { cameraHint, ReadyGate } from '../../core/camera-hints';

const FRAME_W = 1280;
const FRAME_H = 720;

export const cameraCheckScreen: Screen = async (root, go, params) => {
  const [info, settings] = await Promise.all([window.sg.info(), window.sg.getSettings()]);
  const gate = new ReadyGate(2000);
  let validation: string | null = camera.state.validation;
  let starting = false;
  let problem: string | null = null;

  const hint = h('div.hint-big', {}, 'Starting camera…');
  const status = h('div.small.muted');
  const bar = h('div.ready-fill');
  const startBtn = h('button.btn.primary', { disabled: true }, 'Start warm-up') as HTMLButtonElement;
  const problemBox = h('div.notice.error');
  problemBox.hidden = true;

  const ns = 'http://www.w3.org/2000/svg';
  const mirror = document.createElementNS(ns, 'svg');
  mirror.setAttribute('viewBox', `0 0 ${FRAME_W} ${FRAME_H}`);
  mirror.setAttribute('class', 'mirror');
  const target = document.createElementNS(ns, 'rect');
  target.setAttribute('x', String(FRAME_W * 0.33));
  target.setAttribute('y', String(FRAME_H * 0.18));
  target.setAttribute('width', String(FRAME_W * 0.34));
  target.setAttribute('height', String(FRAME_H * 0.6));
  target.setAttribute('rx', '40');
  target.setAttribute('class', 'mirror-target');
  const dots = document.createElementNS(ns, 'g');
  mirror.append(target, dots);

  const select = h('select', {}, h('option', { value: '' }, 'Default camera')) as HTMLSelectElement;
  for (const c of info.cameras) select.append(h('option', { value: c.id }, c.name ?? c.id));
  select.value = info.cameras.some((c) => c.id === settings.cameraId) ? settings.cameraId ?? '' : '';
  select.addEventListener('change', async () => {
    await window.sg.updateSettings({ cameraId: select.value || null });
    await window.sg.stop('internal');
    void startCamera();
  });

  function showProblem(text: string | null): void {
    problem = text;
    problemBox.hidden = !text;
    problemBox.textContent = text ?? '';
    refresh();
  }

  async function startCamera(): Promise<void> {
    if (camera.state.on || starting) return;
    if (info.loadError) return showProblem(`The camera SDK could not load on this computer: ${info.loadError}`);
    if (!info.hasKey) return showProblem('No Presage API key found (SMARTSPECTRA_API_KEY in the .env file). You can still study without the camera.');
    starting = true;
    showProblem(null);
    const r = await window.sg.start(select.value || null);
    starting = false;
    if (!r.ok) showProblem(`The camera could not start: ${r.error ?? 'unknown error'}`);
    refresh();
  }

  function refresh(): void {
    const now = Date.now();
    const ready = camera.state.on && gate.isReady(now);
    startBtn.disabled = !ready;
    bar.style.width = `${(camera.state.on ? gate.progress(now) : 0) * 100}%`;
    if (problem) hint.textContent = 'The camera isn’t available.';
    else if (!camera.state.on) hint.textContent = starting ? 'Starting camera…' : 'Camera is off.';
    else if (!validation) hint.textContent = camera.state.processing === 'Running' ? 'Looking for your face…' : 'Starting camera… (this can take a few seconds)';
    else hint.textContent = ready ? 'All set. Press Enter to start the warm-up.' : cameraHint(validation);
    hint.className = `hint-big ${ready ? 'good' : validation && validation !== 'Ok' ? 'warn' : ''}`;
    status.textContent = camera.state.on
      ? `Camera signal: ${validation ?? '—'} · ${camera.state.processing ?? ''}`
      : '';
  }

  let lastDraw = 0;
  const off = window.sg.onEvent((e: SdkEvent) => {
    if (e.type === 'validation') {
      validation = e.name;
      gate.update(e.name, Date.now());
    } else if (e.type === 'error') {
      if (!camera.state.on) showProblem(`${e.name}: ${e.message}`);
    } else if (e.type === 'camera' && !e.on) {
      validation = null;
      gate.update('Off', Date.now());
    } else if (e.type === 'live') {
      const now = Date.now();
      if (now - lastDraw < 100 || !e.snapshot.landmarks) return;
      lastDraw = now;
      const pts = e.snapshot.landmarks.points;
      dots.replaceChildren(
        ...pts.filter((_, i) => i % 3 === 0).map((p) => {
          const c = document.createElementNS(ns, 'circle');
          c.setAttribute('cx', String(p.x));
          c.setAttribute('cy', String(p.y));
          c.setAttribute('r', '3');
          return c;
        }),
      );
    }
    refresh();
  });
  const tick = setInterval(refresh, 150);

  function begin(): void {
    if (startBtn.disabled) return;
    go('warmup', params);
  }
  function withoutCamera(): void {
    session.noCamera = true;
    void window.sg.stop('internal');
    go('study', params);
  }
  startBtn.addEventListener('click', begin);

  root.append(
    h('section.page.narrow', {},
      h('h1', {}, 'Camera check'),
      h('p.muted', {}, 'Sit about an arm’s length away with your face and shoulders in view, and light on your face.'),
      h('div.check-grid', {},
        h('div.mirror-box', {}, mirror, h('div.small.muted', {}, 'Your face points (not video). Aim for the box.')),
        h('div', {},
          hint,
          h('div.ready-track', {}, bar),
          status,
          problemBox,
          h('label.small.muted', {}, 'Camera ', select),
        ),
      ),
      h('div.row', {},
        startBtn,
        h('button.btn', { onclick: withoutCamera }, 'Study without camera'),
        h('button.btn.ghost', { onclick: () => go('decks') }, 'Back'),
      ),
      h('p.keys', {}, kbd('Enter'), ' start warm-up   ', kbd('Esc'), ' back'),
    ),
  );
  refresh();
  void startCamera();

  return {
    onKey(e) {
      if (e.key === 'Enter') begin();
      else if (e.key === 'Escape') go('decks');
    },
    dispose() {
      off();
      clearInterval(tick);
    },
  };
};
