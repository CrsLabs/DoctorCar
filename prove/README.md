# DoctorCar automated tests

You need Node and Playwright (with Chromium). First start two local servers, from the project folder:

```
python3 prepara.py
python3 -m http.server 8786 --bind 127.0.0.1 &          # web page (sorgente-DoctorCar.html)
python3 -m http.server 8785 --bind 127.0.0.1 -d www &   # Android app page (www/index.html)
```

| Test | What it does | Command |
|---|---|---|
| `scenari.js` | A real user's path, taps only: first start, car with a basic plan, jobs (also with no item: refused), fill-ups and consumption, «Km», due dates (inspection from registration, «Done», new due date), year's expenses, Back, encrypted backup there and back (short password, wrong password, «Merge»), theme, poisoned data. | `node prove/scenari.js` |
| `diretta.js` | **Direct** sync (simulated PairWood) between three phones (photos too, travelling encrypted): code and QR, wrong code, pairing, data and deletions both ways, encrypted files, third device introduced, list, «Forget», «Disconnect». | `node prove/diretta.js` |
| `foto.js` | Invoice photos: adding (reduced, with thumbnail), viewer and zoom, removing, «Discard», wrong files, limit of 12, backup with photos (old backups too), deleting the job, poisoned data. | `node prove/foto.js` |
| `promemoria.js` | Due-date reminders in the simulated Android app: first-time question, denied permissions, what is handed to Android (dates, times, texts), advance and time, past and km-based due dates, «To complete», turning off. | `node prove/promemoria.js` |
| `blocco.js` | Simulated fingerprint lock: on opening, cancelled and retried, leaving and returning, exits requested by the app (saving, gallery), 10 minutes away, setting (off and on again), request before export, import and erase, phone with no fingerprint or PIN. | `node prove/blocco.js` |
| `aspetto.js` | Opening with the logo (animations on and off, in tests and on PC), text size (app and PC), screen smoothness (60 Hz, Maximum, Automatic, animations off), vibration (strength, three types, bursts, off). | `node prove/aspetto.js` |
| `layout.js` | Layout on 5 screen sizes (from 320 px to PC), with Normal, Large and Very large text (Android zoom simulated in the app), bar labels never under 11 px, in the web page and in the app: in windows (Settings with every section open, new job) blocks don't squash or overlap, no page overflows sideways. `INGLESE=1` for English. | `node prove/layout.js` |
| `logica.js` | Calculations and bugs already fixed: due dates renewed early or late, km of a new car, repeated «Back» that must not leave the page. | `node prove/logica.js` |
| `inglese.js` | The app in English: every main screen and window with the sample data, no Italian left in the visible texts; then «Italiano» brings everything back. | `node prove/inglese.js` |
| `aggiornamenti.js` | Updates from GitHub (simulated app): Settings section, «Check now», «Update», weekly question and «Later», check turned off. | `node prove/aggiornamenti.js` |
| `novita.js` | The 2.0 features: bar only on the Home, buttons of each section, upper-case plate and keyboard, car with the important details, winter tyres, litres/price/amount, expense forecast, Home alerts, CSV import (Fuelio, Drivvo), «who», logbook and garage sheet; in the simulated app: «Done today» and km from notifications, shortcuts, widget, calendar, PDF and sharing, automatic backup. | `node prove/novita.js` |
| `novita21.js` | The 2.1+ features: road tax suggested, insurance grace, inspection at month end, documents, quick checks, consumption chart, tyres (km, age from DOT, automatic swap), budget, quick expenses and fines with discount; in the simulated app: location, «Take me there», timed parking, denied permission, «All fine» from the notification. | `node prove/novita21.js` |
| `novita221.js` | The 2.2.1 fixes: Back during search, sections and windows that restart from the top, Home in two columns on tablets (800 and 1280 px) and one on phones. | `node prove/novita221.js` |
| `novita23.js` | The 2.3 features: list for the mechanic (also on the garage sheet), spare parts in the garage for each car with «To buy again», stock with shopping list, «While you're at it» after a job, trip cost. | `node prove/novita23.js` |
| `veleno.js` | «Poisoned» data with HTML in every field: nothing must come to life. | `node prove/veleno.js` |
| `robot.js` | Presses **every** button of every section and window (about 900), in the web page and in the simulated app, answering «No» to destructive questions: reports errors, windows Back doesn't close, buttons that can't be pressed and pages that overflow. Takes about ten minutes (`PROGRESSO=1` to watch it progress). | `node prove/robot.js` |
| `notifiche.js` | Messages appear at the bottom, just above the bar, and close by swiping them sideways or down (web page and app, animations on and off). | `node prove/notifiche.js` |

Expected result: 0 failed, no errors in the page. Results (screenshots, sample backup) go to `prove/risultati/` (not in git).
