# Pubblicare una versione

Gli APK da installare non stanno in questa cartella ma nelle **[Releases](../../../releases)** del repository.

Per pubblicare una versione nuova:
1. Compila e firma l'APK (vedi `SVILUPPO.md`).
2. Aggiorna `aggiornamento.json` qui accanto: `versionCode`, `versione`, nome dell'`apk`, la sua impronta `sha256` e le `novita`.
3. Su GitHub: **Releases → Draft a new release**, etichetta `vX.Y.Z`, e allega **due file**: l'APK e `aggiornamento.json`.

Le copie di DoctorCar già installate trovano la versione nuova da sole entro una settimana
(o subito con Impostazioni → Aggiornamenti → «Controlla adesso») e la installano dopo la conferma di Android.
