// Calcoli e correzioni di difetti trovati: scadenze rinnovate in anticipo o in ritardo, km di un'auto nuova,
// «Indietro» a raffica (non deve far uscire dalla pagina), consumi e spese.
// Uso: node prove/logica.js [http://127.0.0.1:8786/sorgente-DoctorCar.html]
const { chromium, devices } = require('playwright');
const URL = process.argv[2] || 'http://127.0.0.1:8786/sorgente-DoctorCar.html';
let ok = 0, ko = 0;
const verifica = (cond, nome) => { if (cond) { ok++; console.log('  ✓ ' + nome); } else { ko++; console.log('  ✗ ' + nome); } };
const giorno = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const mesiDopo = (data, n) => { const d = new Date(data + 'T12:00:00'); d.setMonth(d.getMonth() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
(async () => {
  const b = await chromium.launch();
  const P = await (await b.newContext({ ...devices['Pixel 7'], locale: 'it-IT' })).newPage();
  const errori = []; P.on('pageerror', e => errori.push(e.message));
  await P.goto(URL);
  const stato = (scad, interventi) => P.evaluate(([scad, interventi]) => {
    const m = Date.now(), dev = 'aaaaaaaaaaaa';
    DC.dati.veicoli = {}; DC.dati.interventi = {}; DC.dati.scadenze = {}; DC.dati.letture = {}; DC.dati.rifornimenti = {};
    DC.unisci({ veicoli: [{ id: 'auto0001', mod: m, dev, nome: 'Panda', alimentazione: 'benzina' }],
      scadenze: [Object.assign({ id: 'scad0001', mod: m, dev, veicolo: 'auto0001' }, scad)],
      interventi: interventi.map((i, k) => Object.assign({ id: 'int0000' + k, mod: m, dev, veicolo: 'auto0001' }, i)) });
    const st = DC.statoScadenza(DC.dati.scadenze.scad0001);
    return { data: st.data, livello: st.livello, giorni: st.giorni };
  }, [scad, interventi]);

  console.log('Scadenze con la data scritta a mano');
  let r = await stato({ voce: 'bollo', nome: 'Bollo', ogniMesi: 12, prossimaData: giorno(10) }, []);
  verifica(r.data === giorno(10) && r.livello === 'vicina', 'senza interventi vale la data scritta (fra 10 giorni: in arrivo)');
  r = await stato({ voce: 'bollo', nome: 'Bollo', ogniMesi: 12, prossimaData: giorno(10) }, [{ data: giorno(0), voci: ['bollo'] }]);
  verifica(r.data === mesiDopo(giorno(10), 12) && r.livello === 'ok', 'bollo pagato 10 giorni prima: la prossima è un anno dopo la scadenza scritta (' + r.data + ')');
  r = await stato({ voce: 'assicurazione', nome: 'Assicurazione', ogniMesi: 12, prossimaData: giorno(-20) }, [{ data: giorno(0), voci: ['assicurazione'] }]);
  verifica(r.data === mesiDopo(giorno(0), 12) && r.livello === 'ok', 'assicurazione rinnovata in ritardo: un anno da quando è stata rinnovata (' + r.data + ')');
  r = await stato({ voce: 'assicurazione', nome: 'Assicurazione', ogniMesi: 12, prossimaData: giorno(-20) }, []);
  verifica(r.livello === 'scaduta', 'scaduta e non rinnovata: resta scaduta');
  r = await stato({ voce: 'bollo', nome: 'Bollo', ogniMesi: 12, prossimaData: giorno(200) }, [{ data: giorno(-100), voci: ['bollo'] }]);
  verifica(r.data === giorno(200), 'un intervento vecchio di mesi non rinnova una scadenza lontana');
  r = await stato({ voce: 'bollo', nome: 'Bollo', prossimaData: giorno(10) }, [{ data: giorno(0), voci: ['bollo'] }]);
  verifica(r.livello === 'manca', 'rinnovata ma senza periodo: va completata');

  console.log('Km di un\'auto nuova');
  await P.evaluate(() => { localStorage.clear(); DC.carica(); DC.disegna(); });
  await P.reload(); await P.waitForTimeout(300);
  await P.locator('#homeBenvenuto >> text=Aggiungi la tua auto').click(); await P.waitForTimeout(300);
  await P.locator('#m_nome').fill('Golf'); await P.locator('#m_immatricolazione').fill('2019-03-15'); await P.locator('#m_kmIniziali').fill('120.000');
  await P.locator('#moduloSalva').click(); await P.waitForTimeout(600);
  const v = await P.evaluate(() => { const veic = Object.values(DC.dati.veicoli)[0]; return { km: DC.kmAttuali(veic.id), iniz: veic.kmIniziali, letture: Object.values(DC.dati.letture).map(l => [l.km, l.data]), tag: DC.statoScadenza(Object.values(DC.dati.scadenze).find(s => s.voce === 'distribuzione')) }; });
  verifica(v.km === 120000 && v.iniz === null, 'i km scritti per un\'auto nuova sono quelli di adesso (120.000)');
  verifica(v.letture.length === 1 && v.letture[0][1] === giorno(0), 'diventano una lettura di oggi, non dell\'immatricolazione');
  verifica(v.tag.livello === 'manca', 'la distribuzione non parte dai km di adesso: va completata');
  await P.locator('#vista-home .auto-testa').first().click(); await P.waitForTimeout(300);
  await P.locator('#schedaCorpo >> text=Modifica il veicolo').click(); await P.waitForTimeout(300);
  verifica(await P.locator('#m_kmIniziali').count() === 0, 'modificando l\'auto non c\'è più il campo dei km (si usa «Km»)');
  await P.keyboard.press('Escape'); await P.waitForTimeout(500);

  console.log('«Indietro» a raffica');
  await P.evaluate(() => { document.querySelectorAll('.finestra').forEach(f => f.classList.add('hidden')); });
  await P.reload(); await P.waitForTimeout(300);
  const url0 = P.url();
  for (let k = 0; k < 5; k++) {
    await P.evaluate(() => { DC.COMANDI.apriImpostazioni(); DC.COMANDI.chiudiFinestra('finImpostazioni'); DC.COMANDI.vai('interventi'); DC.COMANDI.vai('home'); });
    await P.waitForTimeout(120);
  }
  await P.waitForTimeout(800);
  verifica(P.url() === url0 && await P.evaluate(() => typeof DC !== 'undefined'), 'dopo 5 aperture e chiusure ravvicinate la pagina è ancora lì');
  verifica(await P.evaluate(() => history.length) <= 3, 'la cronologia non cresce (voci: ' + await P.evaluate(() => history.length) + ')');
  await P.evaluate(() => { DC.COMANDI.apriImpostazioni(); }); await P.waitForTimeout(300);
  await P.goBack(); await P.waitForTimeout(700);
  verifica(!(await P.locator('#finImpostazioni').isVisible()) && P.url() === url0, 'Indietro chiude la finestra e resta nella pagina');
  verifica(errori.length === 0, 'nessun errore in pagina' + (errori.length ? ': ' + errori.join(' | ') : ''));
  console.log(`\n${ok} riuscite, ${ko} fallite`);
  await b.close(); process.exit(ko ? 1 : 0);
})();
