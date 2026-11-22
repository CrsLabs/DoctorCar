// Le novità della 2.0: «meno tocchi» (auto con i dati importanti, valori già pronti, barra solo in Home, tasti nelle sezioni,
// targa maiuscola, menu a tendina), notifiche con i tasti, scorciatoie e widget, calendario, previsione delle spese,
// importazione CSV, libretto PDF e foglio per l'officina, copia automatica, «chi», avvisi in Home.
// Uso: node prove/novita.js   (server delle pagine: 8786 = web, 8785 = app Android simulata)
const { chromium, devices } = require('playwright');
const WEB = 'http://127.0.0.1:8786/sorgente-DoctorCar.html', APP = 'http://127.0.0.1:8785/index.html';
let ok = 0, ko = 0;
const verifica = (cond, nome) => { if (cond) { ok++; console.log('  ✓ ' + nome); } else { ko++; console.log('  ✗ ' + nome); } };
const giorno = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const MOCK = `(() => {
  window.__nat = []; window.__rit = {}; window.__coda = [];
  window.Capacitor = { isNativePlatform: () => true, addListener: () => ({ remove() {} }),
    nativePromise: (pl, m, o) => {
      window.__nat.push({ m, o });
      if (pl === 'PairWood') return Promise.resolve(m === 'chiediNotifiche' ? { concesso: true } : {});
      if (m === 'statoNotifiche') return Promise.resolve({ concesso: true });
      if (m === 'puoSbloccare') return Promise.resolve({ disponibile: false });
      if (m === 'azioniInCoda') { const a = window.__coda; window.__coda = []; return Promise.resolve({ azioni: a }); }
      if (m === 'scorciatoia') { const c = window.__rit.scorciatoia || ''; window.__rit.scorciatoia = ''; return Promise.resolve({ cosa: c }); }
      if (m === 'scattaFoto') return Promise.resolve(window.__rit.scatto || { annullato: true });
      if (m === 'creaPdf') return Promise.resolve({ dati: btoa('%PDF-finto') });
      if (m === 'scegliCartella') return Promise.resolve({ nome: 'Copie' });
      if (m === 'cartellaCopie') return Promise.resolve({ nome: window.__rit.cartella || '' });
      if (m === 'custodisci') return Promise.resolve({ v: 1, k: 'x', dati: o.dati });
      if (m === 'riprendi') return Promise.resolve({ dati: o.dati || window.__rit.pwDati || '' });
      if (m === 'salvaFile') return Promise.resolve({ salvato: true });
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
    await ctx.addInitScript(() => { window.print = () => { window.__stampato = true; }; });
    const P = await ctx.newPage();
    P.on('pageerror', e => errori.push('errore: ' + e.message));
    P.on('console', m => { if (m.type() === 'error') errori.push('console: ' + m.text()); });
    await P.goto(url); await P.waitForTimeout(600);
    return P;
  };
  const dati = (P, d) => P.evaluate(d => { DC.unisci(d); DC.salvaDati(); DC.disegna(); }, d);
  const chiudiMod = async P => { await P.evaluate(() => { DC.COMANDI.chiudiModulo(); }); await P.waitForTimeout(300); if (await P.locator('#finDomanda').isVisible().catch(() => false)) await P.locator('#domandaAlt').click(); await P.waitForTimeout(300); };
  const tocca = async (P, sel) => { await P.locator(sel).first().click({ timeout: 8000 }); await P.waitForTimeout(250); };

  // =============== PAGINA WEB ===============
  let P = await nuova(WEB, false);
  console.log('Barra «+ Intervento / + Rifornimento / Km»: solo in Home, un po\' più alta della barra delle pagine');
  const alt = async sel => (await P.locator(sel).first().boundingBox()).height;
  verifica(await P.locator('#barraNuovo').isVisible(), 'in Home la barra c\'è');
  const hBar = await alt('#barraNuovo .bn');
  verifica(hBar > 60 && hBar < 90, 'tasti della barra alti ' + Math.round(hBar) + ' px (poco più di quelli della barra pagine)');
  for (const v of ['interventi', 'scadenze', 'rifornimenti', 'spese', 'veicoli']) {
    await P.evaluate(v => DC.COMANDI.vai(v), v); await P.waitForTimeout(150);
    verifica(!(await P.locator('#barraNuovo').isVisible()), 'in «' + v + '» la barra non c\'è');
  }
  await P.evaluate(() => DC.COMANDI.vai('home')); await P.waitForTimeout(150);

  console.log('Tasti per aggiungere dentro ogni sezione');
  await dati(P, { veicoli: [veic('auto0001', 'Panda')] });
  for (const [v, testo] of [['interventi', 'Nuovo intervento'], ['scadenze', 'Nuova scadenza'], ['rifornimenti', 'Rifornimento'], ['rifornimenti', 'Aggiorna i km'], ['veicoli', 'veicolo']]) {
    await P.evaluate(v => DC.COMANDI.vai(v), v); await P.waitForTimeout(150);
    verifica(await P.locator('#vista-' + v + ' >> text=' + testo).first().isVisible().catch(() => false), 'in «' + v + '» c\'è «' + testo + '»');
  }

  console.log('Nuovo veicolo: i dati importanti subito, senza secondi passaggi');
  await P.evaluate(() => DC.COMANDI.nuovoVeicolo()); await P.waitForTimeout(400);
  await P.fill('#m_nome', 'Golf'); await P.fill('#m_targa', 'ab 123cd');
  verifica(await P.inputValue('#m_targa') === 'AB123CD', 'la targa diventa maiuscola e senza spazi mentre si scrive (' + await P.inputValue('#m_targa') + ')');
  verifica(await P.getAttribute('#m_targa', 'autocapitalize') === 'characters', 'la tastiera propone le maiuscole');
  verifica(await P.getAttribute('#m_nome', 'autocapitalize') === 'words' && await P.getAttribute('#m_nome', 'spellcheck') === 'true', 'negli altri campi la tastiera suggerisce e corregge');
  await P.fill('#m_kmIniziali', '54200'); await P.fill('#m_assicurazione', giorno(40)); await P.fill('#m_bollo', giorno(200));
  await P.fill('#m_revisione', giorno(-200)); await P.fill('#m_tagliandoData', giorno(-100)); await P.fill('#m_tagliandoKm', '47000');
  await tocca(P, '#m_gomme');
  await tocca(P, '#moduloSalva'); await P.waitForTimeout(600);
  const r = await P.evaluate(() => {
    const v = DC.veicoli().find(x => x.nome === 'Golf'), sc = Object.values(DC.dati.scadenze).filter(x => !x.del && x.veicolo === v.id);
    return { targa: v.targa, n: sc.length, voci: sc.map(x => x.voce), ass: (sc.find(x => x.voce === 'assicurazione') || {}).prossimaData, tag: sc.find(x => x.voce === 'tagliando'), km: DC.kmAttuali(v.id), gomme: sc.filter(x => /gomme/.test(x.voce)).length };
  });
  verifica(r.targa === 'AB123CD', 'targa salvata maiuscola');
  verifica(r.n >= 6 && r.voci.includes('assicurazione') && r.voci.includes('bollo') && r.voci.includes('revisione') && r.voci.includes('tagliando'), 'nascono da sole ' + r.n + ' scadenze (' + r.voci.join(', ') + ')');
  verifica(r.ass === giorno(40), 'l\'assicurazione ha già la data scritta');
  verifica(r.tag && r.tag.ultimiKm === 47000 && r.tag.ultimaData === giorno(-100), 'il tagliando ha già data e km dell\'ultima volta');
  verifica(r.km === 54200, 'i km scritti sono la prima lettura del contachilometri');
  verifica(r.gomme === 2, 'con le gomme invernali nascono montaggio e smontaggio');
  verifica(/Golf aggiunta con/.test(await P.locator('#avvisoTesto').textContent()), 'messaggio: ' + await P.locator('#avvisoTesto').textContent());

  console.log('Gomme invernali dalla scheda del veicolo');
  await dati(P, { veicoli: [veic('auto0002', 'Fiesta')] });
  await P.evaluate(() => DC.COMANDI.apriVeicolo('auto0002')); await P.waitForTimeout(300);
  verifica(await P.locator('#schedaCorpo >> text=Gomme invernali').first().isVisible(), 'il tasto «Gomme invernali» c\'è');
  await tocca(P, '#schedaCorpo >> text=Gomme invernali'); await P.waitForTimeout(400);
  verifica(await P.evaluate(() => Object.values(DC.dati.scadenze).filter(x => !x.del && x.veicolo === 'auto0002' && /gomme/.test(x.voce)).length) === 2, 'create le due scadenze');
  verifica(!(await P.locator('#schedaCorpo >> text=Gomme invernali (montaggio').first().isVisible().catch(() => false)), 'il tasto sparisce quando ci sono già');
  await P.evaluate(() => DC.COMANDI.chiudiFinestra('finScheda')); await P.waitForTimeout(300);

  console.log('Rifornimento: litri, prezzo, importo — due e il terzo si calcola');
  await P.evaluate(() => DC.COMANDI.nuovoRifornimento()); await P.waitForTimeout(400);
  await P.fill('#m_quantita', '40'); await P.fill('#m_prezzo', '1,8');
  verifica(await P.inputValue('#m_costo') === '72', 'litri × prezzo = importo (' + await P.inputValue('#m_costo') + ')');
  await chiudiMod(P);

  console.log('Previsione delle spese e avvisi in Home');
  await P.evaluate(() => { localStorage.clear(); });
  P = await nuova(WEB, false);
  await dati(P, {
    veicoli: [veic('auto0001', 'Panda', { targa: 'AA111BB' })],
    scadenze: [{ id: 'scad0001', mod: m0, dev: DEV, veicolo: 'auto0001', voce: 'tagliando', nome: 'Tagliando', ogniMesi: 12, ultimaData: giorno(-300) }, { id: 'scad0002', mod: m0, dev: DEV, veicolo: 'auto0001', voce: 'bollo', nome: 'Bollo', ogniMesi: 12, prossimaData: giorno(100) }],
    interventi: [{ id: 'int00001', mod: m0, dev: DEV, veicolo: 'auto0001', data: giorno(-300), km: 40000, voci: ['tagliando'], costo: 250 }],
    letture: [{ id: 'let00001', mod: m0, dev: DEV, veicolo: 'auto0001', data: giorno(-30), km: 52000 }, { id: 'let00002', mod: m0, dev: DEV, veicolo: 'auto0001', data: giorno(-2), km: 48000 }],
  });
  const pr = await P.evaluate(() => DC.previsioneSpese(''));
  verifica(pr.voci.length === 2 && pr.voci.find(v => v.nome === 'Tagliando').costo === 250 && pr.senzaCosto === 1, 'previsione: il tagliando costerà come l\'ultima volta (250 €), il bollo non ha ancora un costo');
  await P.evaluate(() => DC.COMANDI.vai('spese')); await P.waitForTimeout(300);
  verifica(await P.locator('#previsioneSpese').isVisible() && /Previsione dei prossimi 12 mesi/.test(await P.locator('#previsioneSpese').textContent()), 'in Spese compare la previsione dei 12 mesi');
  const av = await P.evaluate(() => DC.avvisiHome().map(x => x.t));
  verifica(av.some(t => /più basso/.test(t)), 'avviso: km più bassi di una lettura precedente');
  await P.evaluate(() => DC.COMANDI.vai('home')); await P.waitForTimeout(300);
  verifica(await P.locator('#homeAvvisi').isVisible(), 'gli avvisi si vedono in Home');

  console.log('Come l\'ultima volta, officina e costo già pronti');
  await dati(P, { interventi: [{ id: 'int00002', mod: m0 + 5, dev: DEV, veicolo: 'auto0001', data: giorno(-20), km: 51000, voci: ['olio'], officina: 'Rossi Auto', costo: 90 }] });
  await P.evaluate(() => DC.COMANDI.fattaScadenza('scad0001')); await P.waitForTimeout(400);
  verifica(await P.inputValue('#m_officina') === 'Rossi Auto' || await P.inputValue('#m_costo') === '250', 'da «Fatto» officina e costo arrivano dall\'ultima volta (' + await P.inputValue('#m_officina') + ' / ' + await P.inputValue('#m_costo') + ')');
  await chiudiMod(P);

  console.log('Importare un\'altra app (CSV)');
  const fuelio = '"Data";"Odo (km)";"Fuel (litres)";"Full (0=Partial, 1=Full)";"Price (optional)";"l/100km (optional)";"Notes (optional)";"Cost"\n"2025-01-10";"50000";"40,5";"1";"1,80";"";"";"72,90"\n"2025-02-14";"50500";"35";"0";"1,75";"";"in viaggio";"61,25"\n"2025-03-02";"51100";"38,2";"1";"1,70";"";"";"64,94"\n';
  const an = await P.evaluate(t => DC.analizzaTabella(t), fuelio);
  verifica(an.ok && an.rifornimenti === 3 && an.righe[0].quantita === 40.5 && an.righe[0].costo === 72.9 && an.righe[1].pieno === false && an.righe[0].km === 50000, 'Fuelio: 3 rifornimenti con litri, costo, pieno e km');
  const drivvo = 'Date,Odometer,Type,Total Cost,Notes\n05/03/2025,52000,Service,150.00,Cambio olio\n20/03/2025,52500,Fuel,50.00,\n';
  const an2 = await P.evaluate(t => DC.analizzaTabella(t), drivvo);
  verifica(an2.ok && an2.interventi === 1 && an2.righe[0].data === '2025-03-05' && an2.righe[0].costo === 150, 'Drivvo: la riga «Service» diventa un intervento (data gg/mm/aaaa)');
  const sbagliato = await P.evaluate(() => DC.analizzaTabella('ciao;mondo\n1;2'));
  verifica(!sbagliato.ok, 'un file che non c\'entra viene rifiutato con un messaggio');
  const ap = await P.evaluate(t => { const a = DC.analizzaTabella(t); const x = DC.applicaTabella(a, 'auto0001'); const y = DC.applicaTabella(a, 'auto0001'); return { x, y }; }, fuelio);
  verifica(ap.x.nr === 3 && ap.y.nr === 0 && ap.y.doppi === 3, 'importati 3 rifornimenti, la seconda volta nessun doppione');
  P.on('dialog', d => d.accept());
  await P.evaluate(() => { localStorage.setItem('doctorcar_chi', 'Marco'); });

  console.log('«Chi» ha segnato e filtro');
  await P.evaluate(() => { DC.COMANDI.impostaChi({ target: { value: 'Marco' } }); });
  await dati(P, { interventi: [{ id: 'int00003', mod: m0 + 9, dev: DEV, veicolo: 'auto0001', data: giorno(-1), km: 52100, voci: ['olio'], chi: 'Anna' }, { id: 'int00004', mod: m0 + 9, dev: DEV, veicolo: 'auto0001', data: giorno(-3), km: 52000, voci: ['olio'], chi: 'Marco' }] });
  await P.evaluate(() => DC.COMANDI.vai('interventi')); await P.waitForTimeout(300);
  verifica(await P.locator('#vista-interventi .chips-chi').isVisible(), 'con più persone compaiono i tasti per filtrare');
  verifica(await P.evaluate(() => DC.chiDistinti().join()) !== '', 'persone riconosciute: ' + await P.evaluate(() => DC.chiDistinti().join(', ')));
  await P.evaluate(() => DC.COMANDI.filtraChi('Anna')); await P.waitForTimeout(200);
  verifica(await P.locator('#elencoInterventi .riga').count() === 1, 'filtrando «Anna» resta il suo intervento');
  await P.evaluate(() => DC.COMANDI.filtraChi('')); 

  console.log('Libretto e foglio per l\'officina (sul computer: stampa)');
  await P.evaluate(() => DC.COMANDI.libretto('auto0001')); await P.waitForTimeout(500);
  verifica(await P.evaluate(() => window.__stampato === true && /Panda/.test(document.getElementById('stampa').textContent) && /Interventi/.test(document.getElementById('stampa').textContent)), 'il libretto va in stampa con veicolo e interventi');
  verifica(await P.evaluate(() => /Panda — AA111BB/.test(DC.testoOfficina(DC.veicoli()[0])) && /Ultimi interventi/.test(DC.testoOfficina(DC.veicoli()[0]))), 'foglio per l\'officina: auto, targa, ultimi interventi');

  console.log('Calendario nello stile dell\'app, Indietro, altro veicolo, eliminare un veicolo');
  await P.evaluate(() => DC.COMANDI.vai('home')); await P.waitForTimeout(200);
  verifica(await P.locator('#homeVeicoli >> text=Aggiungi un altro veicolo').isVisible(), 'in Home c\'è «Aggiungi un altro veicolo»');
  await P.evaluate(() => DC.COMANDI.vai('interventi')); await P.waitForTimeout(200);
  verifica(await P.evaluate(() => document.querySelector('#vista-interventi .chips[data-filtro]').innerHTML.includes('+ Veicolo')), 'nei filtri c\'è «+ Veicolo»');
  await P.evaluate(() => DC.COMANDI.vai('home')); await P.waitForTimeout(200);
  await tocca(P, '#homeVeicoli >> text=Aggiungi un altro veicolo'); await P.waitForTimeout(400);
  verifica(await P.locator('#finModulo').isVisible() && /Nuovo veicolo/.test(await P.locator('#moduloTitolo').textContent()), 'si apre subito il modulo del nuovo veicolo');
  verifica(await P.locator('#m_immatricolazione + .tendina-btn').isVisible() && await P.evaluate(() => getComputedStyle(document.getElementById('m_immatricolazione')).opacity) === '0', 'il campo data è il pulsante dell\'app, non quello di Android');
  await tocca(P, '#m_immatricolazione + .tendina-btn'); await P.waitForTimeout(300);
  verifica(await P.locator('#finData').isVisible(), 'si apre il calendario dell\'app');
  await tocca(P, '#calCorpo .cal-mese'); await P.waitForTimeout(200);
  await tocca(P, '#calCorpo [data-anno="2018"]'); await P.waitForTimeout(200);
  await tocca(P, '#calCorpo [data-giorno$="-10"]'); await P.waitForTimeout(300);
  verifica(await P.locator('#finData').isVisible() && await P.inputValue('#m_immatricolazione') === '', 'un tocco sul giorno lo evidenzia soltanto: la data non cambia finché non si conferma');
  const g10 = await P.locator('#calCorpo [data-giorno$="-10"]').getAttribute('data-giorno'), col = await P.evaluate(d => (new Date(d + 'T12:00:00').getDay() + 6) % 7, g10);
  const x0 = await P.locator('#calCorpo [data-giorno$="-10"]').boundingBox(), t0 = await P.locator('#calCorpo .cal-sett').nth(col).boundingBox();
  verifica(Math.abs((x0.x + x0.width / 2) - (t0.x + t0.width / 2)) < x0.width, 'i numeri dei giorni sono allineati alle lettere dei giorni della settimana');
  // cambiando mese l'altezza del calendario non cambia (sempre sei righe): i tasti sotto non si spostano
  const yc = async () => (await P.locator('#calConferma').boundingBox()).y;
  const y1 = await yc(); await tocca(P, '#calCorpo [data-cal="1"]'); const y2 = await yc(); await tocca(P, '#calCorpo [data-cal="1"]'); const y3 = await yc(); await tocca(P, '#calCorpo [data-cal="-1"]'); await tocca(P, '#calCorpo [data-cal="-1"]');
  verifica(y1 === y2 && y2 === y3, 'cambiando mese «Conferma» resta allo stesso posto (' + y1 + ' / ' + y2 + ' / ' + y3 + ')');
  await tocca(P, '#calConferma'); await P.waitForTimeout(500);
  const dv = await P.inputValue('#m_immatricolazione');
  verifica(/^2018-\d{2}-10$/.test(dv) && !(await P.locator('#finData').isVisible()), 'scegliendo anno e giorno la data è ' + dv + ' e il calendario si chiude');
  verifica(/2018/.test(await P.locator('#m_immatricolazione + .tendina-btn').textContent()), 'il pulsante mostra la data scelta');
  await P.fill('#m_nome', 'Seconda auto'); await tocca(P, '#moduloSalva'); await P.waitForTimeout(500);
  verifica(await P.evaluate(() => DC.veicoli().length) >= 2, 'la seconda auto è stata aggiunta');
  // revisione: dall'immatricolazione 2018 → 2022, poi ogni 2 anni: la prossima non ancora passata
  const rev = await P.evaluate(() => { const v = DC.veicoli().find(x => x.nome === 'Seconda auto'); const s = Object.values(DC.dati.scadenze).find(x => !x.del && x.veicolo === v.id && x.voce === 'revisione'); return s ? DC.statoScadenza(s) : null; });
  verifica(rev && rev.data >= giorno(0) && rev.livello !== 'scaduta', 'revisione calcolata portata a oggi: ' + (rev && rev.data));
  // Indietro dalla tastiera/dall'app
  verifica(await P.evaluate(() => window.__indietroNativo()) === false, 'Indietro dalla Home: la pagina non lo gestisce (l\'app va in secondo piano)');
  await P.evaluate(() => DC.COMANDI.apriVeicolo(DC.veicoli()[0].id)); await P.waitForTimeout(300);
  verifica(await P.evaluate(() => window.__indietroNativo()) === true && await P.waitForTimeout(500).then(() => P.locator('#finScheda').isHidden()), 'Indietro con una scheda aperta: si chiude subito, un solo tocco');
  await P.evaluate(() => DC.COMANDI.vai('spese')); await P.waitForTimeout(200);
  verifica(await P.evaluate(() => window.__indietroNativo()) === true && await P.evaluate(() => !document.getElementById('vista-home').classList.contains('hidden')), 'Indietro da una sezione: torna in Home');
  verifica(await P.evaluate(() => window.__indietroNativo()) === false, 'e da lì un secondo Indietro porta fuori');
  const prima = await P.evaluate(() => DC.veicoli().length);
  await P.evaluate(() => DC.COMANDI.apriVeicolo(DC.veicoli().find(x => x.nome === 'Seconda auto').id)); await P.waitForTimeout(300);
  verifica(await P.locator('#schedaCorpo >> text=Elimina il veicolo').isVisible(), 'nella scheda del veicolo c\'è «Elimina il veicolo»');
  await tocca(P, '#schedaCorpo >> text=Elimina il veicolo'); await P.waitForSelector('#finDomanda:not(.hidden)'); await tocca(P, '#domandaSi'); await P.waitForTimeout(600);
  verifica(await P.evaluate(() => DC.veicoli().length) === prima - 1, 'dopo la conferma il veicolo non c\'è più');
  verifica(await P.evaluate(() => Object.values(DC.dati.scadenze).filter(x => !x.del && !DC.veicoli().some(v => v.id === x.veicolo)).length) === 0, 'con lui sono sparite anche le sue scadenze');

  console.log('Costi di bollo e assicurazione');
  await P.evaluate(() => DC.COMANDI.nuovoVeicolo()); await P.waitForTimeout(400);
  await P.fill('#m_nome', 'Con costi'); await P.fill('#m_assicurazione', giorno(60)); await P.fill('#m_assicurazioneCosto', '480'); await P.fill('#m_bollo', giorno(90)); await P.fill('#m_bolloCosto', '195,50');
  await tocca(P, '#moduloSalva'); await P.waitForTimeout(500);
  const cs = await P.evaluate(() => { const v = DC.veicoli().find(x => x.nome === 'Con costi'); const sc = Object.values(DC.dati.scadenze).filter(x => !x.del && x.veicolo === v.id); return { id: v.id, ass: (sc.find(x => x.voce === 'assicurazione') || {}).costo, bollo: (sc.find(x => x.voce === 'bollo') || {}).costo, sa: (sc.find(x => x.voce === 'assicurazione') || {}).id }; });
  verifica(cs.ass === 480 && cs.bollo === 195.5, 'nel nuovo veicolo si scrivono data e costo di assicurazione e bollo (' + cs.ass + ' / ' + cs.bollo + ')');
  const pv = await P.evaluate(id => DC.previsioneSpese(id), cs.id);
  verifica(pv.voci.find(v => /Assicurazione/.test(v.nome)).costo === 480, 'la previsione delle spese usa i costi scritti');
  await P.evaluate(id => DC.COMANDI.fattaScadenza(id), cs.sa); await P.waitForTimeout(400);
  verifica(await P.inputValue('#m_costo') === '480', 'da «Fatto» il costo dell\'assicurazione è già proposto');
  await chiudiMod(P);
  await P.evaluate(id => DC.COMANDI.modificaScadenza(id), cs.sa); await P.waitForTimeout(400);
  verifica(await P.locator('#m_costo').isVisible(), 'nella scadenza c\'è il campo «Quanto costa di solito»');
  await chiudiMod(P);

  console.log('Tasto Home nella barra e tocco fuori dai menu');
  await P.evaluate(() => DC.COMANDI.vai('spese')); await P.waitForTimeout(250);
  await tocca(P, '#navVoci .nav[data-vista="home"]'); await P.waitForTimeout(300);
  verifica(await P.evaluate(() => !document.getElementById('vista-home').classList.contains('hidden')), 'il tasto «Home» della barra in basso porta in Home');
  verifica(await P.locator('#navVoci .nav').count() === 6 && await P.locator('#navVoci .nav[data-vista="home"] span').textContent() === 'Home', 'la barra ha sei tasti, il primo è Home');
  await P.evaluate(() => DC.COMANDI.apriImpostazioni()); await P.waitForTimeout(500);
  await P.mouse.click(5, 40); await P.waitForTimeout(700);
  verifica(await P.locator('#finImpostazioni').isHidden(), 'toccando fuori da Impostazioni (sullo sfondo) si chiude');
  await P.evaluate(() => DC.COMANDI.apriVeicolo(DC.veicoli()[0].id)); await P.waitForTimeout(500);
  await P.mouse.click(5, 40); await P.waitForTimeout(700);
  verifica(await P.locator('#finScheda').isHidden(), 'toccando fuori dalla scheda del veicolo si chiude');
  await P.evaluate(() => DC.COMANDI.nuovoIntervento()); await P.waitForTimeout(500);
  await tocca(P, '#m_voce + .tendina-btn').catch(() => {}); await P.waitForTimeout(400);
  const tendAperta = await P.locator('#finTendina').isVisible();
  if (tendAperta) { await P.mouse.click(5, 40); await P.waitForTimeout(700); }
  verifica(!tendAperta || await P.locator('#finTendina').isHidden(), 'toccando fuori da una tendina si chiude');
  await chiudiMod(P);
  await P.evaluate(() => DC.COMANDI.aggiornaKm()); await P.waitForTimeout(500);
  await P.mouse.click(5, 40); await P.waitForTimeout(700);
  verifica(await P.locator('#finModulo').isHidden(), 'toccando fuori da un modulo senza modifiche si chiude');

  console.log('Primo avvio: si propone subito di aggiungere il veicolo');
  { const ctx2 = await b.newContext({ ...devices['Pixel 7'], locale: 'it-IT' });
    await ctx2.addInitScript(() => { window.__primoAvvio = true; });
    const Q = await ctx2.newPage(); await Q.goto(WEB); await Q.waitForTimeout(2200);
    verifica(await Q.locator('#finModulo').isVisible() && /Nuovo veicolo/.test(await Q.locator('#moduloTitolo').textContent()), 'al primo avvio si apre il modulo «Nuovo veicolo»');
    await Q.evaluate(() => { DC.COMANDI.chiudiModulo(); }); await Q.waitForTimeout(500);
    await Q.reload(); await Q.waitForTimeout(2500);
    verifica(!(await Q.locator('#finModulo').isVisible()), 'chiuso, non si ripropone a ogni apertura (resta il tasto in Home)');
    await ctx2.close(); }

  // =============== APP ANDROID (simulata) ===============
  console.log('\nApp: tasti nelle notifiche, scorciatoie, calendario, PDF, copia automatica');
  P = await nuova(APP, true);
  await dati(P, {
    veicoli: [veic('auto0001', 'Panda', { targa: 'AA111BB' })],
    scadenze: [{ id: 'scad0001', mod: m0, dev: DEV, veicolo: 'auto0001', voce: 'bollo', nome: 'Bollo', ogniMesi: 12, prossimaData: giorno(20) }],
    letture: [{ id: 'let00001', mod: m0, dev: DEV, veicolo: 'auto0001', data: giorno(-5), km: 50000 }],
  });
  await P.waitForTimeout(500);

  await P.evaluate(() => { window.__coda.push({ tipo: 'fatto', scadenza: 'scad0001', voce: 'bollo', veicolo: 'auto0001', data: new Date().toISOString().slice(0, 10) }, { tipo: 'km', veicolo: 'auto0001', km: 50800, data: new Date().toISOString().slice(0, 10) }, { tipo: 'km', veicolo: 'nessuna', km: 5, data: '2025-01-01' }, { tipo: 'fatto', scadenza: 'sbagliata' }); return window.__applicaCoda(); });
  await P.waitForTimeout(600);
  const c = await P.evaluate(() => ({ int: Object.values(DC.dati.interventi).filter(x => !x.del && x.voci.includes('bollo')).length, km: DC.kmAttuali('auto0001') }));
  verifica(c.int === 1, '«Fatto oggi» dalla notifica: nel registro c\'è l\'intervento');
  verifica(c.km === 50800, 'i km scritti nella risposta alla notifica sono salvati');
  await P.evaluate(() => window.__applicaCoda()); await P.waitForTimeout(300);
  verifica(await P.evaluate(() => Object.values(DC.dati.interventi).filter(x => !x.del && x.voci.includes('bollo')).length) === 1, 'la stessa azione non si applica due volte');
  const stato = await P.evaluate(() => { const s = Object.values(DC.dati.scadenze)[0]; return DC.statoScadenza(s).livello; });
  verifica(stato === 'ok', 'dopo «Fatto oggi» la scadenza è in regola (' + stato + ')');

  await P.evaluate(() => { window.__rit.scorciatoia = 'km'; return window.__scorciatoia(); }); await P.waitForTimeout(600);
  verifica(await P.locator('#finModulo').isVisible() && /Aggiorna i km/.test(await P.locator('#moduloTitolo').textContent()), 'scorciatoia «Km»: si apre direttamente «Aggiorna i km»');
  await P.evaluate(() => { DC.COMANDI.chiudiFinestra('finModulo'); }); await P.waitForTimeout(300);
  await P.evaluate(() => { window.__rit.scorciatoia = 'rifornimento'; return window.__scorciatoia(); }); await P.waitForTimeout(600);
  verifica(/Nuovo rifornimento/.test(await P.locator('#moduloTitolo').textContent()), 'scorciatoia «Rifornimento»: si apre il modulo');
  await P.evaluate(() => { DC.COMANDI.chiudiFinestra('finModulo'); }); await P.waitForTimeout(300);
  await dati(P, { veicoli: [veic('auto0002', 'Golf', { tipo: 'auto' })], scadenze: [{ id: 'scad0009', mod: m0, dev: DEV, veicolo: 'auto0002', voce: 'assicurazione', nome: 'Assicurazione', ogniMesi: 12, prossimaData: giorno(5) }], letture: [{ id: 'let00009', mod: m0, dev: DEV, veicolo: 'auto0002', data: giorno(-1), km: 80100 }] });
  const wg = await P.evaluate(() => DC.testoWidget());
  verifica(wg.righe.length >= 2 && wg.righe.some(r => /Golf/.test(r.t)) && wg.righe.some(r => /Panda/.test(r.t)) && /Golf 80\.100 km/.test(wg.intest) && /Panda/.test(wg.intest), 'widget grande: scadenze di più auto (' + wg.righe.map(r => r.t + ' ' + r.d).join(' | ') + ') e km di ciascuna nell\'intestazione');
  verifica(wg.righe.some(r => r.d === '5 g') && wg.righe.every(r => ['scaduta', 'vicina', 'ok'].includes(r.l)), 'ogni riga ha la durata breve e il colore (urgenza)');
  const w = await P.evaluate(() => DC.testoWidget());
  verifica(w.riga1.length > 0 && w.riga2.length > 0, 'widget compatto: prossima scadenza pronta (' + w.riga1 + ' — ' + w.riga2 + ')');
  await P.evaluate(() => { DC.COMANDI.vai('home'); }); await P.waitForTimeout(2200);
  verifica(await P.evaluate(() => window.__nat.some(x => x.m === 'aggiornaWidget')), 'il widget viene aggiornato quando i dati cambiano');

  await P.evaluate(() => DC.COMANDI.apriScadenza('scad0001')); await P.waitForTimeout(400);
  verifica(await P.locator('#schedaCorpo >> text=Aggiungi al calendario').first().isVisible(), 'in ogni scadenza c\'è «Aggiungi al calendario»');
  await tocca(P, '#schedaCorpo >> text=Aggiungi al calendario'); await P.waitForTimeout(400);
  const cal = await P.evaluate(() => window.__nat.filter(x => x.m === 'aggiungiAlCalendario').pop());
  verifica(cal && /^\d{4}-\d{2}-\d{2}$/.test(cal.o.data) && /Bollo/.test(cal.o.titolo), 'al calendario va il titolo e la data (' + (cal && cal.o.data) + ')');
  await P.evaluate(() => DC.COMANDI.chiudiFinestra('finScheda')); await P.waitForTimeout(300);

  await P.evaluate(() => DC.COMANDI.apriVeicolo('auto0001')); await P.waitForTimeout(300);
  await tocca(P, '#schedaCorpo >> text=Libretto in PDF'); await P.waitForTimeout(900);
  verifica(await P.evaluate(() => window.__nat.some(x => x.m === 'creaPdf' && /Panda/.test(x.o.html))), 'il PDF viene preparato da Android con i dati dell\'auto');
  verifica(await P.locator('#finDomanda').isVisible(), 'poi si sceglie: condividi o salva');
  await tocca(P, '#domandaSi'); await P.waitForTimeout(500);
  verifica(await P.evaluate(() => window.__nat.some(x => x.m === 'condividiFile' && x.o.mime === 'application/pdf')), '«Condividi» apre il menu di Android col PDF');
  await tocca(P, '#schedaCorpo >> text=Per l\'officina'); await P.waitForTimeout(400);
  verifica(await P.evaluate(() => window.__nat.some(x => x.m === 'condividiFile' && /AA111BB/.test(x.o.testo || ''))), '«Per l\'officina» condivide il foglio di testo');
  await P.evaluate(() => DC.COMANDI.chiudiFinestra('finScheda')); await P.waitForTimeout(300);

  console.log('Fotocamera dell\'app (la stessa di DoctorWood)');
  await P.evaluate(() => DC.COMANDI.nuovoIntervento()); await P.waitForTimeout(500);
  await P.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 64, 48); window.__rit.scatto = { foto: [{ nome: 'foto-1.jpg', dati: c.toDataURL('image/jpeg').split(',')[1] }, { nome: 'foto-2.jpg', dati: c.toDataURL('image/jpeg').split(',')[1] }] }; });
  await tocca(P, '#m_foto_tasti >> text=Scatta foto'); await P.waitForTimeout(1500);
  verifica(await P.evaluate(() => window.__nat.some(x => x.m === 'scattaFoto')), '«Scatta foto» apre la fotocamera dell\'app (non quella del telefono)');
  verifica(await P.locator('#m_foto .foto-mini, #m_foto > *').count() === 2, 'le due foto scattate sono nella scheda dell\'intervento (' + await P.locator('#m_foto > *').count() + ')');
  await P.evaluate(() => { window.__rit.scatto = null; });
  await tocca(P, '#m_foto_tasti >> text=Scatta foto'); await P.waitForTimeout(700);
  verifica(await P.locator('#m_foto > *').count() === 2, 'annullando la fotocamera non cambia niente');
  await chiudiMod(P);

  console.log('Copia automatica in una cartella');
  await P.evaluate(() => DC.COMANDI.apriImpostazioni('dati')); await P.waitForTimeout(500);
  verifica(await P.locator('#autoCopiaScegli').isVisible(), 'in Impostazioni → Dati c\'è la copia automatica');
  await tocca(P, '#autoCopiaScegli'); await P.waitForSelector('#finDomanda:not(.hidden)');
  await P.fill('#dom_0', 'password-molto-lunga-1'); await P.fill('#dom_1', 'password-molto-lunga-1');
  await P.evaluate(() => { window.__rit.cartella = 'Copie'; });
  await tocca(P, '#domandaSi'); await P.waitForTimeout(2500);
  const scritta = await P.evaluate(() => window.__nat.filter(x => x.m === 'scriviInCartella'));
  verifica(scritta.length === 1 && /^DoctorCar-copia-\d{4}-\d{2}-\d{2}\.dccopia$/.test(scritta[0].o.nome), 'scelta la cartella, la prima copia parte subito (' + (scritta[0] && scritta[0].o.nome) + ')');
  const busta = scritta[0] && JSON.parse(await P.evaluate(d => atob(d), scritta[0].o.dati));
  verifica(busta && busta.app === 'DoctorCar' && busta.formato === 'copia' && !/Panda/.test(JSON.stringify(busta)), 'la copia è cifrata (nessun nome in chiaro)');
  verifica(/Attiva/.test(await P.locator('#autoCopiaStato').textContent()), 'stato: ' + await P.locator('#autoCopiaStato').textContent());
  const n0 = await P.evaluate(() => window.__nat.filter(x => x.m === 'scriviInCartella').length);
  await P.evaluate(() => window.__eseguiAutoCopia(false)); await P.waitForTimeout(500);
  verifica(await P.evaluate(() => window.__nat.filter(x => x.m === 'scriviInCartella').length) === n0, 'prima di una settimana non ne fa un\'altra');
  await P.evaluate(() => { const a = JSON.parse(localStorage.getItem('doctorcar_autocopia')); a.ultima = Date.now() - 8 * 86400000; localStorage.setItem('doctorcar_autocopia', JSON.stringify(a)); });
  await P.evaluate(() => window.__eseguiAutoCopia(false)); await P.waitForTimeout(1500);
  verifica(await P.evaluate(() => window.__nat.filter(x => x.m === 'scriviInCartella').length) === n0 + 1, 'dopo otto giorni la copia riparte da sola');
  await tocca(P, '#autoCopiaSpegni'); await P.waitForSelector('#finDomanda:not(.hidden)'); await tocca(P, '#domandaSi'); await P.waitForTimeout(500);
  verifica(await P.evaluate(() => window.__nat.some(x => x.m === 'dimenticaCartella')), 'spegnendola la cartella viene dimenticata');

  verifica(errori.length === 0, 'nessun errore in pagina' + (errori.length ? ': ' + errori.slice(0, 3).join(' | ') : ''));
  console.log('\n' + ok + ' riuscite, ' + ko + ' fallite');
  await b.close();
  process.exit(ko ? 1 : 0);
})();
