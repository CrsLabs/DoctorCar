// Aspetto come in DoctorWood: apertura con il logo, dimensione del testo, fluidità dello schermo e vibrazione
// (intensità e tipi). L'app Android è simulata: le chiamate al motore nativo si registrano in window.__chiamate.
// Uso: node prove/aspetto.js
const { chromium, devices } = require('playwright');
const APP = 'http://127.0.0.1:8785/index.html', WEB = 'http://127.0.0.1:8786/sorgente-DoctorCar.html';
let ok = 0, ko = 0;
const verifica = (cond, nome) => { if (cond) { ok++; console.log('  ✓ ' + nome); } else { ko++; console.log('  ✗ ' + nome); } };
const MOCK = `(() => {
  window.__chiamate = [];
  window.Capacitor = { isNativePlatform: () => true, addListener: () => ({ remove() {} }),
    nativePromise: (pl, m, o) => { window.__chiamate.push([pl + '.' + m, o || {}]);
      if (m === 'frequenze') return Promise.resolve({ massima: 120, minima: 60, attuale: 60 });
      if (m === 'statoNotifiche') return Promise.resolve({ concesso: true });
      return Promise.resolve({}); } };
})();`;
const chiamate = (P, nome) => P.evaluate(n => window.__chiamate.filter(c => c[0] === n).map(c => c[1]), nome);
const pulisci = P => P.evaluate(() => { window.__chiamate.length = 0; });

(async () => {
  const b = await chromium.launch();
  const nuovo = async (url, { app = true, init = '', larghezza } = {}) => {
    const ctx = await b.newContext({ ...devices['Pixel 7'], ...(larghezza ? { viewport: { width: larghezza, height: 900 } } : {}), locale: 'it-IT' });
    if (app) await ctx.addInitScript(MOCK);
    if (init) await ctx.addInitScript(init);
    const P = await ctx.newPage(); P.errori = [];
    P.on('pageerror', e => P.errori.push(e.message)); P.on('console', m => { if (m.type() === 'error') P.errori.push(m.text()); });
    await P.goto(url); return P;
  };
  const tocca = async (P, sel) => { await P.locator(sel).first().click({ timeout: 8000 }); await P.waitForTimeout(250); };
  const apriAspetto = async P => { await tocca(P, 'header [aria-label="Impostazioni"]'); await tocca(P, '[data-cat="aspetto"]'); };

  console.log('Apertura con il logo (animazioni accese)');
  let P = await nuovo(APP, { init: 'window.__avvioIntero = true;' });
  await P.waitForTimeout(250);
  const a1 = await P.evaluate(() => ({ avvio: document.documentElement.hasAttribute('data-avvio'), bloccato: document.documentElement.hasAttribute('data-bloccato'),
    box: !!document.querySelector('#avvio .avvio-logo svg'), nome: (document.querySelector('#avvio .avvio-nome') || {}).textContent, visibile: getComputedStyle(document.getElementById('avvio')).display,
    home: getComputedStyle(document.querySelector('#vista-home')).visibility, sfondo: getComputedStyle(document.body).backgroundColor }));
  verifica(a1.avvio && a1.bloccato && a1.box && a1.nome === 'DoctorCar' && a1.visibile === 'flex', 'subito dopo l\'apertura si vede il logo con il nome');
  verifica(a1.home === 'hidden' && a1.sfondo === 'rgb(30, 41, 59)', 'sotto c\'è solo il blu: la pagina non si vede');
  await P.waitForTimeout(1100);
  verifica(await P.evaluate(() => document.documentElement.hasAttribute('data-avvio')) === true, 'dopo 1,3 s il logo è ancora lì (dura circa 2,8 s)');
  await P.waitForTimeout(1000);
  verifica(await P.evaluate(() => document.documentElement.hasAttribute('data-avvio')) === true, 'a 2,3 s è ancora lì: nome e motto sono comparsi e restano fermi un attimo, l\'impronta non è ancora chiesta');
  await P.waitForTimeout(900);
  verifica(await P.evaluate(() => !document.documentElement.hasAttribute('data-avvio') && document.documentElement.hasAttribute('data-bloccato')), 'a 3,2 s la schermata comincia a sfumare');
  await P.waitForTimeout(1000);
  const a2 = await P.evaluate(() => ({ bloccato: document.documentElement.hasAttribute('data-bloccato'), box: getComputedStyle(document.getElementById('avvio')).display, home: getComputedStyle(document.querySelector('#vista-home')).visibility }));
  verifica(!a2.bloccato && a2.box === 'none' && a2.home === 'visible', 'alla fine il logo sparisce e la Home è visibile');
  verifica(P.errori.length === 0, 'nessun errore'); await P.context().close();

  console.log('Apertura con le animazioni spente');
  P = await nuovo(APP, { init: "window.__avvioIntero = true; localStorage.setItem('doctorcar_animazioni', JSON.stringify('no'));" });
  await P.waitForTimeout(300);
  verifica(await P.evaluate(() => document.documentElement.hasAttribute('data-avvio')), 'il logo resta fermo un attimo');
  await P.waitForTimeout(900);
  verifica(await P.evaluate(() => !document.documentElement.hasAttribute('data-bloccato')), 'dopo 0,7 s la pagina è libera');
  await P.context().close();

  console.log('Nelle prove automatiche e nel browser del PC');
  P = await nuovo(APP);
  await P.waitForTimeout(500);
  verifica(await P.evaluate(() => !document.documentElement.hasAttribute('data-bloccato')), 'senza __avvioIntero l\'apertura è un istante');
  await P.context().close();
  P = await nuovo(WEB, { app: false });
  verifica(await P.evaluate(() => !document.documentElement.hasAttribute('data-avvio') && !document.getElementById('avvio')), 'sul PC non c\'è nessuna schermata d\'apertura');
  await P.context().close();

  console.log('Dimensione del testo');
  P = await nuovo(APP);
  await apriAspetto(P);
  verifica(await P.locator('#sceltaTesto [data-testo="100"]').getAttribute('aria-checked') === 'true', 'di serie: Normale');
  await pulisci(P); await tocca(P, '#sceltaTesto [data-testo="115"]');
  verifica(await P.evaluate(() => document.documentElement.dataset.testo) === '115' && JSON.stringify(await chiamate(P, 'DoctorCar.dimensioneTesto')) === '[{"percento":115}]', 'Grande: lo dice ad Android (zoom del testo della WebView)');
  verifica(await P.evaluate(() => localStorage.getItem('doctorcar_testo')) === '115' && await P.locator('#sceltaTesto [data-testo="115"]').getAttribute('aria-checked') === 'true', 'scelta ricordata e evidenziata');
  verifica(await P.evaluate(() => document.documentElement.style.zoom) === '', 'nell\'app la pagina non si ingrandisce da sola');
  await tocca(P, '#sceltaTesto [data-testo="130"]');
  verifica((await chiamate(P, 'DoctorCar.dimensioneTesto')).pop().percento === 130, 'Molto grande: 130');
  await P.reload(); await P.waitForTimeout(500);
  verifica(await P.evaluate(() => document.documentElement.dataset.testo) === '130' && (await chiamate(P, 'DoctorCar.dimensioneTesto')).some(c => c.percento === 130), 'riaprendo l\'app il testo è già della dimensione scelta');
  await P.context().close();
  P = await nuovo(WEB, { app: false, larghezza: 1280, init: "localStorage.setItem('doctorcar_testo', JSON.stringify(115));" });
  verifica(await P.evaluate(() => document.documentElement.style.zoom) === '1.15', 'sul PC (schermo largo) lo zoom è della pagina');
  await P.context().close();
  P = await nuovo(WEB, { app: false, init: "localStorage.setItem('doctorcar_testo', JSON.stringify(130));" });
  verifica(await P.evaluate(() => document.documentElement.style.zoom) === '' && await P.evaluate(() => document.documentElement.dataset.testo) === '130', 'sul telefono nel browser nessuno zoom (la pagina resta com\'è)');
  await P.context().close();

  console.log('Fluidità dello schermo');
  P = await nuovo(APP);
  await apriAspetto(P);
  verifica(await P.locator('#impHz').isVisible(), 'nell\'app ci sono le tre scelte');
  verifica(/Massima \(120 Hz\)/.test(await P.locator('#impHz [data-hz="massima"]').textContent()), 'la massima dello schermo è scritta (120 Hz)');
  verifica(await P.locator('#impHz [data-hz="massima"]').getAttribute('aria-checked') === 'true', 'di serie: Massima');
  verifica((await chiamate(P, 'DoctorCar.impostaFrequenza')).some(c => c.modo === 'massima'), 'all\'apertura chiede ad Android la massima');
  await pulisci(P); await tocca(P, '#impHz [data-hz="60"]');
  verifica(JSON.stringify(await chiamate(P, 'DoctorCar.impostaFrequenza')) === '[{"modo":"60"}]' && await P.locator('#impHz [data-hz="60"]').getAttribute('aria-checked') === 'true', '60 Hz');
  await pulisci(P); await tocca(P, '#impHz [data-hz="auto"]');
  verifica((await chiamate(P, 'DoctorCar.impostaFrequenza'))[0].modo === 'auto', 'Automatica: decide Android');
  await pulisci(P); await tocca(P, '#impAnimazioni');   // animazioni spente
  verifica((await chiamate(P, 'DoctorCar.impostaFrequenza')).pop().modo === '60', 'con le animazioni spente «Automatica» vale 60 Hz');
  await tocca(P, '#impAnimazioni'); verifica((await chiamate(P, 'DoctorCar.impostaFrequenza')).pop().modo === 'auto', 'riaccese, torna automatica');
  await P.context().close();
  P = await nuovo(WEB, { app: false });
  await apriAspetto(P);
  verifica(!(await P.locator('#impHz').isVisible()), 'sul PC la fluidità non c\'è');
  await P.context().close();

  console.log('Vibrazione');
  P = await nuovo(APP);
  await tocca(P, 'header [aria-label="Impostazioni"]'); await tocca(P, '[data-cat="vibrazione"]');
  const vib = () => chiamate(P, 'DoctorCar.vibra');
  verifica(await P.locator('#impVibrazione').getAttribute('aria-checked') === 'true' && await P.locator('#vibDettagli').isVisible(), 'di serie accesa, con i dettagli');
  verifica(/Normale/.test(await P.locator('#vibForzaTesto').textContent()), 'durata «Normale»');
  await pulisci(P); await P.waitForTimeout(100); await tocca(P, '[data-cat="aspetto"]');
  let v = await vib();
  verifica(v.length === 1 && JSON.stringify(v[0].tempi) === '[30]' && v[0].forza === 1, 'un tasto: un colpetto di 30 ms (' + JSON.stringify(v) + ')');
  await pulisci(P); await tocca(P, '#vibDettagli [data-forza="1.7"]');
  v = await vib();
  verifica(v.length === 2 && JSON.stringify(v[1].tempi) === '[77]' && v[1].forza === 1.7, 'scegliendo «Forte» si sente subito il campione (77 ms, intensità 1,7)');
  verifica(await P.evaluate(() => localStorage.getItem('doctorcar_vibrazione_forza')) === '1.7' && await P.locator('#vibDettagli [data-forza="1.7"]').getAttribute('aria-pressed') === 'true', 'scelta ricordata');
  await P.waitForTimeout(100); await pulisci(P); await tocca(P, '[data-cat="aspetto"]');
  v = await vib();
  verifica(v.length === 1 && JSON.stringify(v[0].tempi) === '[51]' && v[0].forza === 1.7, 'da quel momento i tasti durano 51 ms');
  await tocca(P, '[data-cat="aspetto"]'); await pulisci(P); await P.locator('#vibForza').fill('2'); await P.waitForTimeout(200);
  v = await vib();
  verifica(v.length >= 1 && JSON.stringify(v[v.length - 1].tempi) === '[90]' && /Molto forte/.test(await P.locator('#vibForzaTesto').textContent()), 'trascinando lo slider ogni livello si sente subito (2,0 = «Molto forte»)');
  await tocca(P, '#vibDettagli [data-forza="0.6"]'); await P.waitForTimeout(100); await pulisci(P); await tocca(P, '[data-cat="aspetto"]');
  v = await vib(); verifica(v.length === 1 && JSON.stringify(v[0].tempi) === '[20]', '«Leggera»: mai meno di 20 ms');
  await tocca(P, '#vibDettagli [data-forza="1"]'); await P.waitForTimeout(100);

  console.log('Quando vibrare');
  await P.evaluate(() => DC.avviso('Salvato', 'ok')); await P.waitForTimeout(100);
  v = await vib(); verifica(JSON.stringify(v[v.length - 1].tempi) === '[30,60,40]', 'operazione riuscita: tre colpi (30·60·40)');
  await P.waitForTimeout(100); await pulisci(P);
  await P.evaluate(() => DC.avviso('Qualcosa non va', 'errore')); await P.waitForTimeout(100);
  v = await vib(); verifica(JSON.stringify(v[v.length - 1].tempi) === '[45,60,45]', 'errore: due colpi decisi (45·60·45)');
  await pulisci(P); await P.evaluate(() => DC.avviso('Informazione', 'info')); await P.waitForTimeout(100);
  verifica((await vib()).length === 0, 'un\'informazione non vibra');
  await tocca(P, '#vibDettagli [data-vibtipo="successo"]'); await pulisci(P);
  await P.evaluate(() => DC.avviso('Salvato', 'ok')); await P.waitForTimeout(100);
  verifica((await vib()).length === 0, 'tolta la spunta «riuscite»: non vibra più');
  await tocca(P, '#vibDettagli [data-vibtipo="avviso"]'); await pulisci(P);
  await P.evaluate(() => DC.avviso('Errore', 'errore')); await P.waitForTimeout(100);
  verifica((await vib()).length === 0, 'tolta la spunta «avvisi»: non vibra più');
  await tocca(P, '#vibDettagli [data-vibtipo="scelta"]'); await P.waitForTimeout(100); await pulisci(P);
  await tocca(P, '[data-cat="aspetto"]');
  verifica((await vib()).length === 0, 'tolta la spunta «tasti»: i tasti non vibrano');
  await P.reload(); await P.waitForTimeout(500);
  await tocca(P, 'header [aria-label="Impostazioni"]'); await tocca(P, '[data-cat="vibrazione"]');
  verifica(!(await P.locator('#vibDettagli [data-vibtipo="scelta"]').isChecked()) && !(await P.locator('#vibDettagli [data-vibtipo="successo"]').isChecked()), 'le spunte restano dopo la riapertura');
  for (const t of ['scelta', 'successo', 'avviso']) await tocca(P, '#vibDettagli [data-vibtipo="' + t + '"]');

  console.log('A raffica e spenta');
  await P.waitForTimeout(100); await pulisci(P);
  await P.evaluate(() => { const b = document.querySelector('[data-cat="aspetto"]'); b.click(); b.click(); b.click(); });
  await P.waitForTimeout(100);
  verifica((await vib()).length === 1, 'tre tocchi quasi insieme: una sola vibrazione');
  await tocca(P, '#impVibrazione'); await P.waitForTimeout(100);
  verifica(await P.locator('#impVibrazione').getAttribute('aria-checked') === 'false' && !(await P.locator('#vibDettagli').isVisible()), 'spenta: i dettagli spariscono');
  await pulisci(P); await P.waitForTimeout(100); await tocca(P, '[data-cat="aspetto"]'); await P.evaluate(() => DC.avviso('Salvato', 'ok')); await P.waitForTimeout(100);
  verifica((await vib()).length === 0, 'spenta: niente vibra');
  await tocca(P, '#impVibrazione'); await P.waitForTimeout(100);
  verifica(await P.locator('#vibDettagli').isVisible() && (await vib()).length >= 1, 'riaccesa: un colpetto di conferma');
  verifica(P.errori.length === 0, 'nessun errore in pagina' + (P.errori.length ? ': ' + P.errori.join(' | ') : ''));
  await P.context().close();

  console.log(`\n${ok} riuscite, ${ko} fallite`);
  await b.close(); process.exit(ko ? 1 : 0);
})();
