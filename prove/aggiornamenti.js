// Aggiornamenti da GitHub (parte della pagina, con il ponte nativo simulato): controllo settimanale con interruttore,
// «Controlla adesso», domanda «È uscita…», download con avanzamento, permesso negato, errori, nessun controllo da spento.
// La parte nativa (rete, impronta SHA-256, firma, installazione) si prova sul telefono.
// Uso: node prove/aggiornamenti.js   (server 8785 sulla cartella www)
const { chromium, devices } = require('playwright');
const APP = 'http://127.0.0.1:8785/index.html';
let ok = 0, ko = 0;
const verifica = (cond, nome, extra) => { if (cond) { ok++; console.log('  ✓ ' + nome); } else { ko++; console.log('  ✗ ' + nome + (extra ? ' — ' + extra : '')); } };
const MOCK = `(() => {
  window.__nat = []; window.__asc = {};
  window.__agg = { nuova: true, versione: '2.4.0', novita: 'Magazzino più veloce.', dimensione: 12582912, errore: '', permesso: true };
  window.Capacitor = { isNativePlatform: () => true,
    addListener: (pl, ev, f) => { window.__asc[pl + ':' + ev] = f; return { remove() {} }; },
    nativePromise: (pl, m, o) => {
      window.__nat.push(m);
      if (pl === 'PairWood') return Promise.resolve({});
      if (m === 'statoNotifiche') return Promise.resolve({ concesso: true });
      if (m === 'puoSbloccare') return Promise.resolve({ ok: false });
      if (m === 'azioniInCoda') return Promise.resolve({ azioni: [] });
      if (m === 'controllaAggiornamento') {
        const a = window.__agg;
        if (a.errore) return Promise.reject(new Error(a.errore));
        return new Promise(r => setTimeout(() => r(a.nuova ? { installata: 20, nuova: true, versione: a.versione, novita: a.novita, dimensione: a.dimensione } : { installata: 20, nuova: false }), 150));
      }
      if (m === 'scaricaAggiornamento') {
        const f = window.__asc['DoctorCar:aggiornamento'];
        return new Promise(r => { [10, 50, 100].forEach((p, i) => setTimeout(() => f && f({ percento: p }), 100 * (i + 1))); setTimeout(() => r(window.__agg.permesso ? { permesso: true, avviata: true } : { permesso: false }), 450); });
      }
      return Promise.resolve({});
    } };
})();`;

(async () => {
  const b = await chromium.launch();
  const errori = [];
  const apri = async (memoria) => {
    const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'it-IT' });
    await ctx.addInitScript(MOCK);
    await ctx.addInitScript(m => { if (!sessionStorage.getItem('__f')) { sessionStorage.setItem('__f', '1'); localStorage.clear(); for (const k in m) localStorage.setItem(k, m[k]); } }, memoria || {});
    const P = await ctx.newPage(); P.setDefaultTimeout(8000);
    P.on('pageerror', e => errori.push('errore: ' + e.message));
    P.on('console', m => { if (m.type() === 'error') errori.push('console: ' + m.text()); });
    await P.goto(APP); await P.waitForTimeout(900);
    return P;
  };
  const conta = P => P.evaluate(() => window.__nat.filter(m => m === 'controllaAggiornamento').length);
  const chiudiTutto = P => P.evaluate(() => document.querySelectorAll('.finestra:not(.hidden)').forEach(f => f.classList.add('hidden')));

  console.log('▶ Controllo settimanale');
  let P = await apri();
  await chiudiTutto(P); await P.waitForTimeout(9500);
  verifica(await conta(P) === 1, 'alla prima apertura controlla una volta');
  let dom = await P.evaluate(() => ({ aperta: !document.getElementById('finDomanda').classList.contains('hidden'), t: document.getElementById('domandaTitolo').textContent, x: document.getElementById('domandaTesto').textContent }));
  verifica(dom.aperta && dom.t === 'È uscita DoctorCar 2.4.0' && /Magazzino più veloce/.test(dom.x), 'chiede «È uscita DoctorCar 2.4.0» con le novità', JSON.stringify(dom));
  await P.click('#domandaNo'); await P.waitForTimeout(400);
  const o = await P.evaluate(() => window.__aggiornamenti.optAgg());
  verifica(o.ultimo > Date.now() - 60000 && o.rimandata === '2.4.0', 'ricorda quando ha controllato e che hai detto «Più tardi»');
  await P.evaluate(() => { window.__aggiornamenti.controlloSettimanale(0); }); await P.waitForTimeout(400);
  verifica(await conta(P) === 1, 'entro la settimana non ricontrolla');
  await P.evaluate(() => { const o = JSON.parse(localStorage.getItem('doctorcar_aggiornamenti')); o.ultimo = Date.now() - 8 * 864e5; localStorage.setItem('doctorcar_aggiornamenti', JSON.stringify(o)); });
  await P.evaluate(() => { window.__aggiornamenti.controlloSettimanale(0); }); await P.waitForTimeout(600);
  verifica(await conta(P) === 2, 'dopo una settimana ricontrolla');
  await P.click('#domandaSi'); await P.waitForTimeout(1200);
  verifica(await P.evaluate(() => window.__nat.includes('scaricaAggiornamento')), '«Aggiorna» scarica e apre l\'installazione');
  verifica(await P.evaluate(() => document.getElementById('finAttesa').classList.contains('hidden')), 'la finestra di attesa si chiude alla fine');

  console.log('▶ Impostazioni → Aggiornamenti');
  await P.evaluate(() => { DC.COMANDI.apriImpostazioni(); }); await P.waitForTimeout(500);
  await P.evaluate(() => DC.COMANDI.alternaCat('aggiornamenti')); await P.waitForTimeout(300);
  let st = await P.evaluate(() => ({ vis: getComputedStyle(document.getElementById('cat-aggiornamenti').parentElement.parentElement).display !== 'none', sw: document.getElementById('impAggiornamenti').getAttribute('aria-checked'), t: document.getElementById('aggStato').textContent, ins: !document.getElementById('aggInstalla').classList.contains('hidden') }));
  verifica(st.vis && st.sw === 'true', 'la sezione c\'è nell\'app e l\'interruttore è acceso', JSON.stringify(st));
  verifica(/È uscita DoctorCar 2\.4\.0 \(12,0 MB\)/.test(st.t) && st.ins, 'dice che c\'è la 2.4.0 (12,0 MB) e mostra «Aggiorna»', st.t);
  await P.evaluate(() => { window.__agg.permesso = false; }); await P.click('#aggInstalla'); await P.waitForTimeout(1000);
  verifica(/permesso di installare/.test(await P.evaluate(() => document.body.innerText)), 'senza permesso di installare lo spiega');
  await P.evaluate(() => { window.__agg.nuova = false; }); await P.click('#aggControlla'); await P.waitForTimeout(600);
  st = await P.evaluate(() => ({ t: document.getElementById('aggStato').textContent, ins: !document.getElementById('aggInstalla').classList.contains('hidden') }));
  verifica(/Hai l'ultima versione\. Ultimo controllo: oggi/.test(st.t) && !st.ins, '«Controlla adesso» senza novità: «Hai l\'ultima versione», niente «Aggiorna»', st.t);
  await P.evaluate(() => { window.__agg.errore = 'Non riesco a controllare: sei collegato a internet?'; }); await P.click('#aggControlla'); await P.waitForTimeout(600);
  st = await P.evaluate(() => document.getElementById('aggStato').textContent);
  verifica(/sei collegato a internet/.test(st), 'senza internet lo dice', st);
  await P.click('#impAggiornamenti'); await P.waitForTimeout(200);
  verifica(await P.evaluate(() => document.getElementById('impAggiornamenti').getAttribute('aria-checked') === 'false' && window.__aggiornamenti.optAgg().attivo === false), 'l\'interruttore si spegne e resta spento');
  const prima = await conta(P);
  await P.evaluate(() => { const o = JSON.parse(localStorage.getItem('doctorcar_aggiornamenti')); o.ultimo = Date.now() - 30 * 864e5; localStorage.setItem('doctorcar_aggiornamenti', JSON.stringify(o)); });
  await P.evaluate(() => { window.__aggiornamenti.controlloSettimanale(0); }); await P.waitForTimeout(500);
  verifica(await conta(P) === prima, 'da spento non controlla da solo');

  console.log('▶ Spento dall\'inizio');
  const P2 = await apri({ doctorcar_aggiornamenti: JSON.stringify({ attivo: false }) });
  await chiudiTutto(P2); await P2.waitForTimeout(9500);
  verifica(await conta(P2) === 0, 'con l\'interruttore spento non parte nessuna richiesta');

  console.log('▶ Dati strani dal nativo');
  const P3 = await apri();
  await P3.evaluate(() => { window.__agg.versione = '<img src=x onerror=window.__x=1>'; window.__agg.novita = '<b>ciao</b>'; });
  await chiudiTutto(P3); await P3.waitForTimeout(9500);
  verifica(await P3.evaluate(() => !window.__x && !document.querySelector('#finDomanda img, #finDomanda b')), 'versione e novità con codice: mostrati come testo, non eseguiti');

  const er = errori.filter(e => !/favicon/.test(e));
  verifica(!er.length, 'nessun errore in pagina', er.join(' | '));
  console.log('\nAggiornamenti: ' + ok + ' riusciti, ' + ko + ' falliti');
  await b.close();
  process.exit(ko ? 1 : 0);
})();
