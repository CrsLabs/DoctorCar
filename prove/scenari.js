// Percorso da utente vero, solo con tocchi: primo avvio, auto, interventi, rifornimenti, km, scadenze, spese,
// copia di sicurezza cifrata andata e ritorno, Indietro, tema. Controlla errori in pagina e violazioni della CSP.
// Uso: node prove/scenari.js [http://127.0.0.1:8786/sorgente-DoctorCar.html]
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const URL = process.argv[2] || 'http://127.0.0.1:8786/sorgente-DoctorCar.html';
const D = path.join(__dirname, 'risultati'); fs.mkdirSync(D, { recursive: true });
let ok = 0, ko = 0;
const verifica = (cond, nome) => { if (cond) { ok++; console.log('  ✓ ' + nome); } else { ko++; console.log('  ✗ ' + nome); } };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], acceptDownloads: true, locale: 'it-IT' });
  const P = await ctx.newPage();
  const errori = [];
  P.on('pageerror', e => errori.push('errore: ' + e.message));
  P.on('console', m => { if (m.type() === 'error') errori.push('console: ' + m.text()); });
  await P.goto(URL);
  const tocca = async sel => { try { await P.locator(sel).first().click({ timeout: 5000 }); } catch (e) { await P.screenshot({ path: path.join(D, 'errore.png') }); console.log(await P.evaluate(() => [document.body.className, document.documentElement.className, scrollY, innerHeight, JSON.stringify(document.getElementById('barraNav').getBoundingClientRect())])); throw e; } await P.waitForTimeout(250); };
  const scrivi = async (k, v) => { await P.locator('#m_' + k).fill(String(v)); };
  const salva = async () => { await tocca('#moduloSalva'); await P.waitForTimeout(500); };

  console.log('Primo avvio');
  verifica(await P.locator('#homeBenvenuto').isVisible(), 'benvenuto visibile');
  await tocca('#homeBenvenuto >> text=Aggiungi la tua auto');
  await scrivi('nome', 'Panda'); await scrivi('marca', 'Fiat'); await scrivi('modello', 'Panda 1.2');
  await scrivi('targa', 'ab123cd'); await scrivi('immatricolazione', '2019-03-15'); await scrivi('kmIniziali', '20.000');
  await salva();
  verifica(!(await P.locator('#finModulo').isVisible()), 'veicolo salvato, modulo chiuso');
  verifica(await P.locator('#homeVeicoli').textContent().then(t => /Panda/.test(t) && /AB123CD/.test(t)), 'scheda del veicolo in Home');
  const sc = await P.evaluate(() => Object.values(DC.dati.scadenze).map(s => s.voce).sort().join(','));
  verifica(sc === 'assicurazione,bollo,distribuzione,liquido_freni,revisione,tagliando', 'piano di base creato (' + sc + ')');

  console.log('Intervento');
  await tocca('#barraNuovo >> text=Intervento');
  await scrivi('data', '2025-02-10'); await scrivi('km', '45000');
  await tocca('#finModulo [data-voce="tagliando"]'); await tocca('#finModulo [data-voce="olio"]');
  await scrivi('officina', 'Officina Rossi'); await scrivi('costo', '230,50');
  await salva();
  verifica(await P.locator('#homeUltimi').textContent().then(t => /Tagliando, Olio motore/.test(t) && /230,50/.test(t)), 'intervento nella Home');
  const st = await P.evaluate(() => { const s = Object.values(DC.dati.scadenze).find(s => s.voce === 'tagliando'); return DC.statoScadenza(s); });
  verifica(st.u && st.u.data === '2025-02-10' && st.kmScad === 60000, 'tagliando: ultima dal registro, prossimo a 60.000 km');

  console.log('Intervento senza voce (deve fermarsi)');
  await tocca('#barraNuovo >> text=Intervento');
  await salva();
  verifica(await P.locator('#finModulo').isVisible() && await P.locator('#avviso').textContent().then(t => /Cosa è stato fatto/.test(t)), 'manca la voce: avviso e modulo aperto');
  await tocca('#avviso button');   // il messaggio d'errore si chiude
  await tocca('#finModulo .foglio-testa button'); await P.waitForTimeout(600);
  verifica(!(await P.locator('#finModulo').isVisible()), 'chiuso senza domande (niente scritto)');

  console.log('Rifornimenti e consumi');
  const rif = [['2025-03-01', 46000, 35, 63], ['2025-03-20', 46600, 40, 72], ['2025-04-10', 47200, 38, 70]];
  for (const [d, k, q, c] of rif) {
    await tocca('#barraNuovo >> text=Pieno');
    await scrivi('data', d); await scrivi('km', k); await scrivi('quantita', q); await scrivi('costo', c);
    await salva();
  }
  await tocca('.nav[data-vista="rifornimenti"]');
  const cons = await P.locator('#consumi').textContent();
  verifica(/15,4/.test(cons), 'consumo medio 1200 km / 78 l = 15,4 km/l (' + cons.replace(/\s+/g, ' ').trim() + ')');

  console.log('Aggiorna km');
  await tocca('#vista-rifornimenti >> text=Aggiorna i km');   // in ogni sezione c'è il suo tasto per aggiungere da lì
  await scrivi('km', '52000'); await salva();
  verifica(await P.evaluate(() => DC.kmAttuali(Object.keys(DC.dati.veicoli)[0])) === 52000, 'km attuali 52.000');

  console.log('Scadenze');
  await tocca('.nav[data-vista="scadenze"]');
  verifica(await P.locator('#elencoScadenze .riga').count() === 6, 'sei scadenze in elenco');
  const revisione = await P.evaluate(() => { const s = Object.values(DC.dati.scadenze).find(s => s.voce === 'revisione'); return DC.statoScadenza(s).data; });
  // immatricolata il 15/03/2019: 4 anni (2023), poi ogni 2; la prossima è la prima non ancora passata
  const attesa = await P.evaluate(() => { let d = new Date(2023, 2, 31); const o = new Date(); o.setHours(0, 0, 0, 0); while (d < o) d = new Date(d.getFullYear() + 2, 2, 31); return d.getFullYear() + '-03-31'; });   // la revisione vale fino a fine mese
  verifica(revisione === attesa, 'revisione calcolata dall\'immatricolazione (4 anni, poi ogni 2, entro fine mese) e portata a oggi: ' + revisione + ' (atteso ' + attesa + ')');
  await P.locator('#elencoScadenze .riga', { hasText: 'Revisione' }).click(); await P.waitForTimeout(300);
  await tocca('#schedaCorpo >> text=Fatto: segna');
  verifica(await P.locator('#finModulo [data-voce="revisione"]').getAttribute('aria-pressed') === 'true', '«Fatto» apre l\'intervento con la voce scelta');
  await scrivi('data', '2025-03-10'); await scrivi('costo', '79'); await salva();
  const rev2 = await P.evaluate(() => { const s = Object.values(DC.dati.scadenze).find(s => s.voce === 'revisione'); return DC.statoScadenza(s).data; });
  verifica(rev2 === '2027-03-31', 'revisione successiva dopo 2 anni, entro fine mese (' + rev2 + ')');
  await tocca('text=Nuova scadenza');
  await tocca('#m_voce + .tendina-btn');   // il menù è nello stile dell'app (pannello dal basso), non quello di Android
  verifica(await P.locator('#finTendina').isVisible() && true, 'la scelta si apre nel pannello dell\'app');
  await tocca('#tendElenco .tend-voce:has-text("Cambio gomme stagionale")'); await P.waitForTimeout(150);
  verifica(await P.locator('#m_ogniMesi').inputValue() === '6', 'scelta la voce, intervallo proposto');
  await scrivi('ultimaData', '2025-04-15'); await salva();
  verifica(await P.locator('#elencoScadenze').textContent().then(t => /Cambio gomme/.test(t)), 'scadenza aggiunta');

  console.log('Spese');
  await tocca('.nav[data-vista="spese"]');
  await tocca('#anniSpese >> text=2025');
  const tab = await P.locator('#tabellaSpese').textContent();
  verifica(/Totale 2025/.test(tab) && /514,50/.test(tab), 'totale 2025: 230,50 + 205 + 79 = 514,50 €');

  console.log('Indietro');
  await P.goBack(); await P.waitForTimeout(400);
  verifica(await P.locator('#vista-home').isVisible(), 'Indietro dalla sezione torna in Home');
  await tocca('#barraNuovo >> text=Intervento');
  await P.goBack(); await P.waitForTimeout(600);
  verifica(!(await P.locator('#finModulo').isVisible()), 'Indietro chiude la finestra');

  console.log('Copia di sicurezza');
  await tocca('header >> [aria-label="Impostazioni"]');
  await tocca('[data-cat="dati"]');
  await tocca('#cat-dati >> text=Esporta copia');
  await P.locator('#dom_0').fill('corta'); await P.locator('#dom_1').fill('corta'); await tocca('#domandaSi');
  verifica(/almeno 12/.test(await P.locator('#domandaErrore').textContent()), 'password corta rifiutata');
  await P.locator('#dom_0').fill('una password lunga 1'); await P.locator('#dom_1').fill('una password lunga 1');
  const [dl] = await Promise.all([P.waitForEvent('download', { timeout: 20000 }), P.locator('#domandaSi').click()]);
  const file = path.join(D, 'copia.dccopia'); await dl.saveAs(file);
  const busta = JSON.parse(fs.readFileSync(file, 'utf8'));
  verifica(busta.app === 'DoctorCar' && !/Panda/.test(fs.readFileSync(file, 'utf8')), 'copia cifrata (nessun dato in chiaro)');
  await P.waitForTimeout(500);
  // si cancella un intervento, poi si importa la copia con «Unisci»: torna? no (la cancellazione è più recente). Con «Sostituisci» sì.
  await P.evaluate(() => { localStorage.removeItem('doctorcar_dati'); DC.carica(); DC.disegna(); });
  await P.locator('#fileCopia').setInputFiles(file); await P.waitForTimeout(400);
  await P.locator('#dom_0').fill('sbagliata'); await tocca('#domandaSi'); await P.waitForTimeout(2500);
  verifica(/Password sbagliata/.test(await P.locator('#domandaErrore').textContent()), 'password sbagliata: si riprova');
  await P.locator('#dom_0').fill('una password lunga 1'); await tocca('#domandaSi'); await P.waitForTimeout(2500);
  await tocca('#domandaSi');   // Unisci
  verifica(await P.evaluate(() => Object.values(DC.dati.interventi).length) === 2 && await P.evaluate(() => Object.values(DC.dati.veicoli).length) === 1, 'copia importata: veicolo e interventi tornati');

  console.log('Tema');
  await P.evaluate(() => { document.querySelectorAll('.finestra').forEach(f => f.classList.add('hidden')); });
  await tocca('header >> [aria-label="Impostazioni"]');
  await tocca('[data-cat="aspetto"]');
  await tocca('.opz[data-tema="chiaro"]');
  verifica(await P.evaluate(() => document.documentElement.getAttribute('data-tema')) === 'chiaro', 'tema chiaro');
  await P.screenshot({ path: path.join(D, 'impostazioni-chiaro.png') });
  await tocca('.opz[data-tema="scuro"]');
  await P.goBack(); await P.waitForTimeout(600);
  await P.screenshot({ path: path.join(D, 'home.png'), fullPage: true });
  fs.writeFileSync(path.join(D, 'dati-esempio.json'), JSON.stringify(await P.evaluate(() => DC.dati)));

  console.log('Dati avvelenati');
  await P.evaluate(() => { DC.unisci({ veicoli: [{ id: 'aaaa1111', mod: Date.now() + 9e5, dev: 'ffffffffffff', nome: '<img src=x onerror=alert(1)>', alimentazione: 'x' }], interventi: [{ id: 'bbbb', mod: 1, voci: ['<b>'], descrizione: '"><svg onload=alert(2)>', veicolo: 'aaaa1111', data: '2025-01-01' }], scadenze: [{ id: '../x', mod: 1 }] }); DC.disegna(); });
  await tocca('.nav[data-vista="veicoli"]'); await tocca('.nav[data-vista="interventi"]');
  verifica(await P.evaluate(() => !document.querySelector('img[src="x"], svg[onload]')), 'nessun HTML iniettato');
  verifica(errori.length === 0, 'nessun errore in pagina' + (errori.length ? ': ' + errori.join(' | ') : ''));
  console.log(`\n${ok} riuscite, ${ko} fallite`);
  await b.close();
  process.exit(ko ? 1 : 0);
})();
