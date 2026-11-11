# M1 — SDK check: how to test

Goal: prove the SmartSpectra SDK works on this PC and find out which fields it really sends.

## Steps (Windows PowerShell)

1. In the project folder: `npm install` (downloads a few hundred MB — that's the SDK runtime for every platform).
2. `copy .env.example .env`, open `.env` in Notepad, paste your key after `SMARTSPECTRA_API_KEY=`, save.
3. `npm start` — the "SDK check" window opens.
4. Pick your camera (or leave "Default camera"), press **Start**.
5. Sit about an arm's length from the screen, face **and shoulders** in view, good light on your face.
6. Wait until **Camera signal** says `Ok` and **Processing** says `Running`. Then about 60 seconds:
   blink normally, then blink fast a few times, look away for a moment, hold your breath for ~5 s, smile once.
7. Press **Stop**. The log shows "Field report saved: …". Press **Open report folder**.
8. Send Claude: a screenshot of the window while running, and the `sdk-fields-….json` file.

## Pass

- Pulse and breathing numbers appear, and the blink counter goes up when you blink.
- A field report file is written.

## Try to break it

| Do this | Expected |
|---|---|
| Remove the key from `.env`, restart | Red banner "No API key found", Start disabled |
| Cover the camera while running | Camera signal changes (e.g. NoFaceFound / TooDark), app keeps running |
| Walk out of view | Camera signal says NoFaceFound |
| Start with the webcam unplugged | Red banner with an "InputUnavailable" error, camera indicator stays off |
| Close the window while running | App closes cleanly, a report is still saved |
| Turn Wi-Fi off and press Start | An error in the log (network); no crash |

## If it fails

- **Window won't open / SDK "could not load"**: run `npm run probe` and send the whole output.
  If your project folder path has non-ASCII characters, move the project to e.g. `C:\dev\second-guess`.
- The terminal shows many `E2026…` / `W2026…` lines from the SDK — that's normal noise unless the window shows an error.
