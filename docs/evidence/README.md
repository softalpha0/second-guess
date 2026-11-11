# Evidence

Everything here comes from the real app running on the author's Windows laptop with a real webcam —
no simulated data.

| Evidence | What it shows |
|---|---|
| [Demo video (YouTube, 1:27)](https://youtu.be/Bw7pHNqaJRY) | The full journey: a caught guess, consent, camera check, warm-up, live SDK signals, summary, Check mode |
| [Screenshots](../screenshots/) | Caught guess, live SDK signals, camera check, warm-up, summary, Check mode + signal replay |
| [`sdk-field-report-windows.json`](sdk-field-report-windows.json) | The M1 "spike": every field the SmartSpectra SDK sent during a 77-second run on Windows (SDK 3.5.0, full metric set accepted, 1,513 messages ≈ 20/s, 478-point face mesh, 8 expression scores). Numbers only — no images |
| [`check-mode-results.md`](check-mode-results.md) | Honest accuracy so far: agreement between the app's hidden verdict and the student's own answer, and what was changed because of it |
| [`test-results.txt`](test-results.txt) | 104 automated tests (scoring, scheduling, deck import, signals, storage, key store) — all passing |
| Fresh-clone check | `git clone` → `npm ci` → `npm test` → `npm run build` all pass (2026-11-11) |

How the SDK findings shaped the product (from the field report):
- **478 face points incl. irises** → "looking away" uses head *and* eye direction.
- **Pulse arrived only twice in 77 s** → pulse has weight 0 per card (a recall takes 2–10 s).
- **Blinks, breathing trace, expressions at ~25/s** → usable inside a short recall window.
- **`detected` is omitted when false** (protobuf default) → the app treats a missing flag as "no blink".
