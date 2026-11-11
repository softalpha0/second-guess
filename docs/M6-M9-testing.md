# M6–M9: how to test

## M6 — "Right — but you hesitated"
Warm up, then study. After `→` on a right answer:
- Quick, calm answer → **"Right — you knew it"** (moves on by itself).
- Pause long, look up at the ceiling for ~2 s, or hold your breath while thinking → **"Right — but you hesitated:
  long pause, looked away"** (waits for `Space`).
- `H` changes the verdict ("No, I knew it" / "Actually, I guessed"). `H` again undoes it.
- Cover the camera while thinking → "no reading" (not judged).

## M7 — Scheduling
- Deck list shows **"N due · M new"**.
- New card, knew it → back in 3 days. Hesitated → **tomorrow**. Wrong → comes back **later in the same session**
  (shown as "· again"), then tomorrow.
- Study the same deck again right away: the cards you just knew are no longer offered; when nothing is due or new,
  you get "All caught up — practising the cards due soonest".

## M8 — Session summary
After the last card (or `Esc`): cards studied, right, **right but hesitated**, wrong, a coloured bar, the most common
reasons, the hesitated cards, and **"Coming back tomorrow"** (missed + hesitated).

## M9 — No camera mode
Rename `.env` to `env-off`, restart: a purple "No camera mode — plain flashcards" notice appears on the decks screen,
and studying goes straight to plain flashcards (no consent or camera check). Rename it back to `.env` and restart.

## Try to break it
- Answer the same card wrong three times in one session (it should stop coming back after two retries).
- Press `Esc` while a verdict is showing; press `H` on a wrong answer (nothing should happen).
- Import a 2-card deck and study it twice.
- Stop the camera mid-session, then finish: the summary says hesitation wasn't checked for those cards.

## Send Claude
Screenshots of a hesitated verdict and the summary, plus `%APPDATA%\second-guess\reviews.json` and `schedule.json`.
