---
title: "Second Guess: flashcards that notice when you're guessing"
published: false
tags: devchallenge, presagechallenge, electron, typescript
---

*This is a submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage).*

> **Second Guess helps students find the answers they only guessed right, without trusting their own over-confident self-ratings.**

## What I Built

**The problem.** Flashcard apps like Anki and Quizlet decide when you'll see a card again from *your own rating* — and people overrate lucky guesses. A guess gets scheduled like real knowledge, pushed a week away, and forgotten. You find out in the exam.

**What it does.** Second Guess watches the few seconds between seeing a question and revealing the answer — the *recall window* — using the SmartSpectra SDK. If you got it right but hesitated (a long pause, looking away, a held breath), it says **"Right — but you hesitated: long pause, looked away"** and brings that card back **tomorrow** instead of next week. Every signal is compared with your own 60-second warm-up, and you can always disagree with one key.

![A caught guess](https://raw.githubusercontent.com/softalpha0/second-guess/main/docs/screenshots/hesitated.gif)

## Demo

{% embed https://youtu.be/Bw7pHNqaJRY %}

![Live SDK signals](https://raw.githubusercontent.com/softalpha0/second-guess/main/docs/screenshots/sdk-live-signals.png)
*Live SDK signals on my laptop: breathing trace, blinks, expressions and the 478-point face mesh — numbers only, no video kept.*

![Camera check](https://raw.githubusercontent.com/softalpha0/second-guess/main/docs/screenshots/camera-check.png)
*Camera check: plain hints and a face-points "mirror" instead of a video preview.*

![Session summary](https://raw.githubusercontent.com/softalpha0/second-guess/main/docs/screenshots/summary.png)
![Check mode and signal replay](https://raw.githubusercontent.com/softalpha0/second-guess/main/docs/screenshots/signal-replay.png)
*Summary, Check mode result and signal replay.*

## Code

{% github softalpha0/second-guess %}

Windows installer on the [Releases page](https://github.com/softalpha0/second-guess/releases) — add your own free Presage key in Settings. Evidence (SDK field report from a real run, test results, honest accuracy numbers): [docs/evidence](https://github.com/softalpha0/second-guess/tree/main/docs/evidence).

## How It Responds to Human Signals

The SDK runs in Electron's main process on the native camera and sends ~20 messages per second. Before writing any feature, I logged **every field** it sent on my Windows laptop ([field report](https://github.com/softalpha0/second-guess/blob/main/docs/evidence/sdk-field-report-windows.json)). That spike decided the design: a **478-point face mesh including irises** (great for "looking away"), blinks, the chest-breathing trace and 8 expression scores at ~25 readings/s — and **pulse only twice in 77 seconds**.

| Signal | SDK source | What counts as hesitation | Weight |
|---|---|---|---|
| Long pause | app timing | Much slower than your pace on this deck (long questions get a reading allowance) | 55 |
| Looking away | `face.landmarks` → head + eye direction | Away from your usual direction > ~1 s | 30 |
| Breath hold | `breathing.upperTrace` | Nearly flat for 2–4 s | 20 |
| Blinking | `face.blinking` | A burst, or none when some were expected | 15 |
| Expression | `face.expression` | Moving away from your resting face | 15 |
| Pulse | `cardio.pulseRate` | Not used per card — too slow for a 3-second recall | 0 |

The weighted sum is a 0–100 score (threshold 50, adjustable); the two biggest contributors become the plain-language reasons. **When the signal is poor** — face lost, too dark, camera stopped — the card is marked "no reading" and scheduled normally. SDK validation codes become plain hints on the camera check ("More light on your face, please").

### Does it work? Honest results

Check mode asks "Was that a guess?" after each right answer and hides its own verdict. In a first test of **16 right answers** of my own study, Second Guess **caught all 5 of my guesses** — but it also flagged **8 of the 11 answers I actually knew**, so it agreed with me about half the time. That's cautious on purpose (a false alarm costs one extra review; a missed guess costs you in the exam), but it isn't good enough yet. The data already told me what to fix: see Challenges.

### Challenges

- **The warm-up was too easy.** "2 + 2" takes a second; real cards take longer even when you know them, so every answer looked like a long pause. Recall time is now compared with your own pace on the real deck.
- **Looking away pointed the wrong way** for me — I glance at the keyboard when I'm *sure*. Check mode caught it; it's the next signal to re-tune.
- **Pulse** was too sparse per card, so it got weight 0 instead of pretending.
- **The SDK needs the internet while running.** A network drop stops the camera, so the app explains exactly why and offers "Turn camera back on".

### How I built it

- Electron + TypeScript + Vite, `@smartspectra/node-sdk` 3.5 in the main process (the API key never reaches the window).
- All scoring, scheduling, baseline and import logic is pure TypeScript in `src/core` with **104 Vitest tests**.
- Local JSON storage; the API key is encrypted with Windows DPAPI via Electron safeStorage.
- Hand-written SVG for the progress chart and signal replay; electron-builder for the Windows installer.

### What's next

- Re-tune with more Check-mode data and learn each user's weights from their own Y/N answers.
- A longer, varied warm-up so the baseline matches real cards from the first card.
- Anki export so "hesitated" verdicts can feed existing decks.

## Prize Categories

- **Best Thoughtful Real-World Use** — it fixes a real flaw in spaced repetition, with consent first, no recording, "no reading" instead of guessing, and an honest measurement of its own accuracy.
- **Most Creative or Delightful Use** — physiological signals used not for health, but to catch a lucky guess.

## Consent and Data Handling

- The camera starts only after a consent screen that explains what's measured, kept and sent. A **Camera on** indicator and **Stop camera** button are always visible.
- **No video, frames or images are stored or sent by Second Guess.** The app never subscribes to the SDK's video output. Per card it keeps only the hesitation score, the reason labels and the recall time, in local JSON files.
- The SmartSpectra SDK processes the camera on the computer. It connects to Presage's servers to verify the API key and download its models — those requests are linked to the key, so I don't call it anonymous. **SDK telemetry is off** (`enableTelemetry: false`); per Presage's Telemetry & Privacy page, telemetry never includes frames or measured values anyway.
- **Settings → Delete all data** removes history, schedule, imported decks, settings, the saved key and logs.
- It measures study hesitation — never stress, emotion or health. No AI services are used by the app.
- No camera or key? It works as plain flashcards, with a clear notice.

## Agent Session

I built Second Guess solo with **Claude Code**, from a written PRD and a `CLAUDE.md` of rules (plan first, one feature at a time, pure tested core, no video stored, no health words). The riskiest part went first: an SDK spike on my own laptop that logged every field the SDK sends.

Two real prompts from the session:

> "read `CLAUDE.md` and this file. Explain your plan in plain language and wait for approval. Build in the order of §7. The riskiest part (M1: what the SDK really gives us) comes first. Test after each feature, commit, then move on."

> "build everything that needs to built today"

Claude Code wrote the code and tests; I tested every feature on my own laptop and webcam, reported bugs from real use (a camera that stopped, a misleading banner, false alarms), and the fixes came from that real data.
