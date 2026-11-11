# Second Guess

**Flashcards that notice when you're guessing.**

You got it right — but did you *know* it? Second Guess watches for hesitation while you recall an answer, using your webcam and the [Presage SmartSpectra SDK](https://github.com/Presage-Security/SmartSpectra). When a right answer was really a guess, it brings that card back tomorrow instead of next week.

![Right — but you hesitated](docs/screenshots/hesitated.gif)
_Add a GIF of a caught guess._

- **Demo video:** _add link_
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
| Check mode: measures how often it agrees with you | ⬜ |
| Signal replay for a card | ⬜ |

## How it responds to human signals

| Signal | What it looks for |
|---|---|
| Recall time | Much longer than your warm-up pace |
| Looking away | Eyes or head off-screen while recalling |
| Blinking | A burst of blinks, or none at all, compared with your normal |
| Breathing | Holding your breath while recalling |
| Expression | A change from your neutral face |
| Pulse | A rise against your session average (lowest weight; pulse is slow and noisy) |

Every signal is compared with your own warm-up, never a fixed number. If the camera signal is poor, the card isn't judged.

## Consent and data handling

- The camera starts only after you agree, with a visible **Camera on** indicator and a **Stop camera** button.
- **No video, frames or images are stored or sent by Second Guess.** For each card it keeps only the hesitation score, the reasons and your recall time.
- The SmartSpectra SDK processes the camera signal and connects to Presage's service — _describe what it sends, from Presage's Telemetry and Privacy page_. SDK telemetry is turned off.
- Study data stays in local files on your computer. **Settings → Delete all data** removes it.
- No AI services are used.

## Run it

Requires Node.js 22 (or newer), a webcam and a Presage API key.

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
| `npm test` | Runs the automatic tests |
| `npm run probe` | Checks the SDK without opening a window (45 s), writes a field report to `sdk-reports/` |

## Team

[softalpha0](https://github.com/softalpha0) — solo

## License

[MIT](./LICENSE)
