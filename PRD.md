# PRD — Second Guess

> **Flashcards that notice when you're guessing.** You got it right — but did you *know* it? Second Guess watches for hesitation while you recall an answer (webcam, Presage SmartSpectra SDK) and brings "lucky" right answers back sooner, so you stop forgetting the cards you only guessed.

| | |
|---|---|
| **Challenge** | Presage SmartSpectra SDK Challenge (DEV × Presage) — tracker HK-006 |
| **Categories** | Overall · **Best Thoughtful Real-World Use** · Most Creative or Delightful Use |
| **Judged on** | Use of the technology · Usability & UX · Originality & creativity |
| **Deadline** | Sun Nov 22, 11:59 PM PST = **Mon Nov 23, 08:59 Lagos** |
| **Our target** | Submit **Sun Nov 22, 18:00 Lagos** · feature freeze **Fri Nov 20, 22:00** |
| **Entry** | Solo, one entry per person, 18+ |
| **Replaces** | Steady (dropped: HalfBeat and StagePulse already cover rehearsal/interview coaching) |

**Instruction to the coding agent:** read `CLAUDE.md` and this file. Explain your plan in plain language and wait for approval. Build **in the order of §7**. The riskiest part (M1: what the SDK really gives us) comes first. Test after each feature, commit, then move on.

---

## 1. Done statement

> "A student opens Second Guess, does a 60-second warm-up, then studies a deck. When they get a card right but hesitated, the app shows **'Right — but you hesitated'** with the reason (e.g. long pause, looked away, held breath), and schedules that card for tomorrow instead of next week. At the end they see which right answers were guesses, and the camera never records or stores video."

## 2. Problem

Spaced-repetition apps (Anki, Quizlet, Brainscape) decide when you see a card again from **your own rating** of how well you knew it. People overrate right guesses. A lucky guess is scheduled like real knowledge, pushed days away, and forgotten. Students find out in the exam.

## 3. Who it's for

| User | Need |
|---|---|
| Students revising for exams | Find the answers they're not really sure of before the exam does |
| Language learners | Separate words they know from words they recognise by luck |
| Anyone preparing for a certification or interview quiz | Spend review time on shaky knowledge, not on what they already know |

## 4. How it works

1. **Consent** (before the camera turns on): what is measured, that nothing is recorded, what leaves the computer (see §9). Tick to continue.
2. **Camera check:** the SDK's validation status turns into plain hints ("Move a little closer", "More light on your face"). Start is enabled only when the signal is good.
3. **Warm-up (60 s):** 8 very easy cards (e.g. "2 + 2"). Second Guess learns *your* normal: how long you take to answer when you know it, your blink rate, breathing and pulse.
4. **Study:** card front shows → you think → **Space** reveals the answer → you mark **Right (→)** or **Wrong (←)**. The time between front and reveal is the **recall window**.
5. **Hesitation check** on every Right answer: signals from the recall window are compared with your warm-up. Hesitant → shown as **"Right — but you hesitated"** with the top 1–2 reasons.
6. **Scheduling:**
   | Result | Next review |
   |---|---|
   | Right, sure | Normal interval (grows: 1 → 3 → 7 → 16 days…) |
   | **Right, hesitated** | **Tomorrow** (interval not grown) |
   | Wrong | Again in this session, then tomorrow |
   You can **override** any verdict with one key (**H** = "no, I knew it" / "yes, I guessed"). Overrides are counted.
7. **Session summary:** cards studied, right, **right-but-hesitated**, the top reasons, and the cards coming back tomorrow.

## 5. Hesitation signals

Combine several weak signals, because one alone is noisy. Every signal is compared with the user's **own warm-up baseline**, not a fixed number.

| Signal | Source | What counts as hesitation | Weight (start, tune on real data) |
|---|---|---|---|
| Recall time | App (front shown → Space) | > 2× warm-up median | High |
| Looking away / up | SDK face landmarks (head/eye direction derived by the app) | Gaze off-screen > 1 s during recall | Medium |
| Blink change | SDK `face.blinking` | Blink burst or long suppression vs baseline | Medium |
| Breath hold | SDK `breathing.upperTrace` | Flat trace > 2 s during recall | Medium |
| Expression | SDK expression scores (whatever M1 finds) | Rise in a non-neutral expression vs baseline | Low–medium |
| Pulse | SDK `cardio.pulseRate` | Rise vs session average (slow, smoothed) | Low |

**Hesitation score** = weighted sum, 0–100. Over the threshold (default 50, adjustable in Settings) → "hesitated". The two biggest contributors become the reasons shown.

Rules:
- If the SDK signal quality is poor during a card, **don't judge**; mark it "no reading" and schedule it normally.
- Never say "you were stressed", "anxious" or anything about health. Only "hesitated" and the reason in plain words.

## 6. MoSCoW

**Must (in this order):**
- **M1 SDK spike:** Electron app shows live pulse, breathing, blinking, validation status, and **logs every field the SDK sends** (find out which expression and landmark fields exist). Write the findings into `CLAUDE.md`.
- **M2 Consent + camera check** screens.
- **M3 Decks:** 3 built-in decks (World capitals, Spanish basics, Web dev basics, 30 cards each, written by us) + import CSV (`front,back`) and Anki plain-text export (tab-separated).
- **M4 Study loop:** front → Space → back → Right/Wrong, keyboard only, recall time recorded.
- **M5 Warm-up baseline** (60 s, 8 easy cards).
- **M6 Hesitation score** from §5, with reasons, and the "Right — but you hesitated" card state.
- **M7 Scheduler** from §4 step 6, with override key, stored locally.
- **M8 Session summary** screen.
- **M9 "No camera" mode:** the app still works as plain flashcards if the camera or key is missing, with a clear banner.

**Should (only after every Must works):**
- S1 **Check mode** for honest evaluation: after each Right answer, ask "Was that a guess? Y/N" (no AI verdict shown). The summary shows how often Second Guess agreed with you. Use real numbers from this in the DEV post.
- S2 **Signal replay** for one card: small timeline of the recall window (recall time, gaze, blinks, breath) to explain a verdict.
- S3 Progress over days: "lucky" cards that became sure.
- S4 Settings: threshold, which signals are used, camera choice.

**Could:** dark mode · keyboard shortcut overlay · export progress as CSV.
**Won't:** accounts, cloud sync, mobile app, AI-generated cards, storing video or frames, health language.

## 7. Schedule (Lagos time)

The Epic AI MegaJam takes **Nov 12–15**. Second Guess gets today, short slots during the jam, and Nov 16–22.

| When | Work | Gate |
|---|---|---|
| **Wed Nov 11 (today)** | **M1 spike** (most important: prove the SDK works on this PC and see which fields exist). M2 if time. | Live pulse + blink on screen; field list in CLAUDE.md |
| Nov 12–15 | MegaJam. Optional 30 min/day: M3 decks content | — |
| Mon Nov 16 | M3, M4 | A deck can be studied with the keyboard |
| Tue Nov 17 | M5, M6 | Verdicts appear with reasons |
| Wed Nov 18 | M7, M8, M9 | Full loop works; no-camera mode works |
| Thu Nov 19 | S1 Check mode; study real decks for 20+ minutes to tune weights | Real agreement number |
| Fri Nov 20 | S2, polish, **feature freeze 22:00** | — |
| Sat Nov 21 | Demo video, screenshots, README, DEV post draft | Fresh-clone install works |
| **Sun Nov 22** | Final check, **publish DEV post by 18:00** | Post is live with tags |

Stuck 30 minutes → simplify or ask Claude with a screenshot.

## 8. Tech

- **Electron + TypeScript**, Vite for the renderer, following Presage's official Electron starting point.
- **`@smartspectra/node-sdk`** (3.4.x) in the **main process** (camera keeps running even if the page is busy); metrics sent to the renderer over IPC and decoded with `@smartspectra/node-sdk/messages`.
- SDK options: `enableTelemetry: false`, `enableAccumulatedOutput: false`; camera 1280×720 at 30 fps.
- API key from env `SMARTSPECTRA_API_KEY` (`.env`, never committed).
- Storage: local JSON files in the app's user-data folder (decks, review history, settings). No database.
- Scheduler: simple interval doubling (§4), not FSRS.
- Charts: hand-written SVG.
- Known SDK notes from other entries: Windows works; the SDK needs an internet connection; calibration can take longer if the chest/face isn't in view; pulse is noisy, so it gets the lowest weight; if the runtime can't load from a path with non-ASCII characters, copy it to an ASCII-only folder and set `SMARTSPECTRA_CAPI_PATH`.

**Repo layout**
```
second-guess/
  src/main/      sdk.ts (SDK session + IPC), store.ts (JSON storage)
  src/renderer/  screens: consent, camera-check, warmup, study, summary, decks, settings
  src/core/      hesitation.ts (score + reasons), scheduler.ts, deck-import.ts  ← pure functions, unit-tested
  decks/         capitals.csv, spanish.csv, webdev.csv
  test/          vitest tests for src/core
  docs/          screenshots, demo script
```

## 9. Consent and data handling (required section of the DEV post)

- Camera starts only after the consent screen. A visible "Camera on" indicator and a **Stop camera** button are always on screen.
- **No video, frames or images are stored or sent by Second Guess.** Per card, it keeps only the hesitation score, the reason labels and the recall time.
- The SmartSpectra SDK processes the camera signal and talks to Presage's service; describe exactly what it sends using Presage's **Telemetry and Privacy** page (check during M1). SDK telemetry is turned off.
- All study data stays in local JSON files. **Delete all data** button in Settings.
- No health claims: Second Guess measures study hesitation, not stress, emotion or health.
- No AI services are used.

## 10. Submission (DEV post, tags `#devchallenge #presagechallenge`)

Template sections, in order:
1. **What I Built** — the problem in 2 sentences, the "Right — but you hesitated" moment, one GIF.
2. **Demo** — video (≤ 2 min, §11) + screenshots.
3. **Code** — GitHub repo link.
4. **How It Responds to Human Signals** — the §5 table, warm-up baseline, what happens when the signal is poor.
5. **Prize Categories** — Best Thoughtful Real-World Use; Most Creative or Delightful Use.
6. **Consent and Data Handling** — §9.
7. **Agent Session** (optional, encouraged) — how Claude Code built it, with one or two real prompts.

Include the Check-mode result honestly, e.g. "In 120 cards of my own study, Second Guess agreed with me on N%."

## 11. Demo video (≤ 2 min)

| Time | Show |
|---|---|
| 0:00–0:10 | "I got it right. Did I know it?" Card → right answer → **"Right — but you hesitated: long pause, looked away."** |
| 0:10–0:25 | The problem: flashcard apps trust you; lucky guesses get pushed to next week |
| 0:25–0:40 | Consent + camera check + 60 s warm-up (sped up) |
| 0:40–1:20 | Study 6 cards: 3 known instantly (sure), 2 guesses (caught), 1 wrong |
| 1:20–1:40 | Summary: right-but-hesitated cards come back tomorrow; one signal replay |
| 1:40–2:00 | Consent/data in one line, no camera mode, repo link |

## 12. Risks

| Risk | Fallback |
|---|---|
| SDK has no expression or landmark data on desktop | Use recall time + blinks + breath + pulse only; still meaningful |
| Signals too noisy to tell guesses apart | Recall time carries the score; S1 Check mode reports honest accuracy; threshold adjustable |
| SDK calibration slow on this PC | Warm-up starts only when validation is good; keep the face and shoulders in view |
| MegaJam eats the week | M1 done today; Must list fits Nov 16–18; Shoulds are optional |
| Overlap with a new entry before Nov 22 | Re-check `#presagechallenge` on Nov 16 and Nov 21 |
