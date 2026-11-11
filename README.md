# Second Guess

**Flashcards that notice when you're guessing.**

You got it right — but did you *know* it? Second Guess watches for hesitation while you recall an answer, using your webcam and the [Presage SmartSpectra SDK](https://github.com/Presage-Security/SmartSpectra). When a right answer was really a guess, it brings that card back tomorrow instead of next week.

![Right — but you hesitated](docs/screenshots/hesitated.gif)

- **Demo video (1:27):** https://youtu.be/Bw7pHNqaJRY
- **DEV post:** _add link_

Built for the **Presage SmartSpectra SDK Challenge** on DEV.

> ⚠️ Second Guess measures study hesitation, not stress, emotion or health. It is not a medical device.

---

## The problem

Flashcard apps decide when you'll see a card again from your own rating. But people overrate lucky guesses, so those cards get pushed days away and forgotten. You find out in the exam.

## How it works

1. **Agree** to camera use. Nothing starts without consent, and nothing is recorded.
2. **Warm up** for 60 seconds with easy cards, so Second Guess learns *your* normal pace.
3. **Study.** See the question, think, press **Space**, mark **Right** or **Wrong**.
4. If you were right but hesitated — a long pause, looking away, holding your breath — you'll see **"Right — but you hesitated"** and the card comes back tomorrow. Disagree? Press **H** to override.
5. **Review** your session: which right answers were guesses, and what's coming back.

## Screenshots

All taken from the real app on my laptop with a real webcam.

| | |
|---|---|
| ![Right — but you hesitated](docs/screenshots/hesitated.png) **A caught guess**: right answer, but a long pause → back tomorrow | ![Live SDK signals](docs/screenshots/sdk-live-signals.png) **Live SDK signals**: breathing, blinks, expressions, 478 face points (numbers only) |
| ![Camera check](docs/screenshots/camera-check.png) **Camera check**: plain hints and a face-points "mirror" — no video | ![Warm-up](docs/screenshots/warmup.png) **60-second warm-up** learns your normal pace |
| ![Session summary](docs/screenshots/summary.png) **Session summary** | ![Signal replay and Check mode](docs/screenshots/signal-replay.png) **Check mode result and signal replay** |

## Features

_Mark honestly what works in the submitted version._

| Feature | Status |
|---|---|
| Consent screen + camera check with plain hints | ✅ |
| Built-in decks + CSV and Anki import | ✅ |
| Keyboard study loop | ✅ |
| 60-second personal warm-up | ✅ |
| Hesitation score with reasons | ✅ (weights to be tuned on real study data) |
| Scheduling that brings guesses back sooner, with override | ✅ |
| Session summary | ✅ |
| Works without a camera (plain flashcards) | ✅ |
| Check mode: measures how often it agrees with you | ✅ |
| Signal replay for a card | ✅ |
| Progress over days (lucky guesses that became sure) | ✅ |
| Settings: threshold, signals, camera, delete all data | ✅ |

## Check mode: how often does it agree with you?

Only you know whether a right answer was a guess. In **Check mode** (Settings), Second Guess asks "Was that a guess?" after each right answer, hides its own verdict, and then reports how often the two agreed.

> In **[N]** right answers of my own study, Second Guess agreed with me on **[X]%** — caught [a] of [b] guesses, [c] false alarms.
> _(fill in from Settings → Check mode, or `npm run tune`)_

## How it responds to human signals

| Signal | What it looks for |
|---|---|
| Recall time | Much longer than your warm-up pace |
| Looking away | Eyes or head off-screen while recalling |
| Blinking | A burst of blinks, or none at all, compared with your normal |
| Breathing | Holding your breath while recalling |
| Expression | A change from your neutral face |
| Pulse | A rise against your session average (lowest weight; pulse is slow and noisy) |

Every signal is compared with your own warm-up, never a fixed number. Signals are combined into a 0–100 score (threshold 50, adjustable in Settings); the two biggest contributors become the reasons you see. Long questions get a reading allowance. If the camera signal is poor, the card isn't judged ("no reading").

Pulse is measured by the SDK but has **weight 0**: on a laptop webcam it updated only about twice a minute — too rarely to say anything about one 3-second recall.

## Consent and data handling

- The camera starts only after you agree, with a visible **Camera on** indicator and a **Stop camera** button.
- **No video, frames or images are stored or sent by Second Guess.** For each card it keeps only the hesitation score, the reasons and your recall time.
- The SmartSpectra SDK processes the camera on this computer. It connects to Presage's servers to check the API key and download its models; those requests are linked to the API key, so they aren't anonymous.
- **SDK telemetry is turned off** (`enableTelemetry: false`). Per Presage's [Telemetry & Privacy](https://github.com/Presage-Security/SmartSpectra/blob/main/docs/telemetry-and-privacy.md) page, that stops the session summaries and readiness reports; even when on, they never contain video frames or measured values.
- The app never subscribes to the SDK's video output, so no frame ever reaches Second Guess's own code.
- Study data stays in local files on your computer. **Settings → Delete all data** removes it.
- No AI services are used.

## Download (Windows)

1. Download **`Second-Guess-Setup-1.0.0.exe`** from the [Releases page](https://github.com/softalpha0/second-guess/releases).
2. Run it. Windows may show **"Windows protected your PC"** because this hackathon app isn't code-signed: click **More info → Run anyway**.
3. Open Second Guess → **Settings → Presage API key**: create a free key at [physiology.presagetech.com](https://physiology.presagetech.com/) and paste it. It's stored encrypted on your computer (Windows DPAPI).
4. Pick a deck and study. No key or no webcam? It still works as plain flashcards.

Needs Windows 10/11 (64-bit), a webcam and an internet connection (the SDK checks the key and downloads its models). The installer is large (~150 MB) because it includes Electron and the SmartSpectra runtime.

## Run from source

Requires Node.js 22 (or newer), a webcam and a Presage API key (in `.env` or in Settings).

```bash
git clone https://github.com/softalpha0/second-guess.git
cd second-guess
npm install
cp .env.example .env   # add SMARTSPECTRA_API_KEY
npm start
```

No key or camera? It still runs as plain flashcards.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Runs the automatic tests (scoring, scheduling, import, …) |
| `npm run probe` | Checks the SDK without opening a window (45 s), writes a field report to `sdk-reports/` |
| `npm run tune` | Shows how well each threshold matched your Check-mode answers |
| `npm run dist` | Builds the Windows installer into `release/` (run on Windows) |

## Keyboard

| Key | Does |
|---|---|
| `Space` | Show the answer (ends the recall window) / next card |
| `→` / `←` | I was right / I was wrong |
| `H` | Change the verdict ("No, I knew it" / "Actually, I guessed") |
| `Y` / `N` | Check mode: was that a guess? |
| `?` | All shortcuts for the current screen |

## How it's built

- **Electron + TypeScript + Vite**, `@smartspectra/node-sdk` 3.5 in the main process with the native camera (1280×720, 30 fps). Metrics are decoded there and turned into numbers per frame: blink flags, head/eye direction from the 478-point face mesh (incl. iris), the chest-breathing trace and expression scores.
- When you press Space, the window asks for the signals between "card shown" and "Space"; `src/core/hesitation.ts` scores them against your warm-up baseline.
- All scoring, scheduling, import and summary logic is pure functions in `src/core` with Vitest tests.
- Data: small JSON files in your user-data folder (`%APPDATA%\second-guess` on Windows).
- Built with Claude Code.

## Team

[softalpha0](https://github.com/softalpha0) — solo

## License

[MIT](./LICENSE)
