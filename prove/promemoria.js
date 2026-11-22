// Avvisi sulle scadenze nell'app Android (ponte di Capacitor simulato): la domanda della prima volta, i permessi,
// cosa viene consegnato ad Android (date, ore, testi), impostazioni (anticipo, ora), scadenze passate, scadenze a km,
// «da completare» senza avvisi, spegnere gli avvisi.
// Uso: node prove/promemoria.js [http://127.0.0.1:8785/index.html]
const { chromium, devices } = require('playwright');
const URL = process.argv[2] || 'http://127.0.0.1:8785/index.html';
let ok = 0, ko = 0;
const verifica = (cond, nome) => { if (cond) { ok++; console.log('  ✓ ' + nome); } else { ko++; console.log('  ✗ ' + nome); } };
const MOCK = `(() => {
  window.__nat = []; window.__prom = null; window.__consentite = true;
  window.Capacitor = { isNativePlatform: () => true, addListener: () => ({ remove() {} }),
    nativePromise: (pl, m, o) => {
      window.__nat.push(pl + '.' + m);
      if (pl === 'PairWood') return Promise.resolve(m === 'chiediNotifiche' ? { concesso: window.__consentite } : {});
      if (m === 'statoNotifiche') return Promise.resolve({ concesso: window.__consentite });
      if (m === 'programmaPromemoria') { window.__prom = o.voci.filter(v => v.azione !== 'km' && v.azione !== 'controlli'); window.__promKm = o.voci.filter(v => v.azione === 'km'); window.__promCtl = o.voci.filter(v => v.azione === 'controlli'); window.__promTutti = o.voci.length; return Promise.resolve({ programmati: o.voci.length }); }
      if (m === 'annullaPromemoria') { window.__prom = []; return Promise.resolve({}); }
      return Promise.resolve({});
    } };
})();`;
const giorno = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const ora = (ms) => new Date(ms).toTimeString().slice(0, 5);
const giornoDi = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'it-IT' });
  await ctx.addInitScript(MOCK);
  const P = await ctx.newPage();
  const errori = [];
  P.on('pageerror', e => errori.push('errore: ' + e.message));
  P.on('console', m => { if (m.type() === 'error') errori.push('console: ' + m.text()); });
  await P.goto(URL);
  const tocca = async sel => { await P.locator(sel).first().click({ timeout: 8000 }); await P.waitForTimeout(300); };
  const dati = d => P.evaluate(d => { DC.unisci(d); DC.salvaDati(); DC.disegna(); }, d);
  const m = Date.now(), base = { veicoli: [{ id: 'auto0001', mod: m, dev: 'aaaaaaaaaaaa', nome: 'Golf', alimentazione: 'diesel' }] };

  console.log('Senza scadenze non si chiede niente');
  await dati(base); await P.waitForTimeout(3500);
  verifica(!(await P.locator('#finDomanda').isVisible()), 'nessuna domanda con una sola auto e nessuna scadenza');

  console.log('La prima volta che c\'è una scadenza si chiede');
  await dati({ scadenze: [{ id: 'scad0001', mod: m + 1, dev: 'aaaaaaaaaaaa', veicolo: 'auto0001', voce: 'bollo', nome: 'Bollo', ogniMesi: 12, prossimaData: giorno(20) }] });
  await P.waitForSelector('#finDomanda:not(.hidden)', { timeout: 15000 });
  verifica(/Avvisi sulle scadenze/.test(await P.locator('#domandaTitolo').textContent()), 'domanda «Avvisi sulle scadenze»');
  await tocca('#domandaSi'); await P.waitForTimeout(1200);
  let voci = await P.evaluate(() => window.__prom);
  verifica(Array.isArray(voci) && voci.length === 3, 'consegnati 3 avvisi (14 giorni prima, il giorno prima, il giorno stesso)');
  const per = Object.fromEntries((voci || []).map(v => [v.id.split(':')[1], v]));
  verifica(per.a && giornoDi(per.a.quando) === giorno(6) && ora(per.a.quando) === '09:00', 'primo avviso fra 6 giorni alle 9:00');
  verifica(per.b && giornoDi(per.b.quando) === giorno(19), 'secondo il giorno prima');
  verifica(per.c && giornoDi(per.c.quando) === giorno(20), 'terzo il giorno della scadenza');
  verifica(per.a && /Tra 14 giorni: Bollo/.test(per.a.titolo) && /Scade il/.test(per.a.testo), 'testo del primo avviso: ' + (per.a && per.a.titolo));
  verifica(per.c && /Oggi: Bollo/.test(per.c.titolo), 'testo del terzo avviso: ' + (per.c && per.c.titolo));
  verifica(voci.every(v => v.azione === 'scadenza' && v.scadenza === 'scad0001' && v.voce === 'bollo' && v.veicolo === 'auto0001'), 'ogni avviso porta con sé scadenza, voce e veicolo (per i tasti «Fatto oggi» e «Rimanda»)');
  const kmM = await P.evaluate(() => window.__promKm);
  verifica(kmM.length === 4 && kmM.every(v => v.azione === 'km' && v.veicolo === 'auto0001') && /Quanti km ha Golf\?/.test(kmM[0].titolo), 'ogni primo del mese un avviso «Quanti km ha…?» con risposta (4 mesi)');
  verifica(await P.evaluate(() => window.__promKm.every(v => new Date(v.quando).getDate() === 1)), 'sempre il primo del mese');
  verifica(await P.evaluate(() => JSON.parse(localStorage.getItem('doctorcar_promemoria')).attivo === true), 'avvisi attivi, ricordati');

  console.log('Non si richiede');
  await dati({ scadenze: [{ id: 'scad0002', mod: m + 2, dev: 'aaaaaaaaaaaa', veicolo: 'auto0001', voce: 'assicurazione', nome: 'Assicurazione', ogniMesi: 12, prossimaData: giorno(60) }] });
  await P.waitForTimeout(4000);
  verifica(!(await P.locator('#finDomanda').isVisible()), 'nessuna seconda domanda');
  voci = await P.evaluate(() => window.__prom);
  verifica(voci.length === 6, 'con la nuova scadenza gli avvisi si ricalcolano da soli (' + voci.length + ')');

  console.log('Impostazioni: anticipo e ora');
  await tocca('header >> [aria-label="Impostazioni"]'); await tocca('[data-cat="avvisi"]');
  verifica(await P.locator('#impAvvisi').getAttribute('aria-checked') === 'true', 'interruttore acceso');
  const tutti = await P.evaluate(() => window.__promTutti);
  verifica(new RegExp('In programma ' + tutti + ' avvisi').test(await P.locator('#avvisiStato').textContent()), 'stato: ' + (await P.locator('#avvisiStato').textContent()));
  verifica(await P.evaluate(() => window.__promCtl.length >= 3 && window.__promCtl.every(v => new Date(v.quando).getDate() === 15 && /2 minuti/.test(v.titolo))), 'il 15 del mese «2 minuti per l\'auto» (controlli veloci)');
  await tocca('#avvisiAnticipo [data-anticipo="7"]'); await P.waitForTimeout(800);
  voci = await P.evaluate(() => window.__prom);
  const bollo = voci.filter(v => v.id.startsWith('scad0001')).map(v => v.id.split(':')[1] + '@' + giornoDi(v.quando)).sort();
  verifica(JSON.stringify(bollo) === JSON.stringify(['a@' + giorno(13), 'b@' + giorno(19), 'c@' + giorno(20)]), 'anticipo 7 giorni: primo avviso fra 13 giorni');
  await tocca('#avvisiOra [data-ora="18"]'); await P.waitForTimeout(800);
  voci = await P.evaluate(() => window.__prom);
  verifica(voci.every(v => ora(v.quando) === '18:00'), 'ora 18:00 per tutti');
  verifica(await P.locator('#avvisiOra [data-ora="18"]').getAttribute('aria-pressed') === 'true' && await P.locator('#avvisiAnticipo [data-anticipo="7"]').getAttribute('aria-pressed') === 'true', 'scelte evidenziate');

  console.log('Scadenza passata: una volta a settimana per tre settimane');
  await dati({ scadenze: [{ id: 'scad0003', mod: m + 3, dev: 'aaaaaaaaaaaa', veicolo: 'auto0001', voce: 'revisione', nome: 'Revisione', ogniMesi: 24, prossimaData: giorno(-3) }] });
  await P.waitForTimeout(3500);
  voci = await P.evaluate(() => window.__prom);
  const rev = voci.filter(v => v.id.startsWith('scad0003')).sort((a, c) => a.quando - c.quando);
  verifica(rev.length === 3 && [1, 8, 15].every((g, k) => giornoDi(rev[k].quando) === giorno(g)), 'tre avvisi: domani, fra 8 e fra 15 giorni');
  verifica(rev[0] && /Scaduta: Revisione/.test(rev[0].titolo) && /Era il/.test(rev[0].testo), 'testo: ' + (rev[0] && rev[0].titolo + ' · ' + rev[0].testo));

  console.log('Scadenza a km: avvisa dalla data stimata');
  await dati({ letture: [
    { id: 'let00001', mod: m + 4, dev: 'aaaaaaaaaaaa', veicolo: 'auto0001', data: giorno(-60), km: 50000 },
    { id: 'let00002', mod: m + 5, dev: 'aaaaaaaaaaaa', veicolo: 'auto0001', data: giorno(0), km: 53000 }],   // 50 km al giorno
    scadenze: [{ id: 'scad0004', mod: m + 6, dev: 'aaaaaaaaaaaa', veicolo: 'auto0001', voce: 'tagliando', nome: 'Tagliando', ogniKm: 15000, ultimiKm: 38500, ultimaData: giorno(-100) }] });
  await P.waitForTimeout(3500);
  voci = await P.evaluate(() => window.__prom);
  const tag = voci.filter(v => v.id.startsWith('scad0004')).sort((a, c) => a.quando - c.quando);
  verifica(tag.length >= 1 && /stimata/.test(tag[0].testo), 'avviso con data stimata dai km: ' + (tag[0] && tag[0].titolo + ' · ' + tag[0].testo));

  console.log('«Da completare» non avvisa');
  await dati({ scadenze: [{ id: 'scad0005', mod: m + 7, dev: 'aaaaaaaaaaaa', veicolo: 'auto0001', voce: 'distribuzione', nome: 'Cinghia', ogniKm: 120000, ogniMesi: 72 }] });
  await P.waitForTimeout(3500);
  voci = await P.evaluate(() => window.__prom);
  verifica(!voci.some(v => v.id.startsWith('scad0005')), 'nessun avviso per una scadenza senza ultima volta');
  verifica(voci.length <= 60, 'al massimo 60 avvisi');

  console.log('Spegnere gli avvisi');
  await tocca('#impAvvisi'); await P.waitForTimeout(800);
  verifica(await P.evaluate(() => window.__prom.length) === 0 && await P.evaluate(() => window.__nat.includes('DoctorCar.annullaPromemoria')), 'Android riceve «annulla»');
  verifica(/spenti/.test(await P.locator('#avvisiStato').textContent()), 'stato: spenti');
  await P.evaluate(() => { window.__prom = null; });
  await dati({ scadenze: [{ id: 'scad0006', mod: m + 8, dev: 'aaaaaaaaaaaa', veicolo: 'auto0001', voce: 'bollo', nome: 'Altro bollo', ogniMesi: 12, prossimaData: giorno(10) }] });
  await P.waitForTimeout(3500);
  verifica(await P.evaluate(() => window.__prom) === null, 'spenti: niente viene più consegnato');

  console.log('Android blocca le notifiche');
  await P.evaluate(() => { window.__consentite = false; });
  await tocca('#impAvvisi'); await P.waitForTimeout(1000);
  verifica(await P.locator('#impAvvisi').getAttribute('aria-checked') === 'false', 'senza permesso l\'interruttore resta spento');
  verifica(/non permette le notifiche/.test(await P.locator('#avvisoTesto').textContent()), 'messaggio chiaro');
  verifica(await P.locator('#avvisiApri').isVisible() && /blocc/.test(await P.locator('#avvisiStato').textContent()), 'tasto «Apri le impostazioni di Android»');
  await tocca('#avvisiApri'); await P.waitForTimeout(300);
  verifica(await P.evaluate(() => window.__nat.includes('DoctorCar.apriImpostazioniNotifiche')), 'apre le impostazioni di Android');
  await P.evaluate(() => { window.__consentite = true; });
  await tocca('#impAvvisi'); await P.waitForTimeout(1000);
  verifica(await P.locator('#impAvvisi').getAttribute('aria-checked') === 'true' && (await P.evaluate(() => window.__prom || []).then(v => v.length)) > 0, 'dopo il permesso si riaccende e riprogramma');

  verifica(errori.length === 0, 'nessun errore in pagina' + (errori.length ? ': ' + errori.join(' | ') : ''));
  console.log(`\n${ok} riuscite, ${ko} fallite`);
  await b.close();
  process.exit(ko ? 1 : 0);
})();
