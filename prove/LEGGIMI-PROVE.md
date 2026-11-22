# Prove automatiche di DoctorCar

Servono Node e Playwright (con Chromium). Prima si avviano due server locali, dalla cartella del progetto:

```
python3 prepara.py
python3 -m http.server 8786 --bind 127.0.0.1 &          # pagina web (sorgente-DoctorCar.html)
python3 -m http.server 8785 --bind 127.0.0.1 -d www &   # pagina dell'app Android (www/index.html)
```

| Prova | Cosa fa | Comando |
|---|---|---|
| `scenari.js` | Percorso da utente vero, solo tocchi: primo avvio, auto con piano di base, interventi (anche senza voce: rifiutato), rifornimenti e consumo, «Km», scadenze (revisione dall'immatricolazione, «Fatto», nuova scadenza), spese dell'anno, Indietro, copia cifrata andata e ritorno (password corta, sbagliata, «Unisci»), tema, dati avvelenati. | `node prove/scenari.js` |
| `diretta.js` | Sincronizzazione **diretta** (PairWood simulato) fra tre telefoni (anche delle foto, che viaggiano cifrate): codice e QR, codice sbagliato, abbinamento, dati e cancellazioni nei due sensi, file cifrati, terzo dispositivo presentato, elenco, «Dimentica», «Scollega». | `node prove/diretta.js` |
| `foto.js` | Foto delle fatture: aggiungere (ridotte, con miniatura), visore e zoom, togliere, «Butta via», file sbagliati, limite di 12, copia di sicurezza con le foto (anche le copie vecchie), eliminare l'intervento, dati avvelenati. | `node prove/foto.js` |
| `promemoria.js` | Avvisi sulle scadenze nell'app Android simulata: domanda della prima volta, permessi negati, cosa viene consegnato ad Android (date, ore, testi), anticipo e ora, scadenze passate e a km, «Da completare», spegnere. | `node prove/promemoria.js` |

| `blocco.js` | Blocco con impronta simulata: all'apertura, annullata e riprovata, uscire e rientrare, uscite chieste dall'app (salvataggio, galleria), 10 minuti fuori, impostazione (spegnere e riaccendere), richiesta prima di esportare, importare e cancellare, telefono senza impronta né PIN. | `node prove/blocco.js` |
| `aspetto.js` | Apertura con il logo (accese e spente le animazioni, nelle prove e sul PC), dimensione del testo (nell'app e sul PC), fluidità dello schermo (60 Hz, Massima, Automatica, animazioni spente), vibrazione (intensità, tre tipi, a raffica, spenta). | `node prove/aspetto.js` |
| `layout.js` | Impaginazione su 5 misure di schermo (da 320 px al PC), con testo Normale, Grande e Molto grande (nell'app lo zoom di Android è simulato), etichette della barra mai sotto gli 11 px, nella pagina web e nell'app: nelle finestre (Impostazioni con tutte le sezioni aperte, nuovo intervento) i blocchi non si schiacciano né si sovrappongono, nessuna pagina sborda di lato. | `node prove/layout.js` |
| `logica.js` | Calcoli e difetti già corretti: scadenze rinnovate in anticipo o in ritardo, km di un'auto nuova, «Indietro» a raffica che non deve far uscire dalla pagina. | `node prove/logica.js` |
| `novita.js` | Le novità della 2.0: barra solo in Home e un po' più alta, tasti di ogni sezione, targa maiuscola e tastiera, auto con i dati importanti (scadenze già complete), gomme invernali, litri/prezzo/importo, previsione spese, avvisi in Home, importazione CSV (Fuelio, Drivvo), «chi», libretto e foglio officina; nell'app simulata: «Fatto oggi» e km dalle notifiche, scorciatoie, widget, calendario, PDF e condivisione, copia automatica. | `node prove/novita.js` |
| `novita21.js` | Le novità della 2.1 e seguenti (anche: scorrimento con il dito, menu che ripartono dall'alto, Impostazioni con le sezioni chiuse, ricerca, Home, segnalazione, «Dove sei», cambio di tema morbido): bollo proposto, tolleranza dell'assicurazione, revisione a fine mese, documenti (patente rinnovata, garanzia), controlli veloci, grafico del consumo con il pieno anomalo, gomme (km, età dal DOT, scambio automatico), budget, spese veloci e multa con lo sconto; nell'app simulata: posizione, «Portami lì», sosta con gli avvisi, permesso negato, «Tutto a posto» dalla notifica. | `node prove/novita21.js` |
| `novita221.js` | Le correzioni della 2.2.1: Indietro durante la ricerca (svuota, non esce), sezioni e finestre che ripartono dall'alto (anche toccando di nuovo la sezione), parti aperte richiuse, Home a due colonne sul tablet (800 e 1280 px) e una sul telefono. | `node prove/novita221.js` |
| `robot.js` | Preme **tutti** i tasti di ogni sezione e finestra (circa 900), nella pagina web e nell'app simulata, rispondendo «No» alle domande distruttive: segnala errori, finestre che Indietro non chiude, tasti non premibili e pagine che sbordano. Dura una decina di minuti (`PROGRESSO=1` per vederlo avanzare). | `node prove/robot.js` |

Esito atteso: 0 fallite, nessun errore in pagina. I risultati (schermate, copia d'esempio) vanno in `prove/risultati/` (fuori da git).
