// S1: Check mode — honest evaluation. After each Right answer the student says
// whether it was a guess (Y/N) BEFORE seeing any verdict. We then compare the
// app's hidden verdict with the student's answer. Pure, unit-tested.

export interface CheckRecord {
  /** App verdict: true = it thought you hesitated. */
  appHesitated: boolean;
  /** Student's answer: true = "yes, that was a guess". */
  selfGuess: boolean;
}

export interface Agreement {
  /** Right answers where both a verdict and a Y/N answer exist. */
  total: number;
  agreed: number;
  /** 0–100, or null if nothing to compare. */
  percent: number | null;
  /** You guessed and the app noticed. */
  caught: number;
  /** You guessed but the app said "knew it". */
  missed: number;
  /** You knew it but the app said "hesitated". */
  falseAlarms: number;
  /** You knew it and the app agreed. */
  bothSure: number;
}

export function agreement(records: CheckRecord[]): Agreement {
  let caught = 0, missed = 0, falseAlarms = 0, bothSure = 0;
  for (const r of records) {
    if (r.selfGuess && r.appHesitated) caught++;
    else if (r.selfGuess) missed++;
    else if (r.appHesitated) falseAlarms++;
    else bothSure++;
  }
  const total = records.length;
  const agreed = caught + bothSure;
  return { total, agreed, percent: total ? Math.round((agreed / total) * 100) : null, caught, missed, falseAlarms, bothSure };
}

/** "In 120 cards, Second Guess agreed with you on 78%." */
export function agreementText(a: Agreement): string {
  if (a.percent === null) return 'No Check mode answers yet.';
  return `In ${a.total} right answer${a.total === 1 ? '' : 's'}, Second Guess agreed with you on ${a.percent}%.`;
}
