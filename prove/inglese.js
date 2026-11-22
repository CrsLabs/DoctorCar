// DoctorCar in inglese: con i dati d'esempio della guida si visitano tutte le schermate e le finestre principali e si controlla
// che nei testi mostrati non resti italiano; poi «Italiano» riporta tutto com'era (la pagina si ricarica).
// Uso: node prove/inglese.js   (server 8786 sulla cartella doctorcar)   ·   RACCOLTA=file.json salva i testi senza traduzione
const { chromium, devices } = require('playwright');
const fs = require('fs');
const URL = 'http://127.0.0.1:8786/sorgente-DoctorCar.html';
const dati = require('../guida/dati-esempio')();
// parole italiane che in un testo inglese non devono comparire
const ITALIANO = /[àèéìòù]|\b(il|lo|gli|di|del|della|delle|dei|degli|che|non|più|sono|nel|nella|anche|come|quando|solo|tutti|tutte|senza|dal|dalla|alla|uno|una|auto|veicolo|veicoli|scadenza|scadenze|intervento|interventi|rifornimento|rifornimenti|spese|tagliando|revisione|bollo|assicurazione|aggiungi|salva|chiudi|annulla|impostazioni|oggi|giorni|mese|anno|prossimo|prossima|ricambi|ricambio|gomme|pieno|officina|scegli|tocca)\b/i;
let ok = 0, ko = 0;
const esito = (n, c, info = '') => { if (c) ok++; else ko++; console.log((c ? '  ✓ ' : '  ✗ ') + n + (info ? ' — ' + info : '')); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'it-IT' });
  await ctx.addInitScript(d => {
    window.__nonTradotti = new Set();
    if (!sessionStorage.getItem('__f')) { sessionStorage.setItem('__f', '1'); localStorage.clear(); for (const k in d) localStorage.setItem(k, d[k]); localStorage.setItem('doctorcar_lingua', '"en"'); }
  }, dati);
  const P = await ctx.newPage();
  const errori = []; P.on('pageerror', e => errori.push(e.message));
  await P.goto(URL); await P.waitForTimeout(1500);
  const C = (n, ...a) => P.evaluate(([n, a]) => DC.COMANDI[n](...a), [n, a]);
  const chiudi = async () => { for (let i = 0; i < 6 && (await P.evaluate(() => DC.pila.length)); i++) { await P.keyboard.press('Escape'); await P.waitForTimeout(350); } };
  const nomi = await P.evaluate(() => { const n = new Set(); for (const c of Object.values(DC.dati)) for (const r of Object.values(c || {})) if (r && typeof r === 'object') for (const k of ['nome', 'testo', 'officina', 'descrizione', 'note', 'titolo', 'marca', 'modello', 'targa', 'luogo', 'distributore']) if (typeof r[k] === 'string' && r[k].length > 1) n.add(r[k]); return [...n]; });
  // i testi che si vedono adesso, senza i dati scritti da chi usa l'app
  const italiani = async () => {
    const testi = await P.evaluate(() => {
      const out = new Set(), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const el = n.parentElement; if (!el || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(el.tagName) || el.closest('[data-no-tr]')) continue;
        const r = el.getBoundingClientRect(), st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || (!r.width && !r.height)) continue;
        const t = n.data.trim(); if (t) out.add(t);
      }
      document.querySelectorAll('input[placeholder], [aria-label]').forEach(e => { const r = e.getBoundingClientRect(); if (r.width) { const t = e.getAttribute('placeholder') || e.getAttribute('aria-label'); if (t) out.add(t); } });
      return [...out];
    });
    return testi.map(t => { let x = t.replace(/Simply Auto/g, ''); for (const n of nomi) x = x.split(n).join(' '); return { t, x }; }).filter(o => ITALIANO.test(o.x)).map(o => o.t);
  };
  const controlla = async (nome, f) => {
    try { await f(); await P.waitForTimeout(500); const r = await italiani(); esito(nome, !r.length, r.slice(0, 6).join(' | ')); }
    catch (e) { ko++; console.log('  ✗ ' + nome + ' — ERRORE ' + e.message.split('\n')[0].slice(0, 160)); }
    await chiudi(); await P.waitForTimeout(300);
  };
  console.log('▶ Schermate');
  esito('la pagina è in inglese (lang=en)', await P.evaluate(() => document.documentElement.lang === 'en' && DC.inglese()));
  for (const v of ['home', 'interventi', 'scadenze', 'rifornimenti', 'spese', 'veicoli', 'magazzino']) await controlla(v, () => C('vai', v));
  console.log('▶ Finestre');
  await controlla('scheda dell\'auto', () => C('apriVeicolo', 'panda01'));
  await controlla('nuovo intervento', () => C('nuovoIntervento'));
  await controlla('nuovo rifornimento', () => C('nuovoRifornimento'));
  await controlla('nuova scadenza', () => C('nuovaScadenza'));
  await controlla('nuovo veicolo', () => C('nuovoVeicolo'));
  await controlla('ricambio', () => C('nuovaScorta'));
  await controlla('viaggio', async () => { await C('vai', 'rifornimenti'); await C('costoViaggio'); });
  await controlla('controlli veloci', () => C('apriControlli'));
  await controlla('impostazioni (tutte le sezioni aperte)', async () => { await C('apriImpostazioni'); for (const k of ['aspetto', 'vibrazione', 'sicurezza', 'avvisi', 'aggiornamenti', 'sinc', 'dati', 'info']) await P.evaluate(k => { const t = document.querySelector('[data-cat="' + k + '"]'); if (t && t.getAttribute('aria-expanded') !== 'true') DC.COMANDI.alternaCat(k); }, k).catch(() => {}); });
  await controlla('segnala un problema', () => C('apriSegnalazione'));
  await controlla('per l\'officina (testo)', async () => { const t = await P.evaluate(() => DC.Lrighe(DC.testoOfficina('panda01'))); await P.evaluate(t => { const d = document.createElement('pre'); d.id = '__prova'; d.textContent = t; document.body.appendChild(d); }, t); });
  await P.evaluate(() => { const d = document.getElementById('__prova'); if (d) d.remove(); });
  console.log('▶ Numeri e date');
  const home = await P.evaluate(() => document.body.innerText);
  esito('i mesi sono in inglese', /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(home) && !/\b\d{1,2} (gen|mag|giu|lug|ago|set|ott|dic) \d{4}/.test(home));
  esito('gli euro hanno il punto per i decimali', await P.evaluate(() => /\d\.\d\d €/.test(document.body.innerText) || !/\d,\d\d €/.test(document.body.innerText)));
  if (process.env.RACCOLTA) {
    const prima = fs.existsSync(process.env.RACCOLTA) ? JSON.parse(fs.readFileSync(process.env.RACCOLTA, 'utf8')) : [];
    fs.writeFileSync(process.env.RACCOLTA, JSON.stringify([...new Set([...prima, ...(await P.evaluate(() => [...window.__nonTradotti]))])].sort(), null, 1));
  }
  console.log('▶ Di nuovo in italiano');
  await P.evaluate(() => { window.__senzaRiavvio = 1; DC.COMANDI.vai('scadenze'); }); await P.waitForTimeout(300);
  await P.evaluate(() => DC.COMANDI.scegliLingua('it')); await P.waitForTimeout(800);
  esito('«Italiano» rimette tutto in italiano subito, senza riavviare', await P.evaluate(() => window.__senzaRiavvio === 1 && document.documentElement.lang === 'it' && !DC.inglese() && /Scadenze/.test(document.body.innerText) && !/Due dates|Settings/.test(document.body.innerText)));
  esito('in italiano le date tornano italiane', await P.evaluate(() => !/\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}/.test(document.body.innerText)));
  await P.evaluate(() => DC.COMANDI.scegliLingua('en')); await P.waitForTimeout(800);
  esito('«English» traduce subito, senza riavviare', await P.evaluate(() => window.__senzaRiavvio === 1 && DC.inglese() && /Due dates/.test(document.body.innerText) && /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(document.body.innerText)));
  const rimasti = await italiani();
  esito('dopo il cambio non resta italiano', !rimasti.length, rimasti.slice(0, 5).join(' | '));
  await P.evaluate(() => DC.COMANDI.scegliLingua('it')); await P.waitForTimeout(500);
  esito('nessun errore in pagina', !errori.length, errori.join(' | ').slice(0, 300));
  console.log(`\nInglese: ${ok} riusciti, ${ko} falliti`);
  await b.close();
  process.exit(ko ? 1 : 0);
})();
