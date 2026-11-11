// Writes the M1 field report (JSON) to a folder. Contains field names,
// example numbers and counts only — never images or video.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FieldReport } from './sdk';

export function writeReport(dir: string, report: FieldReport): string {
  mkdirSync(dir, { recursive: true });
  const stamp = report.createdAt.replace(/[:.]/g, '-');
  const file = join(dir, `sdk-fields-${stamp}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');
  return file;
}
