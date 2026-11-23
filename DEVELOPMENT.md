# DoctorCar: developer notes

## How it is built
- `sorgente-DoctorCar.html`: the whole app (HTML, style, script) in one file. It also opens on a computer as a web page.
- `piattaforma-android.js`: the Android layer (files, vibration, notifications, PairWood sync, updates). `prepara.py` appends it to the page and writes `www/index.html` for Capacitor.
- `android/`: Android project (Capacitor 8). Native code in `android/app/src/main/java/it/doctorcar/app/`. PairWood SDK precompiled in `android/pairwood-sdk`.
- Page security rule (CSP): `connect-src 'none'`, only scripts with a sha256 hash. **After every change to the page: `python3 prepara.py`** (recomputes the hashes).
- Button commands go through the `COMANDI` object (`data-click`, `data-change`): no code written in the HTML.
- All incoming data is cleaned (`SCHEMI`, `pulisciTutto`); all displayed data goes through `esc()`.
- The source code, its comments and the folder names are in Italian (`guida` = guide, `prove` = tests, `lingua` = language, `rilasci` = releases).

## Build
```
npm install
python3 prepara.py
npx cap sync android
cd android && ./gradlew assembleRelease
```
Minimum **Android 10 (API 29)**. applicationId **`it.doctorcar.app`**: don't change it, or Android treats it as a different app.
For each version: `versionCode`/`versionName` in `android/app/build.gradle` and `VERSIONE` in the page.

**Signing**: the key is not in the repository (`firma/` folder, excluded by `.gitignore`, with `firma/firma.properties`: `storeFile`, `storePassword`, `keyAlias`, `keyPassword`). Updates install only with the same key: whoever keeps it must never lose it. SHA-256 fingerprint of the official certificate: `32f168382e3ce2f751ef551bea31515de2ec86288eb83e45264e54b89bd374d2`.

## Tests
Tests use Playwright with Chromium. Servers: `python3 -m http.server 8786` from the project folder and `python3 -m http.server 8785` from the `www` folder. Instructions in [`prove/README.md`](prove/README.md). The main ones: `node prove/robot.js` (presses every button), `node prove/layout.js` (layout; with `INGLESE=1` in English), `node prove/inglese.js`, `node prove/veleno.js` (malicious data), `node prove/aggiornamenti.js`.

## English
The page is written in Italian; in English the visible texts are translated on the fly with the table in `lingua/inglese.txt` (one line per sentence: Italian, arrow, English; `#` number, `@` a name typed by the user, `«@»` a name between «», `§` date or month, `*` start of a sentence; `@@` lines translate the names of buttons quoted between «»). After every change: `python3 lingua/applica.py` and `python3 prepara.py`. **Every new text must be added**: `INGLESE=/tmp/x.json node prove/robot.js` and `RACCOLTA=/tmp/x.json node prove/inglese.js` collect the untranslated ones. The Android side uses `Testi.java` and `res/values-en`.

## Publishing a version
1. Build and sign the APK (signing happens outside GitHub: keys never go into the repository).
2. Update `rilasci/aggiornamento.json` (`versionCode`, `versione`, `apk`, the APK's `sha256`, `novita` = what's new, shown in the app).
   Also add the English release notes of the new version to `rilasci/release-notes.json` on the `rilasci` branch: GitHub Releases are published in English only.
3. On the **`rilasci`** branch (separate from the code: it only holds the automation, the APK and `aggiornamento.json`) remove the old APK, add the new one and the new `aggiornamento.json`, and push.
4. The `.github/workflows/rilascio.yml` automation on that branch checks the APK fingerprint and creates the `vX.Y.Z` Release with both files by itself.
Installed apps find it by themselves within a week (`Aggiornamento.java`: https from GitHub only, SHA-256 fingerprint, same package, newer version, same signature). Alternatively the Release can always be created by hand on the website, attaching the same two files.

## User guide and tutorials
Four PDFs: guide and tutorials, in Italian and English (`guida/guida.html`, `guida/tutorial.html`, `guida/guide-en.html`, `guida/tutorial-en.html`, shared style in `guida/stile-guida.css`), all in the same six parts.
1. Screenshots: from the app page (`www`, server on port 8785) with `node guida/schermate.js` (into `guida/img`) and `node guida/schermate.js en` (into `guida/img-en`, with the app and sample data in English).
2. PDFs: `node guida/genera-guida.js` (all four; or `guida it`, `tutorial en`…). The contents page gets the page numbers by itself: each chapter has an invisible `§§id§§` marker that a first PDF uses to find where it falls (needs `pdftotext`).
With every version that has visible changes, screenshots and PDFs are redone and the «What's new» chapter is updated.
