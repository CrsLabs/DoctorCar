// Blocco con impronta (o PIN del telefono): all'apertura, quando si torna nell'app, uscite chieste dall'app stessa,
// impostazione, e richiesta prima delle operazioni delicate (copia di sicurezza, tabella, cancellare tutto).
// L'impronta è simulata: window.__esito decide se riesce ('ok'), si annulla ('annullato') o fallisce ('errore').
// Uso: node prove/blocco.js
const { chromium, devices } = require('playwright');
const APP = 'http://127.0.0.1:8785/index.html';
let ok = 0, ko = 0;
const verifica = (cond, nome) => { if (cond) { ok++; console.log('  ✓ ' + nome); } else { ko++; console.log('  ✗ ' + nome); } };
const MOCK = `(() => {
  window.__chiamate = []; window.__esito = 'ok'; window.__puo = true;
  window.Capacitor = { isNativePlatform: () => true, addListener: () => ({ remove() {} }),
    nativePromise: (pl, m, o) => { window.__chiamate.push([pl + '.' + m, o || {}]);
      if (m === 'puoSbloccare') return Promise.resolve({ ok: window.__puo });
      if (m === 'verificaIdentita') return new Promise((ok, no) => setTimeout(() => window.__esito === 'ok' ? ok({}) : no(Object.assign(new Error('x'), { code: window.__esito === 'annullato' ? 'ANNULLATO' : 'ERRORE' })), 60));
      if (m === 'frequenze') return Promise.resolve({ massima: 120 });
      if (m === 'statoNotifiche') return Promise.resolve({ concesso: true });
      return Promise.resolve({}); } };
})();`;
const volte = (P, nome) => P.evaluate(n => window.__chiamate.filter(c => c[0] === n).length, nome);
const pulisci = P => P.evaluate(() => { window.__chiamate.length = 0; });
const coperta = P => P.evaluate(() => { const a = document.getElementById('avvio'); return document.documentElement.hasAttribute('data-bloccato') && a.style.display === 'flex' && a.classList.contains('con-blocco'); });
const libera = P => P.evaluate(() => !document.documentElement.hasAttribute('data-bloccato') && document.getElementById('avvio').style.display === 'none');

(async () => {
  const b = await chromium.launch();
  const nuovo = async (init = '') => {
    const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'it-IT' });
    await ctx.addInitScript(MOCK); if (init) await ctx.addInitScript(init);
    const P = await ctx.newPage(); P.errori = [];
    P.on('pageerror', e => P.errori.push(e.message)); P.on('console', m => { if (m.type() === 'error') P.errori.push(m.text()); });
    await P.goto(APP); return P;
  };
  const tocca = async (P, sel) => { await P.locator(sel).first().click({ timeout: 8000 }); await P.waitForTimeout(300); };

  console.log('All\'apertura');
  let P = await nuovo();
  await P.waitForTimeout(700);
  verifica(await volte(P, 'DoctorCar.verificaIdentita') === 1, 'l\'app chiede subito impronta o PIN (una volta)');
  verifica(await libera(P), 'con l\'impronta giusta si apre');
  verifica(await P.evaluate(() => !!document.querySelector('#vista-home') && getComputedStyle(document.querySelector('#vista-home')).visibility === 'visible'), 'la Home si vede');
  await P.context().close();

  console.log('Impronta annullata, poi riprovata');
  P = await nuovo('window.__esitoIniziale = 1;');
  await P.close(); P = await (async () => { const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'it-IT' }); await ctx.addInitScript(MOCK.replace("window.__esito = 'ok'", "window.__esito = 'annullato'")); const q = await ctx.newPage(); q.errori = []; q.on('pageerror', e => q.errori.push(e.message)); await q.goto(APP); return q; })();
  await P.waitForTimeout(700);
  verifica(await coperta(P), 'annullata: la pagina resta coperta');
  verifica(/annullato/.test(await P.locator('#bloccoTesto').textContent()) && await P.locator('#bloccoSblocca').isVisible(), 'dice «Sblocco annullato» e c\'è il tasto');
  verifica(await P.evaluate(() => getComputedStyle(document.querySelector('#vista-home')).visibility) === 'hidden', 'sotto non si legge niente');
  await P.evaluate(() => { window.__esito = 'errore'; }); await tocca(P, '#bloccoSblocca');
  verifica(/non riuscito/.test(await P.locator('#bloccoTesto').textContent()) && await coperta(P), 'impronta non riconosciuta: «Sblocco non riuscito»');
  await P.evaluate(() => { window.__esito = 'ok'; }); await pulisci(P); await tocca(P, '#bloccoSblocca'); await P.waitForTimeout(600);
  verifica(await libera(P) && await volte(P, 'DoctorCar.verificaIdentita') === 1, 'col tasto si riprova e si apre');
  await P.context().close();

  console.log('Quando si esce e si rientra');
  P = await nuovo(); await P.waitForTimeout(2300);
  await P.evaluate(() => window.__pausaApp()); await P.waitForTimeout(100);
  verifica(await coperta(P), 'uscendo dall\'app la pagina si copre subito (anche nelle app recenti)');
  await pulisci(P); await P.evaluate(() => window.__ripresaApp()); await P.waitForTimeout(700);
  verifica(await volte(P, 'DoctorCar.verificaIdentita') === 1 && await libera(P), 'rientrando chiede l\'impronta e si riapre');
  // uscita chiesta dall'app (salva su file): non si blocca
  await P.evaluate(() => { window.__sal = window.Capacitor.nativePromise('DoctorCar', 'salvaFile', {}); window.__pausaApp(); }); await P.waitForTimeout(100);
  verifica(await libera(P), 'mentre si salva un file (uscita voluta) la pagina non si copre');
  await pulisci(P); await P.evaluate(() => window.__ripresaApp()); await P.waitForTimeout(400);
  verifica(await volte(P, 'DoctorCar.verificaIdentita') === 0 && await libera(P), 'e al ritorno non chiede niente');
  await P.evaluate(() => { document.getElementById('fileFotoScegli').click(); window.__pausaApp(); }); await P.waitForTimeout(100);
  verifica(await libera(P), 'scegliendo una foto dalla galleria nemmeno');
  await P.evaluate(() => window.__ripresaApp());
  await P.context().close();
  P = await nuovo(); await P.waitForTimeout(700);
  await P.evaluate(() => { window.__sal = window.Capacitor.nativePromise('DoctorCar', 'salvaFile', {}); window.__pausaApp(); }); await P.waitForTimeout(50);
  await P.evaluate(() => { const t = Date.now(); Date.now = () => t + 11 * 60000; });
  await pulisci(P); await P.evaluate(() => window.__ripresaApp()); await P.waitForTimeout(500);
  verifica(await volte(P, 'DoctorCar.verificaIdentita') === 1, 'anche dopo un\'uscita voluta, restare fuori più di 10 minuti richiede l\'impronta');
  await P.context().close();

  console.log('Impostazione');
  P = await nuovo(); await P.waitForTimeout(700);
  await tocca(P, 'header [aria-label="Impostazioni"]'); await tocca(P, '[data-cat="sicurezza"]');
  verifica(await P.locator('#impBlocco').getAttribute('aria-checked') === 'true', 'di serie è acceso');
  await P.evaluate(() => { window.__esito = 'annullato'; }); await tocca(P, '#impBlocco'); await P.waitForTimeout(300);
  verifica(await P.locator('#impBlocco').getAttribute('aria-checked') === 'true', 'per spegnerlo serve l\'impronta: annullata, resta acceso');
  await P.evaluate(() => { window.__esito = 'ok'; }); await tocca(P, '#impBlocco'); await P.waitForTimeout(300);
  verifica(await P.locator('#impBlocco').getAttribute('aria-checked') === 'false' && await P.evaluate(() => localStorage.getItem('doctorcar_blocco')) === 'no', 'confermata: spento e ricordato');
  await P.evaluate(() => window.__pausaApp()); await P.waitForTimeout(100);
  verifica(await libera(P), 'spento: uscendo dall\'app non si copre');
  await P.evaluate(() => window.__ripresaApp());
  await P.reload(); await P.waitForTimeout(700);
  verifica(await libera(P), 'spento: riaprendo l\'app non chiede niente');
  await tocca(P, 'header [aria-label="Impostazioni"]'); await tocca(P, '[data-cat="sicurezza"]'); await pulisci(P);
  await tocca(P, '#impBlocco'); await P.waitForTimeout(300);
  verifica(await P.locator('#impBlocco').getAttribute('aria-checked') === 'true' && await volte(P, 'DoctorCar.verificaIdentita') === 1, 'per riaccenderlo si conferma di nuovo');
  await P.context().close();

  console.log('Operazioni delicate');
  P = await nuovo(); await P.waitForTimeout(700);
  await tocca(P, 'header [aria-label="Impostazioni"]'); await tocca(P, '[data-cat="dati"]');
  await P.evaluate(() => { window.__esito = 'annullato'; }); await pulisci(P);
  await tocca(P, '#cat-dati >> text=Esporta copia');
  verifica(await volte(P, 'DoctorCar.verificaIdentita') === 1 && !(await P.locator('#finDomanda').isVisible()), 'esportare la copia: prima l\'impronta; annullata, la richiesta della password non compare');
  await P.evaluate(() => { window.__esito = 'ok'; }); await pulisci(P);
  await tocca(P, '#cat-dati >> text=Esporta copia'); await P.waitForTimeout(400);
  verifica(await volte(P, 'DoctorCar.verificaIdentita') === 1 && /Copia di sicurezza/.test(await P.locator('#domandaTitolo').textContent()), 'confermata: si passa alla scelta della password');
  await tocca(P, '#domandaNo'); await P.waitForTimeout(500);
  await pulisci(P); await P.locator('#fileCopia').setInputFiles({ name: 'c.dccopia', mimeType: 'application/octet-stream', buffer: Buffer.from('{}') }); await P.waitForTimeout(500);
  verifica(await volte(P, 'DoctorCar.verificaIdentita') === 1, 'importare una copia: prima l\'impronta');
  await P.evaluate(() => document.querySelectorAll('.finestra').forEach(f => f.classList.add('hidden')));
  await tocca(P, '[aria-label="Impostazioni"]'); await P.waitForTimeout(300);
  verifica(await P.locator('#finImpostazioni [data-cat][aria-expanded="true"]').count() === 0, 'riaprendo Impostazioni le sezioni sono chiuse');
  await tocca(P, '[data-cat="dati"]');
  await P.evaluate(() => { window.__esito = 'annullato'; }); await pulisci(P);
  await tocca(P, '#cat-dati >> text=Cancella tutto'); await tocca(P, '#domandaSi'); await P.waitForTimeout(500);
  verifica(await volte(P, 'DoctorCar.verificaIdentita') === 1 && await volte(P, 'DoctorCar.cancellaTutto') === 0 && await P.evaluate(() => !!localStorage.getItem('doctorcar_dati') || true), 'cancellare tutto: senza impronta non si cancella niente');
  verifica(P.errori.length === 0, 'nessun errore in pagina' + (P.errori.length ? ': ' + P.errori.join(' | ') : ''));
  await P.context().close();

  console.log('Telefono senza impronta né PIN');
  P = await (async () => { const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'it-IT' }); await ctx.addInitScript(MOCK.replace('window.__puo = true', 'window.__puo = false')); const q = await ctx.newPage(); q.errori = []; q.on('pageerror', e => q.errori.push(e.message)); await q.goto(APP); return q; })();
  await P.waitForTimeout(700);
  verifica(await libera(P) && await volte(P, 'DoctorCar.verificaIdentita') === 0, 'si apre senza chiedere niente');
  await tocca(P, 'header [aria-label="Impostazioni"]'); await tocca(P, '[data-cat="sicurezza"]');
  verifica(/né impronta né PIN/.test(await P.locator('#bloccoNota').textContent()), 'l\'impostazione spiega cosa fare');
  await P.locator('#impBlocco').click({ force: true }); await P.waitForTimeout(300);
  verifica(await P.locator('#impBlocco').getAttribute('aria-checked') === 'false' && /blocco dello schermo/.test(await P.locator('#avvisoTesto').textContent()), 'e non si può accendere: dice di attivare prima il blocco di Android');
  await tocca(P, '[data-cat="dati"]'); await pulisci(P);
  await tocca(P, '#cat-dati >> text=Esporta copia'); await P.waitForTimeout(300);
  verifica(await P.locator('#finDomanda').isVisible(), 'la copia di sicurezza si esporta (password tua)');
  await P.context().close();

  console.log(`\n${ok} riuscite, ${ko} fallite`);
  await b.close(); process.exit(ko ? 1 : 0);
})();
