# DoctorCar: istruzioni per chi sviluppa

## Come è fatta
- `sorgente-DoctorCar.html`: tutta l'app (HTML, stile, script) in un file. Si apre anche dal PC come pagina web.
- `piattaforma-android.js`: il livello Android (file, vibrazione, notifiche, sincronizzazione PairWood, aggiornamenti). `prepara.py` lo aggiunge alla pagina e scrive `www/index.html` per Capacitor.
- `android/`: progetto Android (Capacitor 8). Codice nativo in `android/app/src/main/java/it/doctorcar/app/`. SDK PairWood già compilato in `android/pairwood-sdk`.
- Regola di sicurezza della pagina (CSP): `connect-src 'none'`, solo script con impronta sha256. **Dopo ogni modifica alla pagina: `python3 prepara.py`** (ricalcola le impronte).
- I comandi dei pulsanti passano dall'oggetto `COMANDI` (`data-click`, `data-change`): niente codice scritto nell'HTML.
- Ogni dato in entrata viene ripulito (`SCHEMI`, `pulisciTutto`); ogni dato mostrato passa da `esc()`.

## Compilare
```
npm install
python3 prepara.py
npx cap sync android
cd android && ./gradlew assembleRelease
```
Minimo **Android 10 (API 29)**. applicationId **`it.doctorcar.app`**: non cambiarlo, o per Android è un'altra app.
A ogni versione: `versionCode`/`versionName` in `android/app/build.gradle` e `VERSIONE` nella pagina.

**Firma**: la chiave non è nel repository (cartella `firma/`, esclusa da `.gitignore`, con `firma/firma.properties`: `storeFile`, `storePassword`, `keyAlias`, `keyPassword`). Gli aggiornamenti si installano solo con la stessa chiave: chi la custodisce non deve perderla mai. Impronta SHA-256 del certificato ufficiale: `32f168382e3ce2f751ef551bea31515de2ec86288eb83e45264e54b89bd374d2`.

## Prove
Le prove usano Playwright con Chromium. Server: `python3 -m http.server 8786` dalla cartella del progetto e `python3 -m http.server 8785` dalla cartella `www`. Istruzioni in `prove/LEGGIMI-PROVE.md`. Le principali: `node prove/robot.js` (preme tutti i tasti), `node prove/layout.js` (impaginazione; con `INGLESE=1` in inglese), `node prove/inglese.js`, `node prove/veleno.js` (dati malevoli), `node prove/aggiornamenti.js`.

## Inglese
La pagina è scritta in italiano; in inglese i testi mostrati si traducono al volo con la tabella di `lingua/inglese.txt` (una riga per frase: italiano, freccia, inglese; `#` numero, `@` nome scritto da chi usa l'app, `«@»` nome tra «», `§` data o mese, `*` inizio di frase; le righe `@@` traducono i nomi dei tasti citati tra «»). Dopo ogni modifica: `python3 lingua/applica.py` e `python3 prepara.py`. **Ogni testo nuovo va aggiunto**: `INGLESE=/tmp/x.json node prove/robot.js` e `RACCOLTA=/tmp/x.json node prove/inglese.js` raccolgono quelli senza traduzione. La parte Android usa `Testi.java` e `res/values-en`.

## Pubblicare una versione
1. Compila e firma l'APK (la firma si fa fuori da GitHub: le chiavi non vanno mai nel repository).
2. Aggiorna `rilasci/aggiornamento.json` (`versionCode`, `versione`, `apk`, `sha256` dell'APK, `novita`).
3. Sul ramo **`rilasci`** (separato dal codice: contiene solo l'automazione, l'APK e `aggiornamento.json`) togli l'APK vecchio, metti quello nuovo e il nuovo `aggiornamento.json`, e carica.
4. L'automazione `.github/workflows/rilascio.yml` di quel ramo controlla l'impronta dell'APK e crea da sola la Release `vX.Y.Z` con i due file.
Le app installate la trovano da sole entro una settimana (`Aggiornamento.java`: solo https da GitHub, impronta SHA-256, stesso pacchetto, versione più nuova, stessa firma). In alternativa la Release si può sempre creare a mano dal sito, allegando gli stessi due file.

## Guida e tutorial
Quattro PDF: guida e tutorial, in italiano e in inglese (`guida/guida.html`, `guida/tutorial.html`, `guida/guide-en.html`, `guida/tutorial-en.html`, stile comune in `guida/stile-guida.css`). Stesse sei parti in tutti e quattro.
1. Schermate: dalla pagina dell'app (`www`, server sulla porta 8785) con `node guida/schermate.js` (in `guida/img`) e `node guida/schermate.js en` (in `guida/img-en`, con l'app e i dati d'esempio in inglese).
2. PDF: `node guida/genera-guida.js` (tutti e quattro; oppure `guida it`, `tutorial en`…). L'indice prende da solo i numeri di pagina: ogni capitolo ha un segno invisibile `§§id§§` che un primo PDF usa per sapere dove cade (serve `pdftotext`).
A ogni versione con novità visibili si rifanno schermate e PDF e si aggiorna il capitolo «Novità».
