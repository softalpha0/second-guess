// S4: Settings — threshold, which signals are used, camera, Check mode,
// and Delete all data.
import type { Screen } from '../main';
import type { Settings } from '../../shared/types';
import { h, kbd } from '../ui';
import { applyTheme, session, setBanner } from '../app';
import { DEFAULT_THRESHOLD, DEFAULT_WEIGHTS, type SignalKey } from '../../core/hesitation';
import { agreement, agreementText } from '../../core/check-mode';

const SIGNALS: { key: SignalKey; label: string; note: string }[] = [
  { key: 'recall', label: 'Long pause', note: 'Time before you reveal the answer, compared with your warm-up pace.' },
  { key: 'lookAway', label: 'Looking away', note: 'Head or eyes turned away from your usual direction for more than about a second.' },
  { key: 'breath', label: 'Holding breath', note: 'Breathing movement goes nearly flat while you think.' },
  { key: 'blink', label: 'Blinking', note: 'A burst of blinks, or none when some were expected.' },
  { key: 'expression', label: 'Expression change', note: 'Your face moves away from its resting look.' },
  { key: 'pulse', label: 'Pulse', note: 'Off: on this setup it updates only about twice a minute, too rarely for one card.' },
];

function thresholdWords(t: number): string {
  if (t <= 35) return 'Strict — flags even small hesitations (more cards come back tomorrow).';
  if (t >= 65) return 'Relaxed — flags only clear hesitations.';
  return 'Balanced (default).';
}

export const settingsScreen: Screen = async (root, go) => {
  const [settings, info, reviews] = await Promise.all([window.sg.getSettings(), window.sg.info(), window.sg.getReviews()]);
  let s: Settings = settings;
  const save = async (patch: Partial<Settings>) => {
    s = await window.sg.updateSettings(patch);
  };

  // threshold
  const tVal = h('strong', {}, String(s.threshold));
  const tWords = h('div.small.muted', {}, thresholdWords(s.threshold));
  const slider = h('input', { type: 'range', min: 20, max: 80, step: 5, value: s.threshold }) as HTMLInputElement;
  slider.addEventListener('input', () => {
    tVal.textContent = slider.value;
    tWords.textContent = thresholdWords(Number(slider.value));
  });
  slider.addEventListener('change', () => void save({ threshold: Number(slider.value) }));

  // signals
  const signalRows = SIGNALS.map((sig) => {
    const box = h('input', { type: 'checkbox', id: `sig-${sig.key}` }) as HTMLInputElement;
    box.checked = s.signals[sig.key];
    if (sig.key === 'pulse') box.disabled = true;
    box.addEventListener('change', () => void save({ signals: { ...s.signals, [sig.key]: box.checked } }));
    return h('label.setting-row', { for: `sig-${sig.key}` }, box,
      h('span', {}, h('strong', {}, sig.label), h('span.muted.small', {}, `  weight ${DEFAULT_WEIGHTS[sig.key]}`), h('br'), h('span.small.muted', {}, sig.note)));
  });

  // camera
  const camSelect = h('select', {}, h('option', { value: '' }, 'Default camera')) as HTMLSelectElement;
  for (const c of info.cameras) camSelect.append(h('option', { value: c.id }, c.name ?? c.id));
  camSelect.value = info.cameras.some((c) => c.id === s.cameraId) ? s.cameraId ?? '' : '';
  camSelect.addEventListener('change', () => void save({ cameraId: camSelect.value || null }));

  // check mode
  const check = h('input', { type: 'checkbox', id: 'check-mode' }) as HTMLInputElement;
  check.checked = s.checkMode;
  check.addEventListener('change', () => void save({ checkMode: check.checked }));
  const checked = reviews.filter((r) => r.checkMode && r.selfGuess !== undefined && (r.verdict === 'sure' || r.verdict === 'hesitated'));
  const agree = agreement(checked.map((r) => ({ appHesitated: r.verdict === 'hesitated', selfGuess: !!r.selfGuess })));

  function themeSelect(): HTMLElement {
    const sel = h('select', {},
      h('option', { value: 'system' }, 'Same as Windows'),
      h('option', { value: 'dark' }, 'Dark'),
      h('option', { value: 'light' }, 'Light')) as HTMLSelectElement;
    sel.value = s.theme;
    sel.addEventListener('change', () => {
      const theme = sel.value as Settings['theme'];
      applyTheme(theme);
      void save({ theme });
    });
    return h('label.small', {}, sel);
  }

  async function deleteAll(): Promise<void> {
    if (!confirm('Delete all Second Guess data on this computer?\n\nThis removes your study history, schedule, imported decks, settings and logs. It cannot be undone.')) return;
    await window.sg.deleteAllData();
    session.baseline = null;
    session.lastSummary = null;
    session.lastReplays = [];
    session.lastAgreement = null;
    session.noCamera = false;
    setBanner(null);
    go('decks');
    setTimeout(() => setBanner('All data deleted.'), 50);
    setTimeout(() => setBanner(null), 4000);
  }

  root.append(
    h('section.page.narrow', {},
      h('h1', {}, 'Settings'),

      h('h2', {}, 'Hesitation threshold'),
      h('div.row', {}, slider, tVal),
      tWords,
      h('button.linkish.small.muted', { onclick: () => { slider.value = String(DEFAULT_THRESHOLD); slider.dispatchEvent(new Event('input')); void save({ threshold: DEFAULT_THRESHOLD }); } }, 'Reset to 50'),

      h('h2', {}, 'Signals used'),
      h('div.setting-list', {}, ...signalRows),

      h('h2', {}, 'Camera'),
      h('label.small', {}, camSelect),

      h('h2', {}, 'Check mode'),
      h('label.setting-row', { for: 'check-mode' }, check,
        h('span', {}, h('strong', {}, 'Ask me "Was that a guess?" after each right answer'), h('br'),
          h('span.small.muted', {}, 'Second Guess hides its own verdict and later shows how often it agreed with you. Your answer decides the schedule.'))),
      h('p.small', {}, agreementText(agree),
        agree.total ? h('span.muted', {}, `  (caught ${agree.caught} of ${agree.caught + agree.missed} guesses · ${agree.falseAlarms} false alarm${agree.falseAlarms === 1 ? '' : 's'})`) : null),

      h('h2', {}, 'Theme'),
      themeSelect(),

      h('h2', {}, 'Your data'),
      h('p.small.muted', {}, 'Everything is stored only on this computer. No video, frames or images are ever stored.'),
      h('button.btn.danger', { onclick: () => void deleteAll() }, 'Delete all data'),

      h('div.row', {}, h('button.btn', { onclick: () => go('decks') }, 'Back')),
      h('p.keys', {}, kbd('Esc'), ' back'),
    ),
  );

  return { onKey: (e) => e.key === 'Escape' && go('decks') };
};
