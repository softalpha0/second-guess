// Headless SDK probe: `npm run probe` (optionally `npm run probe -- 60` for 60 s).
// Runs the same SDK session as the app, without any window, prints live
// readings and writes a field report to ./sdk-reports. Useful to tell apart
// "the SDK doesn't work on this PC" from "the app window has a problem".
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { SdkSession } from '../main/sdk';
import { writeReport } from '../main/report';

loadEnv({ path: join(process.cwd(), '.env'), quiet: true });

const seconds = Number(process.argv[2] ?? 45) || 45;
let lastLine = '';

const session = new SdkSession(process.env.SMARTSPECTRA_API_KEY?.trim() || undefined, (e) => {
  switch (e.type) {
    case 'processing': console.log(`[status] ${e.name}`); break;
    case 'validation': {
      const line = `[camera signal] ${e.name}${e.hint ? ` — ${e.hint}` : ''}`;
      if (line !== lastLine) console.log(line);
      lastLine = line;
      break;
    }
    case 'error': console.log(`[error] ${e.name} (${e.code}): ${e.message}`); break;
    case 'metrics-set': console.log(`[asking for] ${e.metrics.join(', ')}`); break;
    case 'log': console.log(`[info] ${e.text}`); break;
    case 'camera': console.log(`[camera] ${e.on ? 'on' : 'off'}`); break;
    case 'live': {
      const s = e.snapshot;
      if (s.messages % 15 === 0) {
        console.log(
          `[live] pulse ${s.pulse?.value.toFixed(0) ?? '—'} · breathing ${s.breathingRate?.value.toFixed(1) ?? '—'} · ` +
            `blinks ${s.blinkCount} · landmarks ${s.landmarks?.count ?? '—'} · top expression ${s.expressions?.[0]?.name ?? '—'} · ` +
            `${e.messagesPerSec.toFixed(1)} msg/s`,
        );
      }
      break;
    }
  }
});

async function main(): Promise<void> {
  const info = session.info(join(process.cwd(), 'sdk-reports'));
  console.log(`SDK: ${info.sdkVersion ?? 'NOT LOADED'}${info.loadError ? ` — ${info.loadError}` : ''}`);
  console.log(`API key: ${info.hasKey ? 'found' : 'MISSING'}`);
  console.log(`Cameras: ${info.cameras.map((c) => `${c.name ?? '?'} [${c.id}]`).join(', ') || 'none'}${info.cameraError ? ` (error: ${info.cameraError})` : ''}`);
  const res = await session.start(process.env.SG_CAMERA_ID ?? null);
  if (!res.ok) {
    console.log(`Could not start: ${res.error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Measuring for ${seconds} s. Sit in front of the camera, face and shoulders visible…`);
  await new Promise((r) => setTimeout(r, seconds * 1000));
  await session.stop();
  const file = writeReport(join(process.cwd(), 'sdk-reports'), session.report());
  console.log(`\nField report written to: ${file}`);
}

process.on('SIGINT', () => {
  void session.stop().then(() => {
    const file = writeReport(join(process.cwd(), 'sdk-reports'), session.report());
    console.log(`\nStopped. Field report written to: ${file}`);
    process.exit(0);
  });
});

void main();
