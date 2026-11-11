# M2–M5: how to test

Run `npm start`. The app now opens on **Your decks**.

## M3 — Decks and import
1. You see 3 decks: World capitals, Spanish basics, Web dev basics (30 cards each).
2. Press `↑`/`↓` to choose, `Enter` to study.
3. Press `I` (or **Import deck…**) and pick a CSV (`front,back` per line) or an Anki export
   (Anki: File → Export → "Notes in Plain Text"). The new deck appears with a message saying how many cards
   came in and which lines were skipped.

**Try to break it:** import an empty file, a file with one column, a picture (.jpg), a CSV with commas inside quotes
(`"Paris, France",capital`), and a file with the same front twice. Select an imported deck and press `Delete`.

## M2 — Consent and camera check
1. The first time you study, the consent screen appears. **Continue** stays disabled until you tick the box.
2. Camera check: the camera starts. The left box shows your face points (no video), mirrored like a mirror.
   The big text gives plain hints ("Move a little closer", "More light on your face").
3. **Start warm-up** turns on only after the signal has been good for 2 seconds.

**Try to break it:** cover the camera, walk away, turn off the light, let a second person into the picture —
the hint should change and the green bar should reset. Remove the key from `.env` and restart: a clear message
and "Study without camera". Press **Stop camera** at the top during any screen.

## M5 — Warm-up
Eight very easy cards. Same keys as studying. Afterwards you see "your normal": answer time, blinks per minute,
head position, breathing and resting face noted. If the view was unclear, it asks you to redo it (`R`).

## M4 — Study loop (keyboard only)
- Front shows → think → `Space` reveals the answer → `→` I was right / `←` I was wrong.
- With the camera on, the card shows a small chip: **camera reading ✓** or **no reading (camera view unclear)**.
- `Esc` ends the session early. The end screen shows right answers, average time, and how many cards had a clear
  reading. (The real summary with "right — but you hesitated" comes in M6–M8.)

**Try to break it:** hold down Space or an arrow key (should not skip cards), press arrows before Space
(nothing happens), press Stop camera mid-session (banner appears, you can continue), study a 2-card imported deck.

## Send Claude
- A screenshot of the camera check while it says "All set", and one of a card with the chip showing.
- The warm-up result text.
- `%APPDATA%\second-guess\reviews.json` (type that path in File Explorer's address bar). It contains only card ids,
  times and right/wrong.
