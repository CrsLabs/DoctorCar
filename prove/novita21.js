// Le novità della 2.1: regole italiane (bollo, tolleranza dell'assicurazione, revisione a fine mese), documenti del guidatore,
// controlli veloci del mese, grafico del consumo, storico delle gomme, budget del mese, spese veloci (multa con lo sconto),
// «Dove ho parcheggiato» con la sosta a tempo. Pagina web (8786) e app Android simulata (8785).
// Uso: node prove/novita21.js
const { chromium, devices } = require('playwright');
const WEB = 'http://127.0.0.1:8786/sorgente-DoctorCar.html', APP = 'http://127.0.0.1:8785/index.html';
let ok = 0, ko = 0;
const verifica = (cond, nome) => { if (cond) { ok++; console.log('  ✓ ' + nome); } else { ko++; console.log('  ✗ ' + nome); } };
const giorno = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const fineMese = s => { const d = new Date(s + 'T12:00:00'); const u = new Date(d.getFullYear(), d.getMonth() + 1, 0); return u.getFullYear() + '-' + String(u.getMonth() + 1).padStart(2, '0') + '-' + String(u.getDate()).padStart(2, '0'); };
const MOCK = `(() => {
  window.__nat = []; window.__rit = {}; window.__coda = [];
  window.Capacitor = { isNativePlatform: () => true, addListener: () => ({ remove() {} }),
    nativePromise: (pl, m, o) => {
      window.__nat.push({ m, o });
      if (pl === 'PairWood') return Promise.resolve(m === 'chiediNotifiche' ? { concesso: true } : {});
      if (m === 'statoNotifiche') return Promise.resolve({ concesso: true });
      if (m === 'puoSbloccare') return Promise.resolve({ ok: false });
      if (m === 'azioniInCoda') { const a = window.__coda; window.__coda = []; return Promise.resolve({ azioni: a }); }
      if (m === 'scorciatoia') { const c = window.__rit.scorciatoia || ''; window.__rit.scorciatoia = ''; return Promise.resolve({ cosa: c }); }
      if (m === 'posizione') return window.__rit.posErr ? Promise.reject(Object.assign(new Error('no'), { code: window.__rit.posErr })) : Promise.resolve(window.__rit.pos || { lat: 45.4642, lon: 9.19, precisione: 12 });
      if (m === 'attivaPosizione' || m === 'impostazioniApp') { window.__rit.posErr = ''; return Promise.resolve({ attiva: true }); }
      if (m === 'indirizzo') return Promise.resolve({ testo: 'Via Dante 5, Milano' });
      if (m === 'programmaPromemoria') { window.__prom = o.voci; return Promise.resolve({ programmati: o.voci.length }); }
      return Promise.resolve({});
    } };
})();`;
const m0 = Date.now(), DEV = 'aaaaaaaaaaaa';
const veic = (id, nome, extra) => Object.assign({ id, mod: m0, dev: DEV, nome, tipo: 'auto', alimentazione: 'benzina' }, extra || {});

(async () => {
  const b = await chromium.launch();
  const errori = [];
  const nuova = async (url, app) => {
    const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'it-IT' });
    if (app) await ctx.addInitScript(MOCK);
    const P = await ctx.newPage();
    P.on('pageerror', e => errori.push('errore: ' + e.message));
    P.on('console', m => { if (m.type() === 'error') errori.push('console: ' + m.text()); });
    await P.goto(url); await P.waitForTimeout(700);
    return P;
  };
  const dati = (P, d) => P.evaluate(d => { DC.unisci(d); DC.salvaDati(); DC.disegna(); }, d);
  const tocca = async (P, sel) => { await P.locator(sel).first().click({ timeout: 8000 }); await P.waitForTimeout(250); };
  const chiudiMod = async P => { await P.evaluate(() => { DC.COMANDI.chiudiModulo(); }); await P.waitForTimeout(300); if (await P.locator('#finDomanda').isVisible().catch(() => false)) await P.locator('#domandaAlt').click(); await P.waitForTimeout(300); };

  let P = await nuova(WEB, false);
  console.log('1. Regole italiane: bollo, assicurazione, revisione');
  await P.evaluate(() => DC.COMANDI.nuovoVeicolo()); await P.waitForTimeout(400);
  await P.fill('#m_nome', 'Panda'); await P.fill('#m_immatricolazione', '2019-06-12'); await P.fill('#m_kmIniziali', '50000'); await P.fill('#m_revisione', '2025-06-03'); await P.fill('#m_revisioneCosto', '79');
  await tocca(P, '#moduloSalva'); await P.waitForTimeout(500);
  const r1 = await P.evaluate(() => { const v = DC.veicoli()[0]; const sc = Object.values(DC.dati.scadenze).filter(x => !x.del && x.veicolo === v.id); const b = sc.find(x => x.voce === 'bollo'), rv = sc.find(x => x.voce === 'revisione'); return { id: v.id, bollo: b.prossimaData, nota: b.note, rev: DC.statoScadenza(rv).data, attesoB: DC.bolloProposto('2019-06-12') }; });
  verifica(/-06-30$/.test(r1.bollo) && r1.bollo >= giorno(0) && /regione/.test(r1.nota), 'bollo proposto da solo: fine del mese di immatricolazione (' + r1.bollo + ')');
  verifica(r1.rev === '2027-06-30', 'la revisione vale fino a fine mese (' + r1.rev + ')');
  verifica(await P.evaluate(id => Object.values(DC.dati.scadenze).find(x => !x.del && x.veicolo === id && x.voce === 'revisione').costo, r1.id) === 79, 'nel nuovo veicolo si scrive anche il costo della revisione');
  await dati(P, { scadenze: [{ id: 'assi0001', mod: m0, dev: DEV, veicolo: r1.id, voce: 'assicurazione', nome: 'Assicurazione', ogniMesi: 12, prossimaData: giorno(-4) }] });
  const st = await P.evaluate(() => { const s = DC.dati.scadenze.assi0001; const x = DC.statoScadenza(s); return { t: x.tolleranza, d: DC.esc ? document.querySelector('#homeScadenze').textContent : '' }; });
  verifica(st.t === 11, 'assicurazione scaduta da 4 giorni: ancora 11 giorni di copertura');
  verifica(/coperto ancora 11 giorni \(tolleranza di 15 giorni\)/.test(st.d), 'in Home si legge la tolleranza');
  const pr = await P.evaluate(() => DC.calcolaPromemoria({ attivo: true, anticipo: 14, ora: 9, kmMensile: false, controlli: false }).filter(v => v.scadenza === 'assi0001').map(v => v.titolo));
  verifica(pr.some(t => /Ultimo giorno di copertura/.test(t)), 'avviso dell\'ultimo giorno di copertura');

  console.log('2. Documenti e permessi');
  await P.evaluate(() => DC.COMANDI.vai('scadenze')); await P.waitForTimeout(300);
  verifica(await P.locator('#sceltaDocumenti >> text=+ Patente').isVisible(), 'in Scadenze c\'è «+ Patente» (e gli altri documenti)');
  await tocca(P, '#sceltaDocumenti >> text=+ Patente'); await P.waitForTimeout(400);
  await P.fill('#m_prossimaData', giorno(20)); await tocca(P, '#moduloSalva'); await P.waitForTimeout(500);
  const pat = await P.evaluate(() => { const s = Object.values(DC.dati.scadenze).find(x => !x.del && x.voce === 'patente'); return s ? { v: s.veicolo, liv: DC.statoScadenza(s).livello, id: s.id } : null; });
  verifica(pat && pat.v === '_io' && pat.liv === 'vicina', 'patente aggiunta come documento personale, in arrivo');
  verifica(!(await P.locator('#sceltaDocumenti >> text=+ Patente').isVisible().catch(() => false)), 'il tasto «+ Patente» sparisce quando c\'è');
  verifica(/Patente.*tuo/.test(await P.locator('#elencoScadenze').textContent()), 'nell\'elenco si vede «Patente · tuo»');
  await P.evaluate(id => DC.COMANDI.fattaScadenza(id), pat.id); await P.waitForTimeout(400);
  verifica(/rinnovata/.test(await P.locator('#moduloTitolo').textContent()), '«Fatto» su un documento chiede la nuova scadenza');
  await P.fill('#m_prossimaData', giorno(3650)); await tocca(P, '#moduloSalva'); await P.waitForTimeout(400);
  verifica(await P.evaluate(id => DC.statoScadenza(DC.dati.scadenze[id]).livello, pat.id) === 'ok', 'rinnovata: in regola');
  await tocca(P, '#sceltaDocumenti >> text=+ Garanzia'); await P.waitForTimeout(400);
  await P.fill('#m_prossimaData', giorno(200)); await tocca(P, '#moduloSalva'); await P.waitForTimeout(400);
  verifica(await P.evaluate(v => Object.values(DC.dati.scadenze).some(x => !x.del && x.voce === 'garanzia' && x.veicolo === v), r1.id), 'la garanzia va sull\'auto');

  console.log('3. Controlli veloci');
  await P.evaluate(() => DC.COMANDI.apriControlli()); await P.waitForTimeout(400);
  verifica(/2 minuti/.test(await P.locator('#moduloTitolo').textContent()), 'si apre la lista «2 minuti per l\'auto»');
  await tocca(P, '#m_c_pressione'); await tocca(P, '#m_c_olio'); await tocca(P, '#moduloSalva'); await P.waitForTimeout(400);
  const ctl = await P.evaluate(() => Object.values(DC.dati.interventi).find(i => !i.del && i.voci.includes('controlli')));
  verifica(ctl && /pressione delle gomme, livello dell'olio/.test(ctl.note) && /tutto a posto/.test(ctl.descrizione), 'segnati nel registro: ' + (ctl && ctl.note));

  console.log('4. Grafico del consumo');
  const rif = []; const km0 = 50000; [18, 17.5, 18.2, 11, 17.8].forEach((kml, i) => { rif.push({ id: 'rif0000' + i, mod: m0, dev: DEV, veicolo: r1.id, data: giorno(-60 + i * 12), km: km0 + i * 600, quantita: i === 0 ? 30 : Math.round(600 / kml * 100) / 100, costo: 60, pieno: true }); });
  await dati(P, { rifornimenti: rif });
  await P.evaluate(id => DC.COMANDI.apriVeicolo(id), r1.id); await P.waitForTimeout(400);
  verifica(await P.locator('#schedaCorpo .grafico svg path.gl').count() === 1, 'nella scheda dell\'auto c\'è il grafico del consumo');
  verifica(await P.locator('#schedaCorpo .grafico circle[fill="#f43f5e"]').count() === 1, 'il pieno anomalo è in rosso');
  await P.evaluate(() => DC.COMANDI.chiudiFinestra('finScheda')); await P.waitForTimeout(300);

  console.log('5. Storico delle gomme');
  await P.evaluate(id => DC.COMANDI.nuoveGomme(id), r1.id); await P.waitForTimeout(400);
  await P.fill('#m_misura', '175/65 r14'); await P.fill('#m_dot', '2318'); await P.fill('#m_montataKm', '50000');
  await tocca(P, '#moduloSalva'); await P.waitForTimeout(400);
  await P.evaluate(id => DC.COMANDI.nuoveGomme(id), r1.id); await P.waitForTimeout(400);
  verifica(await P.inputValue('#m_tipo') === 'invernali' && await P.inputValue('#m_stato') === 'magazzino', 'il secondo treno è proposto invernale e in garage');
  await P.fill('#m_dot', '4024'); await P.fill('#m_kmPrima', '8000'); await tocca(P, '#moduloSalva'); await P.waitForTimeout(400);
  const g1 = await P.evaluate(() => Object.values(DC.dati.gomme).filter(g => !g.del).map(g => ({ t: g.tipo, s: g.stato, k: DC.kmGomme(g), e: DC.etaGomme(g), m: g.misura })));
  const est = g1.find(g => g.t === 'estive'), inv = g1.find(g => g.t === 'invernali');
  verifica(est && est.s === 'montate' && est.k === 2400 && est.m === '175/65 R14', 'estive montate: ' + (est && est.k) + ' km fatti dal montaggio (misura maiuscola)');
  verifica(est && est.e > 6, 'età dal DOT 2318: ' + (est && est.e.toFixed(1)) + ' anni');
  verifica((await P.evaluate(() => DC.avvisiHome().map(x => x.t).join('|'))).includes('Gomme estive: hanno'), 'in Home l\'avviso: gomme con più di 6 anni');
  await P.evaluate(id => DC.COMANDI.nuovoInterventoPer(id), r1.id); await P.waitForTimeout(400);
  await tocca(P, '#finModulo [data-voce="gomme_monta"]'); await P.fill('#m_km', '53000'); await tocca(P, '#moduloSalva'); await P.waitForTimeout(700);
  const g2 = await P.evaluate(() => Object.values(DC.dati.gomme).filter(g => !g.del).map(g => ({ t: g.tipo, s: g.stato, k: DC.kmGomme(g) })));
  verifica(g2.find(g => g.t === 'invernali').s === 'montate' && g2.find(g => g.t === 'estive').s === 'magazzino', 'segnando «Monta le gomme invernali» si scambiano da sole');
  verifica(g2.find(g => g.t === 'estive').k === 3000 && g2.find(g => g.t === 'invernali').k === 8000, 'le estive in garage tengono i loro 3.000 km, le invernali ripartono da 8.000');

  console.log('6. Budget del mese');
  await P.evaluate(() => DC.COMANDI.vai('spese')); await P.waitForTimeout(300);
  verifica(await P.locator('#budgetSpese >> text=Imposta il budget').isVisible(), 'in Spese si imposta il budget');
  await tocca(P, '#budgetSpese >> text=Imposta il budget'); await P.waitForSelector('#finDomanda:not(.hidden)');
  await P.fill('#dom_0', '50'); await tocca(P, '#domandaSi'); await P.waitForTimeout(400);
  await dati(P, { interventi: [{ id: 'spesa001', mod: m0, dev: DEV, veicolo: r1.id, data: giorno(0), voci: ['lavaggio'], costo: 80 }] });
  verifica(/Budget di .*su 50 €/.test((await P.locator('#budgetSpese').textContent()).replace(/\s/g, ' ')) && /superato/.test(await P.locator('#budgetSpese').textContent()), 'budget: ' + (await P.locator('#budgetSpese p').first().textContent()));
  verifica((await P.evaluate(() => DC.avvisiHome().map(x => x.t).join('|'))).includes('superato'), 'in Home l\'avviso del budget superato');

  console.log('7. Spese veloci e multa con lo sconto');
  await P.evaluate(() => DC.COMANDI.vai('home')); await P.waitForTimeout(200);
  await tocca(P, '#barraNuovo >> text=Spesa'); await P.waitForTimeout(400);
  verifica(await P.locator('#m_pagata').isHidden(), 'per un pedaggio non si vedono le voci della multa');
  await P.fill('#m_costo', '7,40'); await P.fill('#m_descrizione', 'A4'); await tocca(P, '#moduloSalva'); await P.waitForTimeout(400);
  verifica(await P.evaluate(() => Object.values(DC.dati.interventi).some(i => !i.del && i.voci[0] === 'pedaggio' && i.costo === 7.4)), 'pedaggio segnato con un tocco');
  await tocca(P, '#barraNuovo >> text=Spesa'); await P.waitForTimeout(400);
  await tocca(P, '#m_voce + .tendina-btn'); await tocca(P, '#tendElenco .tend-voce:has-text("Multa")'); await P.waitForTimeout(200);
  verifica(await P.locator('#m_pagata').isVisible(), 'per la multa compaiono «già pagata» e la data di notifica');
  await P.fill('#m_costo', '100'); await tocca(P, '#moduloSalva'); await P.waitForTimeout(500);
  const mu = await P.evaluate(() => { const s = Object.values(DC.dati.scadenze).find(x => !x.del && x.voce === 'multa'); return s ? { id: s.id, costo: s.costo, data: s.prossimaData, una: s.unaVolta } : null; });
  verifica(mu && mu.costo === 70 && mu.data === giorno(5) && mu.una, 'multa non pagata: promemoria entro 5 giorni con lo sconto (70 € invece di 100)');
  await P.evaluate(id => DC.COMANDI.fattaScadenza(id), mu.id); await P.waitForTimeout(400);
  verifica(await P.inputValue('#m_costo') === '70', '«Fatto» propone l\'importo scontato');
  await tocca(P, '#moduloSalva'); await P.waitForTimeout(500);
  verifica(await P.evaluate(id => DC.dati.scadenze[id].del === true, mu.id), 'pagata: il promemoria della multa sparisce');

  console.log('11. Dove ho parcheggiato (pagina web)');
  await P.evaluate(() => DC.COMANDI.vai('home')); await P.waitForTimeout(200);
  verifica(await P.locator('#homeParcheggio button:has-text("Parcheggio")').isVisible(), 'in Home c\'è «Ho parcheggiato qui»');
  verifica(await P.evaluate(() => { const t = Date.now(); const a = DC.leggiSosta('90', t), b2 = DC.leggiSosta('1h30', t), c = DC.leggiSosta('abc', t); return a === t + 5400000 && b2 === t + 5400000 && c === null; }), 'la sosta si scrive in minuti («90», «1h30») o come ora («18:30»)');

  console.log('Scorrimento con il dito e niente stiramento');
  await P.evaluate(() => { const m = Date.now(), D = 'aaaaaaaaaaaa', ints = []; for (let i = 0; i < 30; i++) ints.push({ id: 'scr' + String(i).padStart(5, '0'), mod: m, dev: D, veicolo: DC.veicoli()[0].id, data: '2026-0' + (1 + i % 9) + '-10', km: 1000 * i, voci: ['olio'], costo: 5 }); DC.unisci({ interventi: ints }); DC.salvaDati(); DC.COMANDI.vai('interventi'); window.scrollTo(0, 0); });
  await P.waitForTimeout(300);
  const cdp = await P.context().newCDPSession(P);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 600 }] });
  for (let k = 1; k <= 20; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 600 - k * 20 }] }); await P.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await P.waitForTimeout(400);
  verifica(await P.evaluate(() => scrollY) > 200, 'trascinando con il dito la pagina scorre (' + await P.evaluate(() => Math.round(scrollY)) + ' px)');
  verifica(await P.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY === 'none' && getComputedStyle(document.body).overflowY === 'visible'), 'oltre la fine la pagina non si stira, e il body non è un\'area che scorre per conto suo');

  console.log('Cambio di tema morbido');
  await P.evaluate(() => { window.__vt = 0; const o = document.startViewTransition && document.startViewTransition.bind(document); if (o) document.startViewTransition = f => { window.__vt++; return o(f); }; DC.COMANDI.apriImpostazioni('aspetto'); });
  await P.waitForTimeout(500);
  const temaPrima = await P.evaluate(() => document.documentElement.getAttribute('data-tema'));
  await tocca(P, '.opz[data-tema="' + (temaPrima === 'scuro' ? 'chiaro' : 'scuro') + '"]'); await P.waitForTimeout(700);
  verifica(await P.evaluate(() => document.documentElement.getAttribute('data-tema')) !== temaPrima && await P.evaluate(() => window.__vt === 1 || document.documentElement.classList.contains('cambio-tema') === false), 'il tema cambia con una dissolvenza (non di scatto)');
  await tocca(P, '.opz[data-tema="auto"]'); await P.waitForTimeout(700);
  await P.evaluate(() => DC.COMANDI.chiudiFinestra('finImpostazioni')); await P.waitForTimeout(600);

  console.log('Impostazioni con le sezioni chiuse e segnalazione allo sviluppatore');
  await P.evaluate(() => DC.COMANDI.vai('home')); await P.waitForTimeout(200);
  await P.evaluate(() => DC.COMANDI.apriImpostazioni()); await P.waitForTimeout(500);
  await tocca(P, '[data-cat="aspetto"]'); await tocca(P, '[data-cat="dati"]');
  await P.evaluate(() => DC.COMANDI.chiudiFinestra('finImpostazioni')); await P.waitForTimeout(700);
  await P.evaluate(() => DC.COMANDI.apriImpostazioni()); await P.waitForTimeout(500);
  verifica(await P.locator('#finImpostazioni [data-cat][aria-expanded="true"]').count() === 0, 'riaprendo Impostazioni tutte le sezioni sono chiuse');
  await tocca(P, '#finImpostazioni [data-click="apriSegnalazione()"]'); await P.waitForTimeout(600);
  verifica(await P.locator('#finSegnala').isVisible(), '«Segnala un problema o un\'idea» apre la finestra della segnalazione');
  await tocca(P, '#finSegnala >> text=Invia con la posta'); await P.waitForTimeout(300);
  verifica(/Scrivi in poche parole/.test(await P.locator('#fbErrore').textContent()), 'senza testo chiede di scrivere cosa è successo');
  await P.fill('#fbTesto', 'Il budget non si aggiorna'); await tocca(P, '#fbVediBtn');
  const ant = await P.locator('#fbAnteprima').textContent();
  verifica(/PROBLEMA – DoctorCar/.test(ant) && /Il budget non si aggiorna/.test(ant) && /Informazioni tecniche/.test(ant) && /veicoli/.test(ant) && !/Panda|AB123CD/.test(ant), 'anteprima: testo, informazioni tecniche e nessun dato personale (nomi, targhe)');
  await tocca(P, '#fbTipo [data-fb="idea"]');
  verifica(/IDEA – DoctorCar/.test(await P.locator('#fbAnteprima').textContent()) && await P.getAttribute('#fbTecnico', 'aria-checked') === 'false', 'per un\'idea le informazioni tecniche si tolgono da sole');
  await P.evaluate(() => DC.COMANDI.chiudiFinestra('finSegnala')); await P.waitForTimeout(600);
  await P.fill('#cercaHome', 'bug'); await P.waitForTimeout(300);
  verifica(/Segnala un problema/.test(await P.locator('#risultatiHome').textContent()), 'la ricerca trova anche «Segnala un problema» (es. «bug»)');
  await P.fill('#cercaHome', ''); await P.waitForTimeout(200);

  console.log('Menu che ripartono dall\'alto, ricerca e Home ordinata');
  await P.evaluate(() => DC.COMANDI.vai('home')); await P.waitForTimeout(200);
  await P.evaluate(() => DC.COMANDI.apriImpostazioni()); await P.waitForTimeout(500);
  for (const c of ['aspetto', 'vibrazione', 'dati', 'info']) { await tocca(P, '[data-cat="' + c + '"]'); }
  await P.evaluate(() => { const f = document.querySelector('#finImpostazioni .foglio'); f.scrollTop = f.scrollHeight; }); await P.waitForTimeout(200);
  verifica(await P.evaluate(() => document.querySelector('#finImpostazioni .foglio').scrollTop) > 300, 'Impostazioni scorse verso il basso');
  await P.evaluate(() => DC.COMANDI.chiudiFinestra('finImpostazioni')); await P.waitForTimeout(700);
  await P.evaluate(() => DC.COMANDI.apriImpostazioni()); await P.waitForTimeout(500);
  verifica(await P.evaluate(() => document.querySelector('#finImpostazioni .foglio').scrollTop) === 0, 'riaprendo, Impostazioni ripartono dall\'alto');
  await P.evaluate(() => DC.COMANDI.chiudiFinestra('finImpostazioni')); await P.waitForTimeout(700);
  verifica(await P.locator('#homeSintesi').isVisible() && await P.locator('#homeSintesi .numero').count() === 3, 'in cima alla Home il colpo d\'occhio: scadenze, spese del mese, km');
  verifica(await P.locator('#bloccoAvvisi').isVisible() && await P.locator('#homeAvvisi .riga').count() <= 3, 'gli avvisi stanno in un solo blocco «Da controllare», al massimo 3 righe');
  verifica(await P.locator('#vista-home >> text=Dati e copia di sicurezza').count() === 0, 'il blocco della copia di sicurezza non è più in Home (è in Impostazioni)');
  await P.fill('#cercaHome', 'backup'); await P.waitForTimeout(300);
  verifica(await P.locator('#homeContenuto').isHidden() && /Copia di sicurezza/.test(await P.locator('#risultatiHome').textContent()), 'cercando «backup» si trova «Copia di sicurezza» (e il resto della Home si nasconde)');
  await tocca(P, '#risultatiHome >> text=Copia di sicurezza'); await P.waitForTimeout(700);
  verifica(await P.locator('#finImpostazioni').isVisible() && await P.locator('[data-cat="dati"]').getAttribute('aria-expanded') === 'true' && await P.inputValue('#cercaHome') === '', 'il risultato apre Impostazioni → Dati, e la ricerca si svuota');
  await P.evaluate(() => DC.COMANDI.chiudiFinestra('finImpostazioni')); await P.waitForTimeout(700);
  await P.fill('#cercaHome', 'scur'); await P.waitForTimeout(300);
  verifica(/Tema chiaro, scuro/.test(await P.locator('#risultatiHome').textContent()), 'basta l\'inizio della parola: «scur» trova il tema scuro');
  await P.fill('#cercaHome', 'panda'); await P.waitForTimeout(300);
  verifica(/Panda/.test(await P.locator('#risultatiHome .riga').first().textContent()), 'si trovano anche le auto per nome o targa');
  await P.fill('#cercaHome', 'revisione'); await P.waitForTimeout(300);
  verifica(/Scadenza/.test(await P.locator('#risultatiHome').textContent()), '…e le scadenze');
  await P.fill('#cercaHome', 'zzzz'); await P.waitForTimeout(300);
  verifica(/Niente trovato/.test(await P.locator('#risultatiHome').textContent()), 'senza risultati lo dice e suggerisce parole');
  await P.fill('#cercaHome', ''); await P.waitForTimeout(300);
  verifica(await P.locator('#homeContenuto').isVisible() && await P.locator('#risultatiHome').isHidden(), 'svuotando la ricerca torna la Home');

  // =============== APP ===============
  console.log('\nApp: posizione, sosta con gli avvisi, notifica dei controlli');
  P = await nuova(APP, true);
  await dati(P, { veicoli: [veic('auto0001', 'Panda')] });
  await P.evaluate(() => DC.impostaProm({ attivo: true, chiesto: true }));
  await tocca(P, '#homeParcheggio button:has-text("Parcheggio")'); await P.waitForTimeout(900);
  verifica(await P.locator('#finPosizione').isVisible() && /Dove sei/.test(await P.locator('#posTitolo').textContent()), 'si apre la schermata «Dove sei»');
  const testoPos = await P.locator('#posCorpo').textContent();
  verifica(/Via Dante 5, Milano/.test(testoPos) && /12 m \(buona\)/.test(testoPos) && /45\.46420, 9\.19000/.test(testoPos), 'mostra indirizzo, precisione (buona) e coordinate');
  await P.evaluate(() => { window.__rit.pos = { lat: 45.4650, lon: 9.1910, precisione: 60 }; });
  await tocca(P, '#posCorpo >> text=Aggiorna la posizione'); await P.waitForTimeout(700);
  verifica(/12 m/.test(await P.locator('#posCorpo').textContent()) && /tengo quella di prima/.test(await P.locator('#posCorpo').textContent()), 'una lettura meno precisa non sostituisce quella buona (e lo dice nella finestra)');
  await P.evaluate(() => { window.__rit.pos = { lat: 45.4644, lon: 9.1902, precisione: 5 }; });
  await tocca(P, '#posCorpo >> text=Aggiorna la posizione'); await P.waitForTimeout(700);
  verifica(/5 m \(buona\)/.test(await P.locator('#posCorpo').textContent()), 'aggiornando, la lettura più precisa prende il posto della vecchia');
  await tocca(P, '#posCorpo >> text=Vedi sulla mappa'); await P.waitForTimeout(300);
  verifica(await P.evaluate(() => window.__nat.some(x => x.m === 'apriMappa' && x.o.lat === 45.4644)), '«Vedi sulla mappa» apre le mappe sul punto letto');
  await P.fill('#posNota', 'Piano -2'); await tocca(P, '#posCorpo >> text=Salva qui il parcheggio'); await P.waitForTimeout(500);
  const pk = await P.evaluate(() => DC.parcheggio());
  verifica(pk && pk.lat === 45.4644 && pk.prec === 5 && pk.nota === 'Piano -2' && pk.veicolo === 'auto0001', 'salvato il punto più preciso con la nota');
  verifica(/Auto parcheggiata alle/.test(await P.locator('#homeParcheggio').textContent()) && await P.locator('#homeParcheggio >> text=Portami lì').isVisible(), 'in Home la scheda del parcheggio con «Portami lì»');
  await tocca(P, '#homeParcheggio >> text=Portami lì'); await P.waitForTimeout(300);
  verifica(await P.evaluate(() => window.__nat.some(x => x.m === 'apriMappa' && x.o.lat === 45.4644)), '«Portami lì» apre le mappe sul punto');
  await tocca(P, '#homeParcheggio >> text=Sosta a tempo'); await P.waitForSelector('#finDomanda:not(.hidden)');
  await P.fill('#dom_0', '45'); await tocca(P, '#domandaSi'); await P.waitForTimeout(1200);
  const sosta = await P.evaluate(() => (window.__prom || []).filter(v => /^sosta:/.test(v.id)).map(v => v.titolo));
  verifica(sosta.length === 2 && /mancano 10 minuti/.test(sosta[0]), 'avvisi della sosta consegnati ad Android: ' + sosta.join(' / '));
  verifica(/Sosta fino alle/.test(await P.locator('#homeParcheggio').textContent()), 'in Home si vede fino a che ora');
  await tocca(P, '#homeParcheggio >> text=Posizione e nota'); await P.waitForTimeout(600);
  verifica(/Posizione del parcheggio/.test(await P.locator('#posTitolo').textContent()) && await P.inputValue('#posNota') === 'Piano -2', 'dalla scheda si riapre la posizione salvata per precisarla');
  await P.evaluate(() => DC.COMANDI.chiudiPosizione()); await P.waitForTimeout(500);
  await tocca(P, '#homeParcheggio >> text=Ho ripreso l\'auto'); await P.waitForTimeout(400);
  verifica(await P.evaluate(() => DC.parcheggio() === null) && await P.locator('#homeParcheggio button:has-text("Parcheggio")').isVisible(), 'ripresa l\'auto: tutto cancellato');

  console.log('Posizione spenta e permesso negato');
  await P.evaluate(() => { window.__rit.posErr = 'SPENTA'; window.__rit.pos = null; });
  await tocca(P, '#homeParcheggio button:has-text("Parcheggio")'); await P.waitForTimeout(700);
  verifica(/posizione del telefono è spenta/.test(await P.locator('#posCorpo').textContent()) && await P.locator('#posCorpo >> text=Attiva la posizione').isVisible(), 'posizione spenta: propone «Attiva la posizione»');
  await tocca(P, '#posCorpo >> text=Attiva la posizione'); await P.waitForTimeout(2300);   // tornati dalle impostazioni si aspetta un attimo che Android accenda la posizione
  verifica(await P.evaluate(() => window.__nat.some(x => x.m === 'attivaPosizione')) && /12 m/.test(await P.locator('#posCorpo').textContent()), 'apre le impostazioni della posizione e, tornati, la legge da sola');
  await P.evaluate(() => DC.COMANDI.chiudiPosizione()); await P.waitForTimeout(500);
  await P.evaluate(() => { window.__rit.posErr = 'PERMESSO'; });
  await tocca(P, '#homeParcheggio button:has-text("Parcheggio")'); await P.waitForTimeout(700);
  verifica(await P.locator('#posCorpo >> text=Dai il permesso').isVisible(), 'permesso negato: propone «Dai il permesso»');
  await tocca(P, '#posCorpo >> text=Dai il permesso'); await P.waitForTimeout(700);
  verifica(await P.locator('#posCorpo >> text=Apri le impostazioni dell\'app').isVisible(), 'negato di nuovo: propone di aprire le impostazioni dell\'app');
  await tocca(P, '#posCorpo >> text=Apri le impostazioni dell\'app'); await P.waitForTimeout(900);
  verifica(await P.evaluate(() => window.__nat.some(x => x.m === 'impostazioniApp')) && /12 m/.test(await P.locator('#posCorpo').textContent()), 'dato il permesso dalle impostazioni, la posizione si legge');
  await P.evaluate(() => { window.__rit.posErr = 'TEMPO'; }); await tocca(P, '#posCorpo >> text=Aggiorna la posizione'); await P.waitForTimeout(600);
  await P.evaluate(() => DC.COMANDI.chiudiPosizione()); await P.waitForTimeout(500);
  await tocca(P, '#homeParcheggio button:has-text("Parcheggio")'); await P.waitForTimeout(700);
  await tocca(P, '#posCorpo >> text=Salva senza posizione'); await P.waitForTimeout(500);
  verifica(await P.evaluate(() => { const p = DC.parcheggio(); return p && p.lat == null; }) && await P.locator('#homeParcheggio button:has-text("Cerca la posizione")').isVisible(), 'senza segnale si salva solo l\'ora e in Home c\'è «Cerca la posizione»');
  await P.evaluate(() => { window.__rit.posErr = ''; DC.COMANDI.ripresaParcheggio(); });
  await P.evaluate(() => { window.__coda.push({ tipo: 'controlli', veicolo: 'auto0001', data: new Date().toISOString().slice(0, 10) }); return window.__applicaCoda(); }); await P.waitForTimeout(400);
  verifica(await P.evaluate(() => Object.values(DC.dati.interventi).some(i => !i.del && i.voci.includes('controlli') && /tutto a posto/.test(i.descrizione))), '«Tutto a posto» dalla notifica: segnato nel registro');
  await P.evaluate(() => { window.__rit.scorciatoia = 'controlli'; return window.__scorciatoia(); }); await P.waitForTimeout(500);
  verifica(/2 minuti/.test(await P.locator('#moduloTitolo').textContent()), 'toccando la notifica si apre la lista dei controlli');

  await P.evaluate(() => { localStorage.setItem('doctorcar_vibrazione', '"si"'); window.__nat.length = 0; });
  await chiudiMod(P); await tocca(P, '.nav[data-vista="spese"]'); await P.waitForTimeout(300);
  verifica(await P.evaluate(() => window.__nat.some(x => x.m === 'vibra' && x.o.tipo === 'scelta')), 'un tocco manda al telefono una vibrazione di tipo «scelta» (il clic aptico di Android)');
  await P.evaluate(() => DC.COMANDI.apriSegnalazione()); await P.waitForTimeout(500);
  await P.fill('#fbTesto', 'Prova'); await tocca(P, '#finSegnala >> text=Invia con la posta'); await P.waitForTimeout(400);
  verifica(await P.evaluate(() => window.__nat.some(x => x.m === 'email' && /DoctorCar .* – problema/.test(x.o.oggetto) && /Prova/.test(x.o.testo))), 'nell\'app «Invia con la posta» apre l\'app di posta con oggetto e testo');
    verifica(errori.length === 0, 'nessun errore in pagina' + (errori.length ? ': ' + errori.slice(0, 3).join(' | ') : ''));
  console.log('\n' + ok + ' riuscite, ' + ko + ' fallite');
  await b.close();
  process.exit(ko ? 1 : 0);
})();
