// Sincronizzazione DIRETTA (PairWood) fra tre telefoni simulati, ognuno con la pagina dell'app Android (www/index.html)
// e il ponte di Capacitor simulato. PairWood è simulato qui in Node: una «rete» che copia i file fra le cartelle private
// dei dispositivi abbinati e manda gli eventi (ricevuti, abbinato, sincronizzato) come fa il modulo nativo.
// Il motore vero (TLS, abbinamento, blocchi) ha le sue prove nel progetto PairWood.
// Uso: node prove/diretta.js [http://127.0.0.1:8785/index.html]
const { chromium, devices } = require('playwright');
const URL = process.argv[2] || 'http://127.0.0.1:8785/index.html';
let ok = 0, ko = 0;
const verifica = (cond, nome) => { if (cond) { ok++; console.log('  ✓ ' + nome); } else { ko++; console.log('  ✗ ' + nome); } };

const MOCK = `(() => {
  window.__ascolto = [];
  window.Capacitor = {
    isNativePlatform: () => true,
    addListener: (pl, ev, cb) => { if (pl === 'PairWood' && ev === 'evento') __ascolto.push(cb); return { remove() {} }; },
    nativePromise: (pl, m, o) => {
      if (pl === 'PairWood') return window.__pw(m, o || {}).then(r => r && r.errore ? Promise.reject(new Error(r.errore)) : r.v);
      if (m === 'custodisci') return Promise.resolve({ iv: 'AAAA', dati: o.dati });
      if (m === 'riprendi') return Promise.resolve({ dati: o.dati });
      return Promise.resolve({});
    } };
  window.__evento = e => __ascolto.forEach(f => { try { f(e); } catch (_) {} });
})();`;

const disp = {};
const nuovo = nome => (disp[nome] = { nome, avviato: false, file: {}, fidati: new Set(), accetta: null, pagina: null, log: [] });
const evento = (d, e) => d.pagina && d.pagina.evaluate(e => window.__evento(e), e).catch(() => {});
function allinea(a, b) {
  const n = { [a.nome]: 0, [b.nome]: 0 };
  for (const p of new Set([...Object.keys(a.file), ...Object.keys(b.file)])) {
    const fa = a.file[p], fb = b.file[p];
    if (fa && (!fb || fa.modificato > fb.modificato)) { b.file[p] = { ...fa }; n[b.nome]++; }
    else if (fb && (!fa || fb.modificato > fa.modificato)) { a.file[p] = { ...fb }; n[a.nome]++; }
  }
  return n;
}
function giro(da) {
  let raggiunti = 0;
  for (const altro of Object.values(disp)) {
    if (altro === da || !da.fidati.has(altro.nome) || !altro.fidati.has(da.nome) || !altro.avviato) continue;
    raggiunti++;
    const n = allinea(da, altro);
    if (n[altro.nome]) evento(altro, { tipo: 'ricevuti', quanti: n[altro.nome] });
    if (n[da.nome]) evento(da, { tipo: 'ricevuti', quanti: n[da.nome] });
  }
  da.raggiunti = raggiunti;
  evento(da, { tipo: 'sincronizzato', raggiunti, abbinati: da.fidati.size, ricevuti: 0 });
}
let orologio = Date.now();
async function pairwood(d, m, o) {
  if (m !== 'avvia' && m !== 'cancellaTutto' && m !== 'qr' && m !== 'scansionaQr' && !d.avviato) return { errore: 'PairWood non è avviato' };
  switch (m) {
    case 'avvia': d.avviato = true; d.nomeVisto = o.nome; return { v: { avviato: true } };
    case 'stato': return { v: { avviato: true, dispositivi: [...d.fidati].map(n => ({ id: n, nome: disp[n].nomeVisto || n, ultimoContatto: Date.now() })) } };
    case 'accettaAbbinamento': d.accetta = o.codice; return { v: {} };
    case 'abbina': {
      const altro = Object.values(disp).find(x => x !== d && x.accetta === o.codice && x.avviato);
      if (!altro) return { errore: 'Nessun dispositivo con questo codice nella rete.' };
      // come PairWood: chi è già nel gruppo presenta il nuovo agli altri
      for (const x of [altro, ...[...altro.fidati].map(n => disp[n])]) { x.fidati.add(d.nome); d.fidati.add(x.nome); }
      altro.accetta = null;
      evento(altro, { tipo: 'abbinato', dispositivo: d.nomeVisto });
      return { v: { nome: altro.nomeVisto } };
    }
    case 'qr': return { v: { righe: Array.from({ length: 21 }, (_, i) => '1'.repeat(i % 2 ? 21 : 0).padEnd(21, '0')) } };
    case 'scansionaQr': return { v: { annullato: true } };
    case 'elenco': return { v: { file: Object.entries(d.file).filter(([p]) => p.startsWith(o.prefisso || '')).map(([p, f]) => ({ percorso: p, modificato: f.modificato, dimensione: f.testo.length })) } };
    case 'leggi': { const f = d.file[o.percorso]; return { v: f ? { esiste: true, testo: f.testo } : { esiste: false } }; }
    case 'scrivi': d.file[o.percorso] = { testo: o.testo, modificato: ++orologio }; setTimeout(() => giro(d), 50); return { v: {} };
    case 'sincronizza': giro(d); return { v: { ricevuti: 0 } };
    case 'diagnosi': return { v: { testo: 'raggiunti ' + (d.raggiunti || 0) + ' di ' + d.fidati.size } };
    case 'dimentica': d.fidati.delete(o.id); return { v: {} };
    case 'elimina': d.log.push('elimina:' + o.percorso); delete d.file[o.percorso]; return { v: { eliminato: true } };
    case 'cancellaTutto': d.avviato = false; d.fidati.clear(); d.file = {}; return { v: {} };
    default: return { v: {} };
  }
}

(async () => {
  const b = await chromium.launch();
  const apri = async nome => {
    const d = nuovo(nome);
    const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'it-IT' });
    await ctx.exposeFunction('__pw', (m, o) => pairwood(d, m, o));
    await ctx.addInitScript(MOCK);
    const P = await ctx.newPage();
    P.errori = [];
    P.on('pageerror', e => P.errori.push(e.message));
    P.on('console', m => { if (m.type() === 'error') P.errori.push(m.text()); });
    await P.goto(URL);
    d.pagina = P;
    return P;
  };
  const tocca = async (P, sel) => { await P.locator(sel).first().click(); await P.waitForTimeout(300); };
  const apriSinc = async P => { await tocca(P, 'header >> [aria-label="Impostazioni"]'); if (await P.locator('[data-cat="sinc"]').getAttribute('aria-expanded') !== 'true') await tocca(P, '[data-cat="sinc"]'); await P.waitForTimeout(300); };
  const chiudiTutto = async P => { for (let i = 0; i < 4; i++) { if (await P.evaluate(() => [...document.querySelectorAll('.finestra')].some(f => !f.classList.contains('hidden')))) { await P.keyboard.press('Escape'); await P.waitForTimeout(600); } } };

  const A = await apri('A'), B = await apri('B');
  console.log('Telefono A: un\'auto e un intervento');
  await A.evaluate(() => { DC.unisci({ veicoli: [{ id: 'auto0001', mod: Date.now(), dev: 'aaaaaaaaaaaa', nome: 'Golf', alimentazione: 'diesel' }], interventi: [{ id: 'int00001', mod: Date.now(), dev: 'aaaaaaaaaaaa', veicolo: 'auto0001', data: '2025-05-01', km: 80000, voci: ['tagliando'], costo: 300 }] }); DC.salvaDati(); DC.disegna(); });
  verifica(await A.locator('#statoSinc').isHidden(), 'senza sincronizzazione il chip non c\'è');

  console.log('A crea il codice');
  await apriSinc(A);
  await tocca(A, '#sincCorpo >> text=Collega un altro dispositivo');
  await A.locator('#dom_0').fill('Telefono di Anna'); await tocca(A, '#domandaSi');
  await A.waitForSelector('#domandaEvidenza:not(.hidden)', { timeout: 30000 });
  const codice = (await A.locator('#domandaEvidenza').textContent()).trim();
  verifica(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){4}$/.test(codice), 'codice mostrato: ' + codice);
  verifica(await A.locator('#domandaQr svg').count() === 1, 'QR mostrato');

  console.log('B si unisce con un codice sbagliato, poi con quello giusto');
  await apriSinc(B);
  await tocca(B, '#sincCorpo >> text=Ho già un codice');
  await B.locator('#dom_0').fill('Telefono di Bruno'); await tocca(B, '#domandaSi');
  await tocca(B, '#domandaAlt');   // Scrivi il codice
  await B.locator('#dom_0').fill('ABCD'); await tocca(B, '#domandaSi');
  verifica(/20 caratteri/.test(await B.locator('#domandaErrore').textContent()), 'codice corto rifiutato');
  await B.locator('#dom_0').fill(codice.replace(/-/g, '').toLowerCase()); await tocca(B, '#domandaSi');
  await B.waitForFunction(() => /Collegato/.test(document.getElementById('avvisoTesto').textContent), null, { timeout: 30000 });
  verifica(true, 'B collegato ad A');
  await A.waitForTimeout(800);
  verifica(await A.locator('#finDomanda').isHidden(), 'il codice su A si chiude da solo dopo l\'abbinamento');
  await B.waitForFunction(() => Object.keys(DC.dati.interventi).length === 1, null, { timeout: 15000 });
  verifica(true, 'l\'auto e l\'intervento di A sono arrivati su B');
  verifica(await B.locator('#homeVeicoli').textContent().then(t => /Golf/.test(t)), 'B mostra la Golf in Home');

  console.log('Modifiche nei due sensi');
  await chiudiTutto(B);
  await tocca(B, '#barraNuovo >> text=Pieno');
  await B.locator('#m_km').fill('80500'); await B.locator('#m_quantita').fill('40'); await B.locator('#m_costo').fill('70');
  await tocca(B, '#moduloSalva');
  await A.waitForFunction(() => Object.keys(DC.dati.rifornimenti).length === 1, null, { timeout: 15000 });
  verifica(true, 'rifornimento di B arrivato su A');
  await chiudiTutto(A);
  await A.evaluate(() => { const i = Object.values(DC.dati.interventi)[0]; DC.unisci({ interventi: [Object.assign({}, i, { costo: 320, mod: Date.now() + 5 })] }); DC.salvaDati(); });
  await B.waitForFunction(() => Object.values(DC.dati.interventi)[0].costo === 320, null, { timeout: 15000 });
  verifica(true, 'modifica del costo su A arrivata su B');
  // cancellazione
  await B.evaluate(() => { const r = Object.values(DC.dati.rifornimenti)[0]; DC.dati.rifornimenti[r.id] = { id: r.id, mod: Date.now() + 10, dev: DC.dispositivo(), del: true }; DC.salvaDati(); });
  await A.waitForFunction(() => Object.values(DC.dati.rifornimenti)[0].del === true, null, { timeout: 15000 });
  verifica(true, 'cancellazione su B arrivata su A');

  console.log('Foto della fattura');
  const FOTO = 'abcdef0123456789';
  const jpegA = await A.evaluate(async id => {
    const cv = document.createElement('canvas'); cv.width = 900; cv.height = 600; const g = cv.getContext('2d'); g.fillStyle = '#dde'; g.fillRect(0, 0, 900, 600); g.fillStyle = '#123'; g.fillRect(100, 100, 300, 200);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', .9)), bytes = new Uint8Array(await blob.arrayBuffer());
    await DC.fotoDaByte(id, bytes);
    const i = DC.dati.interventi.int00001;
    DC.unisci({ interventi: [Object.assign({}, i, { foto: [id], mod: Date.now() + 50 })] }); DC.salvaDati();
    return bytes.length;
  }, FOTO);
  await B.waitForFunction(id => DC.dati.interventi.int00001.foto.includes(id), FOTO, { timeout: 20000 });
  verifica(true, 'B riceve l\'intervento con l\'identificativo della foto');
  for (let k = 0; k < 60 && !(await B.evaluate(async id => (await DC.Foto.ids()).includes(id), FOTO)); k++) await B.waitForTimeout(500);
  const dimB = await B.evaluate(async id => (await DC.Foto.prendi(id)).blob.size, FOTO);
  verifica(dimB === jpegA, 'B riceve anche la foto, identica (' + jpegA + ' byte)');
  verifica(await B.evaluate(async id => !!(await DC.Foto.prendi(id)).miniatura, FOTO), 'con la miniatura');
  verifica(Object.keys(disp.A.file).some(n => n === 'doctorcar-foto-' + FOTO + '.dcfoto'), 'nella cartella la foto è un file a parte');
  const testoFoto = disp.A.file['doctorcar-foto-' + FOTO + '.dcfoto'].testo;
  verifica(!/\/9j\//.test(testoFoto) && JSON.parse(testoFoto).formato === 'foto', 'il file della foto è cifrato');
  await A.evaluate(id => { const i = DC.dati.interventi.int00001; DC.unisci({ interventi: [Object.assign({}, i, { foto: [], mod: Date.now() + 90 })] }); DC.salvaDati(); DC.togliFoto([id]); }, FOTO);
  await A.waitForTimeout(1500);
  verifica(disp.A.log.includes('elimina:doctorcar-foto-' + FOTO + '.dcfoto'), 'tolta la foto, A cancella anche il file condiviso');
  verifica(await A.evaluate(async id => !(await DC.Foto.ids()).includes(id), FOTO), 'e la sua copia locale');

  console.log('File nella cartella: cifrati');
  const testi = [...Object.values(disp.A.file), ...Object.values(disp.B.file)].map(f => f.testo).join('');
  verifica(testi.length > 0 && !/Golf|tagliando/.test(testi), 'nessun dato in chiaro nei file di sincronizzazione');

  console.log('Terzo telefono (C) dal codice mostrato da B');
  const C = await apri('C');
  await apriSinc(B);
  await tocca(B, '#sincCorpo >> text=Aggiungi');
  await B.waitForSelector('#domandaEvidenza:not(.hidden)');
  const codiceB = (await B.locator('#domandaEvidenza').textContent()).trim();
  verifica(codiceB === codice, 'B mostra lo stesso codice del gruppo');
  await apriSinc(C);
  await tocca(C, '#sincCorpo >> text=Ho già un codice');
  await C.locator('#dom_0').fill('Tablet'); await tocca(C, '#domandaSi');
  await tocca(C, '#domandaAlt');
  await C.locator('#dom_0').fill(codice); await tocca(C, '#domandaSi');
  await C.waitForFunction(() => Object.keys(DC.dati.interventi).length === 1 && Object.keys(DC.dati.rifornimenti).length === 1, null, { timeout: 20000 });
  verifica(true, 'C ha ricevuto tutto, anche la cancellazione');
  await chiudiTutto(C);
  await C.evaluate(() => { DC.unisci({ letture: [{ id: 'let00001', mod: Date.now() + 20, dev: DC.dispositivo(), veicolo: 'auto0001', data: '2026-11-18', km: 91000 }] }); DC.salvaDati(); });
  await A.waitForFunction(() => DC.kmAttuali('auto0001') === 91000, null, { timeout: 20000 });
  verifica(true, 'km di C arrivati su A (C presentato ad A tramite B)');

  console.log('Elenco dispositivi, Dimentica, Scollega');
  await chiudiTutto(A); await apriSinc(A);
  const elenco = await A.locator('#sincCorpo').textContent();
  verifica(/Telefono di Bruno/.test(elenco) && /Tablet/.test(elenco), 'A vede B e C fra gli abbinati');
  await tocca(A, '#sincCorpo [data-click^="sincDimentica"]');
  await tocca(A, '#domandaSi'); await A.waitForTimeout(500);
  verifica(disp.A.fidati.size === 1, 'un dispositivo dimenticato');
  await chiudiTutto(C); await apriSinc(C);
  await tocca(C, '#sincCorpo >> text=Scollega'); await tocca(C, '#domandaSi'); await C.waitForTimeout(500);
  verifica(await C.evaluate(() => !localStorage.getItem('doctorcar_sinc')) && Object.keys(disp.C.file).length === 0, 'C scollegato: niente codice né file di sincronizzazione');
  verifica(await C.evaluate(() => Object.keys(DC.dati.interventi).length) === 1, 'dopo «Scollega» i dati di C restano');

  for (const [n, P] of [['A', A], ['B', B], ['C', C]]) verifica(P.errori.length === 0, 'nessun errore in pagina su ' + n + (P.errori.length ? ': ' + P.errori.join(' | ') : ''));
  console.log(`\n${ok} riuscite, ${ko} fallite`);
  await b.close();
  process.exit(ko ? 1 : 0);
})();
