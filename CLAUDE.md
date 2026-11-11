# Project: Second Guess

Problem: Flashcard apps trust students' own ratings, so right *guesses* get scheduled like real knowledge and are forgotten.
User: Students and language learners studying on a laptop with a webcam.
Done statement: A student studies a deck; when they get a card right but hesitated, the app shows "Right — but you hesitated" with the reason and schedules it for tomorrow. No video is stored.
Must-have features (in order): M1 SDK spike · M2 consent + camera check · M3 decks + CSV/Anki import · M4 study loop · M5 warm-up baseline · M6 hesitation score + reasons · M7 scheduler + override · M8 session summary · M9 no-camera mode.
Should/Could: see PRD.md §6 — only after every Must works and is committed.
Tools: Electron + TypeScript + Vite, @smartspectra/node-sdk (main process, IPC to renderer), local JSON storage, Vitest.

Rules:
- Full spec in PRD.md. Read it before planning.
- Plan first; wait for my approval before writing code.
- I'm not a developer. Explain things in plain language, and explain errors before fixing them.
- Build one feature at a time; tell me how to test it and how to try to break it; commit after each feature that works.
- Hesitation scoring and scheduling are pure functions in src/core with Vitest tests.
- Every signal is compared with the user's own warm-up baseline. If signal quality is poor, don't judge the card.
- Never store or send video, frames or images. Never use health words (stress, anxiety, emotion, heart health). Say "hesitated" and the plain reason.
- SDK telemetry off. API key only in .env (SMARTSPECTRA_API_KEY); keep .env.example updated; never commit keys.
- Built-in decks are written by us — no copied content.
- Feature freeze: Fri Nov 20, 22:00 Lagos.
- Add anything important you learn about the project here.

## SDK findings (M1)

Status: SDK code paths verified in the cloud dev box (Linux, no camera). **Live on-PC fields are pending
the first run on the Windows PC** — copy the facts from `sdk-reports/sdk-fields-*.json` into the
"Seen on this PC" lines below.

**Setup facts**
- Package `@smartspectra/node-sdk@3.5.0`. Pure FFI (koffi) — no native build step. Installs the native
  runtime for all platforms (a few hundred MB); only `node-sdk-win32-x64` is loaded on Windows.
- Integration chosen: **main-process native camera** (`useCamera(CameraSelection.default|byId, {1280x720, 30fps})`),
  as the PRD asks. Presage's official Electron sample instead captures in the renderer (`@smartspectra/node-sdk/renderer`
  + `bindSmartSpectraIpc`). If native capture misbehaves on Windows, switch to that path (~1 h of work).
- We never subscribe to the `videoOutput` event, so no frames ever reach our code.
- Options used: `enableTelemetry: false`, `enableAccumulatedOutput: false`.
- Events: `processingStatus` (Idle/Starting/Running/Stopping/Error), `validationStatus(code, ts, hint)`,
  `metrics(buf, ts)` (protobuf, decode with `@smartspectra/node-sdk/messages` → `Metrics.decode` + `toObject`),
  `error(code, message, retryable)`.
- Metrics must be requested by name (`MetricType`). If the key isn't allowed one, SDK raises error 13
  `kMetricNotAuthorized`; `src/main/sdk.ts` then retries with smaller sets (full → no expressions → no landmarks →
  breathing+pulse+blinking → breathing+pulse → breathing only) and logs which set was accepted.
- Fields the SDK *can* send (from its protobuf schema), relevant to us:
  - `breathing.rate[]` {value, confidence, stable, timestamp}, `breathing.upperTrace[]` {value, stable, timestamp}
  - `cardio.pulseRate[]` {value, confidence, stable, timestamp}
  - `face.blinking[]` / `face.talking[]` {detected, stable, timestamp}
  - `face.landmarks[]` {value: [{x, y}], stable, reset, timestamp}
  - `face.expression[]` {stable, timestamp, scores: [{type, confidence}]}
  - Timestamps are microseconds.
- Validation codes (for M2 camera-check hints): Ok, NoFaceFound, MultipleFacesFound, FaceNotCentered,
  TooDark, TooBright, ChestNotVisible, CameraTuning, FrameRateTooLow, ExcessiveMotion, FaceTooClose, FaceTooFar,
  FaceTooHigh, FaceTooLow, FaceNotForward.
- Seen in the cloud box: SDK loads; with a bad key the server answers 401; with no camera → error 7
  `kInputUnavailable` (app shows it, camera indicator stays off). The SDK prints its own `E…/W…` log lines to the
  terminal — they're normal noise unless the app shows an error.

**Seen on this PC (fill in from the field report)**
- Fields the SDK actually sends on this PC: _pending_
- Metric set accepted for our key: _pending_
- Expression names available: schema allows ANGRY, CONTEMPT, DISGUST, FEAR, HAPPY, NEUTRAL, SAD, SURPRISE — _which arrive: pending_
- Landmarks available (for gaze/head direction): schema gives 2-D points per frame — _point count and coordinate range: pending_
- Metric update rate: _pending_ (messages/sec in the report)
- Are arrays cumulative or one reading per message? _pending_ (compare minLength/maxLength in the report)

**What the SDK sends to Presage** (Telemetry & Privacy page + what we observed)
- With telemetry ON (default) it sends session summaries (SDK version, OS/device model, CPU arch, frame-rate and
  performance counts, counts of validation states, error code, timestamp) and readiness reports. **No raw frames and
  no measured vital values.** We turn telemetry OFF, which the page says stops all telemetry transmission.
- Even with telemetry off, the SDK needs the internet: we observed API-key/usage verification, metrics authorization,
  and download of its on-device models from Presage's servers. Requests are authenticated with the API key, so Presage
  can link them to the account — don't call it "anonymous".
- Processing (pulse, breathing, face) runs on this computer with downloaded models.
