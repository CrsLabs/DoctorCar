// Le correzioni della 2.2.1 (dalle prove sul campo): Indietro durante la ricerca, sezioni e finestre che ripartono dall'alto,
// Home a due colonne sul tablet, posizione riletta da sola tornando dalle impostazioni.
// Uso: (python3 -m http.server 8786 --bind 127.0.0.1 &) ; node prove/novita221.js
const { chromium, devices } = require('playwright');
const dati = require('../guida/dati-esempio')();
const URL = process.argv[2] || 'http://127.0.0.1:8786/sorgente-DoctorCar.html';
let ok = 0, ko = 0;
const esito = (n, c, i = '') => { if (c) ok++; else ko++; console.log((c ? '  ✓ ' : '  ✗ ') + n + (i ? ' — ' + i : '')); };
(async () => {
  const b = await chromium.launch();
  const nuova = async (opz) => {
    const ctx = await b.newContext(Object.assign({ locale: 'it-IT' }, opz));
    await ctx.addInitScript(d => { if (!sessionStorage.getItem('__f')) { sessionStorage.setItem('__f', '1'); localStorage.clear(); for (const k in d) localStorage.setItem(k, d[k]); } }, dati);
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.goto(URL); await p.waitForTimeout(1500); p.err = err; return p;
  };
  let p = await nuova({ ...devices['Pixel 7'] });
  const C = (n, ...a) => p.evaluate(([n, a]) => DC.COMANDI[n](...a), [n, a]);
  console.log('▶ Ricerca e Indietro');
  await p.fill('#cercaHome', 'gomme'); await p.waitForTimeout(300);
  esito('cercando, la pagina è «dentro» (Indietro non esce)', await p.evaluate(() => window.__indietroNativo() === true));
  await p.waitForTimeout(200);
  esito('Indietro svuota la ricerca e torna alla Home', await p.evaluate(() => document.getElementById('cercaHome').value === '' && !document.getElementById('homeContenuto').classList.contains('hidden')));
  esito('un secondo Indietro esce dall\'app (non c\'è più niente da chiudere)', await p.evaluate(() => window.__indietroNativo() === false));
  await p.fill('#cercaHome', 'bollo'); await p.waitForTimeout(300); await p.goBack(); await p.waitForTimeout(400);
  esito('anche il gesto Indietro del browser svuota la ricerca senza uscire', await p.evaluate(() => document.getElementById('cercaHome').value === '') && /sorgente-DoctorCar/.test(p.url()));
  console.log('▶ Si riparte dall\'alto');
  for (const v of ['interventi', 'scadenze', 'rifornimenti', 'spese']) {
    await C('vai', v); await p.evaluate(() => scrollTo(0, 700)); await p.waitForTimeout(150); await C('vai', v); await p.waitForTimeout(700);
    esito(`toccando di nuovo «${v}» si torna in cima`, await p.evaluate(() => scrollY) === 0);
  }
  await C('vai', 'home');
  await C('apriVeicolo', 'panda01'); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('#finScheda .foglio').scrollTop = 600); await p.evaluate(() => window.__indietroNativo()); await p.waitForTimeout(500);
  await C('apriVeicolo', 'panda01'); await p.waitForTimeout(400);
  esito('una finestra riaperta riparte dall\'alto', await p.evaluate(() => document.querySelector('#finScheda .foglio').scrollTop) === 0);
  await p.evaluate(() => window.__indietroNativo()); await p.waitForTimeout(400);
  await p.evaluate(() => DC.COMANDI.apriImpostazioni()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-click="apriSegnalazione()"]') && document.querySelector('[data-click="apriSegnalazione()"]').click()); await p.waitForTimeout(500);
  const fb = await p.$('#fbVediBtn');
  if (fb) {
    await p.evaluate(() => document.getElementById('fbVediBtn').click()); await p.waitForTimeout(200);
    await p.evaluate(() => { for (let i = 0; i < 4 && DC.pila.length; i++) window.__indietroNativo(); }); await p.waitForTimeout(500);
    await p.evaluate(() => { DC.COMANDI.apriImpostazioni(); document.querySelector('[data-click="apriSegnalazione()"]').click(); }); await p.waitForTimeout(500);
    esito('«Vedi tutto quello che viene inviato» riaperta è di nuovo chiusa', await p.evaluate(() => document.getElementById('fbAnteprima').classList.contains('hidden') && document.getElementById('fbVediBtn').getAttribute('aria-expanded') === 'false' && /Vedi tutto/.test(document.getElementById('fbVediBtn').textContent)));
  }
  console.log('▶ Posizione: prima veloce, poi affinata con il GPS');
  await p.evaluate(() => { for (let i = 0; i < 6 && DC.pila.length; i++) window.__indietroNativo(); });
  await p.evaluate(() => { window.__chiesteP = []; window.__posizione = async o => { window.__chiesteP.push(o || {}); if (o && o.preciso) { await new Promise(r => setTimeout(r, 300)); window.__posizioneMigliore && window.__posizioneMigliore({ lat: 45.8082, lon: 9.0852, precisione: 31 }); await new Promise(r => setTimeout(r, 500)); return { lat: 45.80812, lon: 9.08521, precisione: 6 }; } return { lat: 45.8085, lon: 9.0849, precisione: 85 }; }; });
  await p.evaluate(() => DC.COMANDI.apriPosizione()); await p.waitForTimeout(250);
  esito('la prima lettura (poco precisa) compare subito e si può già salvare', /85 m/.test(await p.locator('#posCorpo').textContent()) && await p.locator('#posCorpo [data-click="salvaPosizione()"]').count() === 1);
  await p.waitForTimeout(900);
  esito('nessun affinamento automatico: il GPS non viene chiesto da solo', (await p.evaluate(() => window.__chiesteP.filter(o => o.preciso).length)) === 0 && !/Cerco una lettura/.test(await p.locator('#posCorpo').textContent()));
  await p.fill('#posNota', 'Piano -2');
  await p.evaluate(() => { window.__notaEl = document.getElementById('posNota'); window.__bloccoEl = document.getElementById('posBlocco'); });
  await p.evaluate(() => document.getElementById('posAggiorna').click()); await p.waitForTimeout(150);
  esito('premuto «Aggiorna la posizione»: il tasto dice «Cerco…» ed è spento', /Cerco/.test(await p.locator('#posAggiorna').textContent()) && await p.locator('#posAggiorna').isDisabled());
  await p.waitForTimeout(300);
  esito('una lettura migliore (31 m) cambia solo i numeri', /31 m/.test(await p.locator('#posCorpo').textContent()));
  await p.waitForTimeout(900);
  esito('alla fine resta la migliore (6 m, buona) e lo dice', /6 m/.test(await p.locator('#posCorpo').textContent()) && /buona/.test(await p.locator('#posCorpo').textContent()) && /Posizione migliorata/.test(await p.locator('#posCorpo').textContent()));
  esito('la finestra NON è stata ridisegnata: nota e riquadro sono gli stessi, la nota resta scritta', await p.evaluate(() => window.__notaEl === document.getElementById('posNota') && window.__bloccoEl === document.getElementById('posBlocco') && document.getElementById('posNota').value === 'Piano -2'));
  esito('al GPS si chiede la lettura precisa una volta sola (solo con il tasto)', (await p.evaluate(() => window.__chiesteP.filter(o => o.preciso).length)) === 1);
  await p.evaluate(() => { window.__posizione = async o => { await new Promise(r => setTimeout(r, 200)); return { lat: 45.8, lon: 9.08, precisione: 40 }; }; });
  await p.evaluate(() => document.getElementById('posAggiorna').click()); await p.waitForTimeout(600);
  esito('se la nuova lettura è peggiore si tiene quella di prima e lo dice', /6 m/.test(await p.locator('#posCorpo').textContent()) && /tengo quella di prima/.test(await p.locator('#posCorpo').textContent()));
  await p.evaluate(() => window.__indietroNativo()); await p.waitForTimeout(300);
  await p.evaluate(() => DC.COMANDI.apriPosizione()); await p.waitForTimeout(400);
  await p.evaluate(() => { window.__posizione = async () => ({ lat: 45.8, lon: 9.08, precisione: 1500, approssimata: true }); });
  await p.evaluate(() => { window.__indietroNativo(); }); await p.waitForTimeout(300); await p.evaluate(() => DC.COMANDI.apriPosizione()); await p.waitForTimeout(400);
  esito('con la sola posizione approssimativa spiega come dare quella precisa', /approssimativa/.test(await p.locator('#posCorpo').textContent()));
  await p.evaluate(() => window.__indietroNativo()); await p.waitForTimeout(300);
  esito('nessun errore in pagina (telefono)', !p.err.length, p.err.join(' | '));
  await p.context().close();
  console.log('▶ Home sul tablet');
  for (const [w, h] of [[800, 1280], [1280, 800]]) {
    p = await nuova({ viewport: { width: w, height: h }, hasTouch: true });
    const r = await p.evaluate(() => { const a = document.getElementById('homeScadenze').getBoundingClientRect(), v = document.getElementById('homeVeicoli').getBoundingClientRect(); return { stessaRiga: Math.abs(a.top - v.top) < 80, affiancati: v.left > a.right - 2, largo: document.documentElement.scrollWidth <= innerWidth }; });
    esito(`tablet ${w}×${h}: scadenze e veicoli affiancati, niente che sborda`, r.affiancati && r.largo, JSON.stringify(r));
    esito(`tablet ${w}×${h}: nessun errore`, !p.err.length, p.err.join(' | '));
    await p.context().close();
  }
  p = await nuova({ ...devices['Pixel 7'] });
  const r = await p.evaluate(() => { const a = document.getElementById('homeScadenze').getBoundingClientRect(), v = document.getElementById('homeVeicoli').getBoundingClientRect(); return v.top > a.bottom; });
  esito('telefono: la Home resta in una colonna', r);
  await p.context().close();
  await b.close();
  console.log(`\nNovità 2.2.1: ${ok} riuscite, ${ko} fallite`); process.exit(ko ? 1 : 0);
})();
