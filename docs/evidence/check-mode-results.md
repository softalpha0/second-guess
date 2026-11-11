# Check mode results (real, unedited)

Output of `npm run tune` on the author's own study data (Windows laptop, HP Full-HD webcam), 2026-11-11.
In Check mode the app asks "Was that a guess?" after each right answer and hides its own verdict; these numbers
compare the hidden verdict with the honest Y/N answer.

## Round 1 — first 10 answers

```
Check-mode right answers that were judged: 10  (you said: 3 guesses, 7 knew it)
Agreement with the settings you studied with: 50%
  caught 3 of 3 guesses · 5 false alarms
Signals (average points on guesses vs known answers):
  recall      guesses    55   known  47.8   gap   7.2
  lookAway    guesses    10   known  14.1   gap  -4.1
  blink / breath / expression: 0 on all cards
```

**What we learned:** "long pause" gave known cards almost as many points as guesses. The warm-up cards
("2 + 2") are much faster than real cards, so everything looked slow. **Change made:** recall time is now compared
with the student's own pace on the real deck (median of this session's right answers, after 4), never faster than
1.5× the warm-up pace.

## Round 2 — 16 answers (6 new)

```
Check-mode right answers that were judged: 16  (you said: 5 guesses, 11 knew it)
Agreement with the settings you studied with: 44%
  caught 3 of 5 guesses · 7 false alarms
At threshold 50: caught 5/5 guesses, 8 false alarms (50% agreement)
Signals (average points on guesses vs known answers):
  recall      guesses    55   known  45.4   gap   9.6
  lookAway    guesses   8.5   known  17.2   gap  -8.6
  blink       guesses   0.5   known   0.9   gap  -0.5
  breath / expression: 0
```

**Honest reading:** on this small sample Second Guess catches guesses but raises too many false alarms — it agrees
with the student about half the time (always answering "knew it" would score 69% here). Looking away points the
*wrong* way for this user (glancing at the keyboard when sure). Next tuning steps are listed in the README's
"What's next". 16 answers is too few for firm conclusions; the tool (`npm run tune`) is built in so anyone can
measure it on themselves.
