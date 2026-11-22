// Scatta le schermate di DoctorCar per la guida (guida/img/*.png), con i dati d'esempio di guida/dati-esempio.js.
// Uso (dalla cartella doctorcar): python3 prepara.py, poi un server sulla cartella www
//   (cd www && python3 -m http.server 8785 --bind 127.0.0.1 &)   poi   node guida/schermate.js   (in inglese: node guida/schermate.js en)
// Le schermate si fanno nella pagina dell'app (con un Android simulato), così si vedono anche le parti che ci sono solo nell'app.
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const EN = process.argv[2] === 'en';
const OUT = path.join(__dirname, EN ? 'img-en' : 'img'); fs.mkdirSync(OUT, { recursive: true });
const URL = process.argv[3] || 'http://localhost:8785/index.html';
const dati = require('./dati-esempio')(new Date(), EN ? 'en' : 'it');
dati.doctorcar_parcheggio = JSON.stringify({ veicolo: 'panda01', quando: Date.now() - 20 * 60000, lat: 45.8081, lon: 9.0852, prec: 8, scade: Date.now() + 40 * 60000, nota: EN ? 'Piazza Cavour, lake side' : 'Piazza Cavour, lato lago' });
dati.doctorcar_lingua = JSON.stringify(EN ? 'en' : 'it');
dati.doctorcar_aggiornamenti = JSON.stringify({ attivo: true, ultimo: Date.now() - 2 * 864e5 });
dati.doctorcar_promemoria = JSON.stringify({ attivo: true, chiesto: true, anticipo: 30, ora: 9, kmMensile: true, controlli: true });
// Android simulato: quanto basta perché la pagina mostri le parti dell'app
const MOCK = () => { window.Capacitor = { isNativePlatform: () => true, addListener: () => ({ remove() {}, then: f => f && f({ remove() {} }) }),
  nativePromise: (pl, m) => Promise.resolve(m === 'statoNotifiche' ? { concesso: true } : m === 'puoSbloccare' ? { ok: true, impronta: true } : m === 'programmaPromemoria' ? { programmati: 6 } : m === 'controllaAggiornamento' ? { installata: 24, nuova: false } : m === 'azioniInCoda' ? { azioni: [] } : {}) }; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 2, locale: EN ? 'en-GB' : 'it-IT', colorScheme: 'light' });
  await ctx.addInitScript(MOCK);
  await ctx.addInitScript(d => { if (!sessionStorage.getItem('__f')) { sessionStorage.setItem('__f', '1'); localStorage.clear(); for (const k in d) localStorage.setItem(k, d[k]); } }, dati);
  const p = await ctx.newPage(); await p.goto(URL); await p.waitForTimeout(2000);
  const foto = async n => { await p.waitForTimeout(700); await p.screenshot({ path: path.join(OUT, n + '.png') }); console.log('  ' + n); };
  const prova = async (n, f) => { try { await f(); } catch (e) { console.log('  ✗ ' + n + ': ' + e.message.split('\n')[0].slice(0, 140)); } };
  const C = (nome, ...a) => p.evaluate(([n, a]) => DC.COMANDI[n](...a), [nome, a]);
  const chiudi = () => p.evaluate(() => { for (let i = 0; i < 5 && DC.pila.length; i++) window.__indietroNativo ? window.__indietroNativo() : history.back(); });
  const vai = (v, n) => prova(n, async () => { await C('vai', v); await foto(n); });
  await prova('home', () => foto('01-home'));
  await prova('home-giu', async () => { await p.evaluate(() => window.scrollTo(0, 900)); await foto('02-home-sotto'); await p.evaluate(() => window.scrollTo(0, 0)); });
  await vai('interventi', '03-interventi');
  await vai('scadenze', '04-scadenze');
  await vai('rifornimenti', '05-rifornimenti');
  await vai('spese', '06-spese');
  await vai('veicoli', '07-veicoli');
  await prova('scheda', async () => { await C('apriVeicolo', 'panda01'); await foto('08-scheda-veicolo'); await chiudi(); });
  await prova('nuovo-intervento', async () => { await C('vai', 'home'); await C('nuovoIntervento'); await foto('09-nuovo-intervento'); await chiudi(); });
  await prova('nuovo-rifornimento', async () => { await C('nuovoRifornimento'); await foto('10-nuovo-rifornimento'); await chiudi(); });
  await prova('scadenza', async () => { const id = await p.evaluate(() => Object.values(DC.dati.scadenze).find(s => s.voce === 'bollo').id); await C('apriScadenza', id); await foto('11-scadenza'); await chiudi(); });
  await prova('nuovo-veicolo', async () => { await C('nuovoVeicolo'); await foto('12-nuovo-veicolo'); await chiudi(); });
  await prova('controlli', async () => { await C('apriControlli', 'panda01'); await foto('13-controlli'); await chiudi(); });
  await prova('spesa-veloce', async () => { await C('spesaVeloce', 'multa'); await foto('14-spesa-veloce'); await chiudi(); });
  await prova('meccanico', async () => { await C('apriVeicolo', 'panda01'); await p.evaluate(() => { const f = document.querySelector('#finScheda .foglio'); const e = [...document.querySelectorAll('#schedaCorpo .nota')].find(x => /meccanico|mechanic/i.test(x.textContent)); f.scrollTop = e.offsetTop - 90; }); await foto('18-meccanico-ricambi'); await chiudi(); });
  await prova('ricambi', async () => { await C('vai', 'magazzino'); await p.waitForTimeout(300); await foto('19-ricambi'); });
  await prova('viaggio', async () => { await C('vai', 'rifornimenti'); await C('costoViaggio'); await p.waitForTimeout(500); await p.evaluate(() => { const s = document.getElementById('m_veicolo'); if (s) s.value = 'panda01'; }); await p.fill('#m_km', '180'); await p.fill('#m_persone', '3'); await p.fill('#m_pedaggi', EN ? '14.60' : '14,60'); await foto('20-viaggio'); await p.click('#moduloSalva'); await foto('21-viaggio-risultato'); await p.click('#domandaSi'); await p.waitForTimeout(400); });
  await prova('impostazioni', async () => { await C('apriImpostazioni'); await foto('15-impostazioni'); await chiudi(); });
  await prova('ricerca', async () => { await C('vai', 'home'); await p.fill('#cercaHome', EN ? 'tyres' : 'gomme'); await foto('17-ricerca'); await p.fill('#cercaHome', ''); await p.evaluate(() => document.getElementById('cercaHome').dispatchEvent(new Event('input', { bubbles: true }))); });
  const impostazioniSu = async (cat, nome, sel) => { await C('apriImpostazioni'); await p.waitForTimeout(400); if (cat) await C('alternaCat', cat); await p.waitForTimeout(400); await p.evaluate(s => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: 'center' }); }, sel); await foto(nome); await chiudi(); };
  await prova('lingua', () => impostazioniSu('aspetto', '22-lingua', '#sceltaLingua'));
  await prova('aggiornamenti', () => impostazioniSu('aggiornamenti', '23-aggiornamenti', '#impAggiornamenti'));
  await prova('segnala', () => impostazioniSu('', '24-segnala-sostieni', '[data-click="apriSegnalazione()"]'));
  await prova('tema-scuro', async () => { await C('scegliTema', 'scuro'); await C('vai', 'home'); await foto('16-tema-scuro'); await C('scegliTema', 'auto'); });
  await b.close();
})();
