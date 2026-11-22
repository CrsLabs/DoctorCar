// Dati «avvelenati»: in ogni campo di testo (anche lista per il meccanico e magazzino) c'è dell'HTML con codice.
// Niente deve prendere vita: nessun elemento iniettato, nessun codice eseguito, nessun errore.
// Uso: (python3 -m http.server 8786 --bind 127.0.0.1 &) ; node prove/veleno.js
const { chromium, devices } = require('playwright');
const base = require('../guida/dati-esempio')();
const V = '"><img src=x onerror="window.__veleno=1"><b id=iniettato>x</b>\'';
const D = JSON.parse(base.doctorcar_dati);
for (const c of Object.keys(D)) for (const r of D[c]) for (const k of Object.keys(r)) if (typeof r[k] === 'string' && !['id', 'dev', 'veicolo', 'voce', 'data', 'tipo', 'alimentazione', 'stato', 'dot', 'ultimaData', 'prossimaData', 'immatricolazione', 'montataData', 'fattoIl'].includes(k)) r[k] = (r[k] || '') + V;
base.doctorcar_dati = JSON.stringify(D); base.doctorcar_chi = 'Anna' + V;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'it-IT' });
  await ctx.addInitScript(d => { if (!sessionStorage.getItem('__f')) { sessionStorage.setItem('__f', '1'); localStorage.clear(); for (const k in d) localStorage.setItem(k, d[k]); } }, base);
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto('http://127.0.0.1:8786/sorgente-DoctorCar.html'); await p.waitForTimeout(1500);
  const C = (n, ...a) => p.evaluate(([n, a]) => DC.COMANDI[n](...a), [n, a]);
  const chiudi = () => p.evaluate(() => { for (let i = 0; i < 6 && DC.pila.length; i++) window.__indietroNativo(); });
  for (const v of ['home', 'interventi', 'scadenze', 'rifornimenti', 'spese', 'veicoli', 'magazzino']) { await C('vai', v); await p.waitForTimeout(300); }
  for (const id of ['panda01', 'golf01']) { await C('apriVeicolo', id); await p.waitForTimeout(400); await chiudi(); await p.waitForTimeout(300); }
  await C('vai', 'magazzino'); await p.waitForTimeout(300);
  const sc = await p.evaluate(() => DC.vivi('scorte').map(s => s.id));
  for (const id of sc) { await C('modificaScorta', id); await p.waitForTimeout(300); await chiudi(); await p.waitForTimeout(300); }
  const ap = await p.evaluate(() => DC.vivi('appunti').map(s => s.id));
  for (const id of ap) { await C('modificaAppunto', id); await p.waitForTimeout(300); await chiudi(); await p.waitForTimeout(300); }
  await C('nuovoInterventoPer', 'panda01'); await p.waitForTimeout(400); await p.click('#m_voci [data-voce="olio"]'); await p.click('#moduloSalva'); await p.waitForTimeout(1200);
  await chiudi(); await p.waitForTimeout(300);
  await C('vai', 'home'); await p.fill('#cercaHome', 'olio'); await p.waitForTimeout(400); await p.fill('#cercaHome', '');
  const ris = await p.evaluate(() => ({ eseguito: !!window.__veleno, iniettati: document.querySelectorAll('#iniettato, img[src="x"]').length }));
  const t = await p.evaluate(() => DC.testoOfficina(DC.veicoli()[0]));
  console.log(ris, err);
  const ok = !ris.eseguito && !ris.iniettati && !err.length && t.includes('<b id=iniettato>');
  console.log(ok ? 'Veleno: nessun codice ha preso vita' : 'Veleno: PROBLEMA');
  await b.close(); process.exit(ok ? 0 : 1);
})();
