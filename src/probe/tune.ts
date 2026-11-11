// `npm run tune` — reads reviews.json and prints how well Second Guess agreed
// with your honest Check-mode answers, per threshold and per signal.
// Usage: npm run tune            (reads the app's data folder)
//        npm run tune -- path/to/reviews.json
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { tune, type TuneReview } from '../core/tuning';

function defaultPath(): string {
  if (process.platform === 'win32') return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'second-guess', 'reviews.json');
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'second-guess', 'reviews.json');
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'second-guess', 'reviews.json');
}

const file = process.argv[2] ?? defaultPath();
if (!existsSync(file)) {
  console.log(`No reviews found at ${file}. Study with Check mode on first.`);
  process.exit(1);
}
const reviews = JSON.parse(readFileSync(file, 'utf8')) as TuneReview[];
const r = tune(reviews);
const pct = (n: number | null) => (n === null ? '—' : `${n}%`);

console.log(`\nCheck-mode right answers that were judged: ${r.usable}  (you said: ${r.guesses} guesses, ${r.known} knew it)`);
if (r.usable === 0) {
  console.log('Nothing to tune yet. Turn on Settings → Check mode and study.');
  process.exit(0);
}
if (r.usable < 60) console.log(`Note: ${r.usable} is a small sample — aim for 100+ before trusting the numbers.`);
console.log(`\nAgreement with the settings you studied with: ${pct(r.current.percent)}`);
console.log(`  caught ${r.current.caught} of ${r.current.caught + r.current.missed} guesses · ${r.current.falseAlarms} false alarms\n`);

console.log('Threshold  Agreement  Caught guesses  False alarms');
for (const t of r.thresholds) {
  const mark = r.best && t.threshold === r.best.threshold ? '  ← best' : '';
  console.log(
    `${String(t.threshold).padStart(9)}  ${pct(t.percent).padStart(9)}  ${`${t.caught}/${t.caught + t.missed}`.padStart(14)}  ${String(t.falseAlarms).padStart(12)}${mark}`,
  );
}
console.log('\nSignals (average points on guesses vs known answers; bigger gap = more useful):');
for (const s of r.signals) {
  console.log(`  ${s.signal.padEnd(11)} guesses ${String(s.avgOnGuesses).padStart(5)}   known ${String(s.avgOnKnown).padStart(5)}   gap ${String(s.separation).padStart(5)}`);
}
console.log('\nSet the threshold in Settings. For the DEV post, report the agreement honestly (and on fresh cards after tuning).\n');
