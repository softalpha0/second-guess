# Making the Windows download and putting it on GitHub

> Quickest path: the portable `.exe` (one file, no install) was already built for v1.0.0. Test it (step 2,
> skipping the install part), then upload it (step 3). `npm run dist:portable` rebuilds it.

Do this on your Windows PC, after the feature freeze (Nov 20) so the installer has the final version.

## 1. Build the installer (about 5 minutes the first time)
In `C:\dev\second-guess`:

```
npm install
npm run dist
```

When it finishes, the installer is at `release\Second-Guess-Setup-1.0.0.exe` (about 150 MB).

## 2. Test it like a judge would
1. Double-click the `.exe`. If Windows says "Windows protected your PC": **More info → Run anyway**.
2. Install, then open **Second Guess** from the Start menu.
3. **Settings → Presage API key** → paste your key → **Save key**. It should say "✓ Key saved (…abcd)".
4. Study a deck with the camera (consent → camera check → warm-up → cards).
5. Remove the key (Settings → Remove key) and check you get "No camera mode — plain flashcards".
6. Uninstall from Windows Settings → Apps when done (your study data stays in `%APPDATA%\second-guess`).

## 3. Upload to GitHub Releases
1. Open https://github.com/softalpha0/second-guess/releases → **Draft a new release**.
2. **Choose a tag** → type `v1.0.0` → **Create new tag**.
3. Title: `Second Guess 1.0.0`.
4. Description (example):
   > Flashcards that notice when you're guessing. Windows 10/11 installer.
   > After installing, add your free Presage API key in Settings (physiology.presagetech.com).
   > Windows may warn that the app isn't signed: More info → Run anyway.
5. Drag `Second-Guess-1.0.0-portable.exe` (and/or `Second-Guess-Setup-1.0.0.exe`) into the "Attach binaries" box. Wait for the upload to finish.
6. **Publish release**.

## Important
- **Never put your own API key in the app or the release.** Everyone uses their own key.
- The `release\` folder is ignored by git — don't commit the `.exe`, only upload it to Releases.
