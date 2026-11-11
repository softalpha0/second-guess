// Camera-check hints: SDK validation codes → plain words for the student.
// Pure, unit-tested.

const HINTS: Record<string, string> = {
  Ok: 'Looking good. Hold still.',
  NoFaceFound: "We can't see your face. Sit in front of the camera.",
  MultipleFacesFound: 'More than one face in view. Make sure only you are in the picture.',
  FaceNotCentered: 'Move to the middle of the picture.',
  FaceSizeOutOfRange: 'Move a little closer or further away.',
  TooDark: 'More light on your face, please.',
  TooBright: 'Too bright. Avoid strong light shining at the camera.',
  ChestNotVisible: 'Sit back a little so your shoulders are in view.',
  CameraTuning: 'The camera is adjusting. One moment…',
  FrameRateTooLow: 'The camera is running slowly. Close other apps that use the camera.',
  ExcessiveMotion: 'Try to hold still.',
  FaceTooClose: 'Move a little further away.',
  FaceTooFar: 'Move a little closer.',
  FaceTooHigh: 'Your face is too high in the picture. Sit a little lower or tilt the screen back.',
  FaceTooLow: 'Your face is too low in the picture. Sit up or tilt the screen forward.',
  FaceNotForward: 'Face the screen directly.',
};

export function cameraHint(validationName: string): string {
  return HINTS[validationName] ?? 'Adjusting… keep your face and shoulders in view.';
}

/**
 * "Ready" only after the signal has been Ok continuously for `holdMs`,
 * so one lucky frame doesn't enable Start.
 */
export class ReadyGate {
  private okSince: number | null = null;
  constructor(private holdMs = 2000) {}

  update(validationName: string, now: number): boolean {
    if (validationName === 'Ok') this.okSince ??= now;
    else this.okSince = null;
    return this.isReady(now);
  }

  isReady(now: number): boolean {
    return this.okSince !== null && now - this.okSince >= this.holdMs;
  }

  /** 0–1 progress towards ready, for a small bar. */
  progress(now: number): number {
    return this.okSince === null ? 0 : Math.min(1, (now - this.okSince) / this.holdMs);
  }
}
