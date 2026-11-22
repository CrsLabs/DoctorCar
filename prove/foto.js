// Foto delle fatture negli interventi: aggiungere (ridotte e con miniatura), vedere, zoom, togliere, buttare via,
// limiti e file sbagliati, copia di sicurezza con le foto (anche copie vecchie senza foto), dati avvelenati.
// Uso: node prove/foto.js [http://127.0.0.1:8786/sorgente-DoctorCar.html]
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
  const tocca = async sel => { await P.locator(sel).first().click({ timeout: 8000 }); await P.waitForTimeout(250); };
  const foto = async (w, h, colore) => Buffer.from(await P.evaluate(([w, h, c]) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
    g.fillStyle = c; g.fillRect(0, 0, w, h); g.fillStyle = '#000'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 60, 60);
    return cv.toDataURL('image/jpeg', .92).split(',')[1];
  }, [w, h, colore]), 'base64');
  const ids = () => P.evaluate(() => DC.Foto.ids());
  const apriIntervento = async () => {
    // dalla Home c'è la barra «nuovo»; nelle altre sezioni il tasto della sezione
    if (await P.locator('#barraNuovo').isVisible()) await tocca('#barraNuovo >> text=Intervento');
    else { await P.evaluate(() => DC.COMANDI.vai('interventi')); await P.waitForTimeout(200); await tocca('#vista-interventi >> text=Nuovo intervento'); }
    await P.waitForTimeout(300);
  };
  const aggiungi = async (buf, nome = 'fattura.jpg', tipo = 'image/jpeg') => { await P.locator('#fileFotoScegli').setInputFiles({ name: nome, mimeType: tipo, buffer: buf }); await P.waitForTimeout(900); };

  await P.evaluate(() => { DC.unisci({ veicoli: [{ id: 'auto0001', mod: Date.now(), dev: 'aaaaaaaaaaaa', nome: 'Golf', alimentazione: 'diesel' }] }); DC.salvaDati(); DC.disegna(); });

  console.log('Aggiungere una foto');
  await apriIntervento();
  verifica(await P.locator('#m_foto_tasti button').count() === 2, 'nel modulo ci sono «Scatta foto» e «Scegli foto»');
  verifica(!(await P.locator('#m_foto_tasti button', { hasText: 'Scatta' }).isVisible()), 'sul PC «Scatta foto» non si vede');
  await tocca('#finModulo [data-voce="tagliando"]');
  await aggiungi(await foto(3000, 2000, '#c8d2e0'));
  verifica(await P.locator('#m_foto .foto-mini img').count() === 1, 'miniatura nel modulo');
  const id1 = (await ids())[0];
  const mis = await P.evaluate(async id => { const r = await DC.Foto.prendi(id); const bm = await createImageBitmap(r.blob); const mm = await createImageBitmap(r.miniatura); return { w: bm.width, h: bm.height, kb: Math.round(r.blob.size / 1024), mw: mm.width, tipo: r.blob.type }; }, id1);
  verifica(Math.max(mis.w, mis.h) === 1600 && mis.tipo === 'image/jpeg', 'foto ridotta a 1600 px, JPEG (' + mis.w + '×' + mis.h + ', ' + mis.kb + ' KB)');
  verifica(mis.mw === 240, 'miniatura di 240 px');
  await tocca('#moduloSalva'); await P.waitForTimeout(500);
  verifica(await P.evaluate(() => Object.values(DC.dati.interventi)[0].foto.length) === 1, 'l\'intervento ricorda la foto');
  await tocca('.nav[data-vista="interventi"]');
  verifica(/1 foto/.test(await P.locator('#elencoInterventi').textContent()), 'l\'elenco dice «1 foto»');

  console.log('Vedere la foto');
  await tocca('#elencoInterventi .riga');
  verifica(await P.locator('#m_foto .foto-mini img').count() === 1, 'riaprendo l\'intervento la foto c\'è');
  await tocca('#m_foto .foto-mini button[data-click^="apriFoto"]');
  await P.waitForTimeout(500);
  verifica(await P.locator('#finFoto').isVisible() && await P.evaluate(() => document.getElementById('fotoImg').naturalWidth) > 0, 'visore aperto con la foto');
  await tocca('#fotoBarra [aria-label="Ingrandisci"]');
  verifica(await P.evaluate(() => document.getElementById('fotoImg').style.width) === '150%', 'zoom 150%');
  await tocca('#fotoBarra [aria-label="Riduci"]');
  await P.goBack(); await P.waitForTimeout(700);
  verifica(!(await P.locator('#finFoto').isVisible()) && await P.locator('#finModulo').isVisible(), 'Indietro chiude il visore e lascia il modulo');

  console.log('Tre foto, tolgo la prima');
  await aggiungi(await foto(800, 600, '#e0c8c8'), 'a.jpg'); await aggiungi(await foto(600, 800, '#c8e0c8'), 'b.jpg');
  verifica(await P.locator('#m_foto .foto-mini img').count() === 3, 'tre miniature');
  await tocca('#m_foto .foto-mini:first-child .via');
  verifica(await P.locator('#m_foto .foto-mini img').count() === 2, 'tolta dal modulo');
  verifica((await ids()).length === 3, 'finché non si salva il file resta (si può ancora buttare via)');
  await tocca('#moduloSalva'); await P.waitForTimeout(700);
  verifica((await ids()).length === 2 && !(await ids()).includes(id1), 'salvando, la foto tolta sparisce davvero dal dispositivo');

  console.log('Buttare via');
  await apriIntervento();
  await aggiungi(await foto(800, 600, '#aaa'), 'c.jpg');
  verifica((await ids()).length === 3, 'foto aggiunta');
  await tocca('#finModulo .foglio-testa button');
  await tocca('#domandaAlt'); await P.waitForTimeout(700);
  verifica((await ids()).length === 2, '«Butta via»: la foto appena aggiunta non resta');

  console.log('File sbagliati e limite');
  await apriIntervento();
  await aggiungi(Buffer.from('non sono una foto'), 'finta.txt', 'text/plain');
  verifica(/non è una foto/.test(await P.locator('#avvisoTesto').textContent()) && await P.locator('#m_foto .foto-mini').count() === 0, 'un file di testo non entra');
  await aggiungi(Buffer.from('rotta'), 'rotta.jpg', 'image/jpeg');
  verifica(await P.locator('#m_foto .foto-mini').count() === 0, 'un\'immagine rotta non entra');
  for (let k = 0; k < 13; k++) await P.locator('#fileFotoScegli').setInputFiles({ name: 'x' + k + '.jpg', mimeType: 'image/jpeg', buffer: await foto(300, 200, '#' + (100000 + k * 3333).toString(16).slice(0, 6)) }).then(() => P.waitForTimeout(250));
  await P.waitForTimeout(800);
  verifica(await P.locator('#m_foto .foto-mini').count() === 12, 'al massimo 12 foto');
  verifica(await P.locator('#m_foto_tasti button').first().isDisabled() || await P.locator('#m_foto_tasti button').nth(1).isDisabled(), 'tasti spenti a 12 foto');
  await tocca('#finModulo .foglio-testa button'); await tocca('#domandaAlt'); await P.waitForTimeout(700);
  verifica((await ids()).length === 2, 'buttate via anche queste');

  console.log('Copia di sicurezza con le foto');
  const salvate = await P.evaluate(async () => { const r = {}; for (const id of await DC.Foto.ids()) { const x = await DC.Foto.prendi(id); r[id] = x.blob.size; } return r; });
  await tocca('header >> [aria-label="Impostazioni"]'); await tocca('[data-cat="dati"]'); await tocca('#cat-dati >> text=Esporta copia');
  await P.locator('#dom_0').fill('una password lunga 1'); await P.locator('#dom_1').fill('una password lunga 1');
  const [dl] = await Promise.all([P.waitForEvent('download', { timeout: 30000 }), P.locator('#domandaSi').click()]);
  const file = path.join(D, 'copia-foto.dccopia'); await dl.saveAs(file);
  const testoCopia = fs.readFileSync(file, 'utf8');
  verifica(!/\/9j\//.test(testoCopia) && !/Golf/.test(testoCopia), 'nella copia non c\'è niente in chiaro (nemmeno le foto)');
  verifica(JSON.parse(testoCopia).versione === 2, 'copia di formato 2');
  await P.waitForTimeout(500);
  await P.evaluate(async () => { localStorage.removeItem('doctorcar_dati'); await DC.Foto.cancellaTutto(); DC.carica(); DC.disegna(); });
  verifica((await ids()).length === 0, 'dispositivo svuotato');
  await P.locator('#fileCopia').setInputFiles(file); await P.waitForTimeout(400);
  await P.locator('#dom_0').fill('una password lunga 1'); await tocca('#domandaSi'); await P.waitForTimeout(2500);
  await tocca('#domandaSi'); await P.waitForTimeout(2500);   // Unisci
  const dopo = await P.evaluate(async () => { const r = {}; for (const id of await DC.Foto.ids()) { const x = await DC.Foto.prendi(id); r[id] = { kb: x.blob.size, min: !!x.miniatura }; } return r; });
  verifica(Object.keys(dopo).length === 2 && Object.keys(salvate).every(id => dopo[id] && dopo[id].kb === salvate[id] && dopo[id].min), 'le foto tornano identiche, con miniatura');
  verifica(await P.evaluate(() => Object.values(DC.dati.interventi).filter(i => !i.del && i.foto.length === 2).length) === 1, 'l\'intervento ritrova le sue foto');

  console.log('Copia vecchia (formato 1, senza foto)');
  const vecchia = await P.evaluate(async () => {
    const sale = DC.casuali(16), iv = DC.casuali(12), K = await DC.chiaveDaPassword('una password lunga 1', sale, 100000);
    const d = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: DC.testo.encode('doctorcar-copia-1') }, await DC.chiaveAes(K), DC.testo.encode(JSON.stringify({ veicoli: { vv000001: { id: 'vv000001', mod: Date.now() + 5, dev: 'bbbbbbbbbbbb', nome: 'Vecchia', alimentazione: 'benzina' } } })));
    return JSON.stringify({ app: 'DoctorCar', formato: 'copia', versione: 1, creata: '2025-01-01T00:00:00Z', iterazioni: 100000, sale: DC.b64(sale), iv: DC.b64(iv), dati: DC.b64(new Uint8Array(d)) });
  });
  const fv = path.join(D, 'copia-vecchia.dccopia'); fs.writeFileSync(fv, vecchia);
  await P.locator('#fileCopia').setInputFiles(fv); await P.waitForTimeout(400);
  await P.locator('#dom_0').fill('una password lunga 1'); await tocca('#domandaSi'); await P.waitForTimeout(1500);
  await tocca('#domandaSi'); await P.waitForTimeout(800);
  verifica(await P.evaluate(() => Object.values(DC.dati.veicoli).some(v => v.nome === 'Vecchia')), 'una copia vecchia si importa ancora');

  console.log('Eliminare un intervento toglie le sue foto');
  await P.evaluate(() => { document.querySelectorAll('.finestra').forEach(f => f.classList.add('hidden')); });
  await tocca('.nav[data-vista="interventi"]'); await tocca('#elencoInterventi .riga');
  await tocca('#moduloElimina'); await tocca('#domandaSi'); await P.waitForTimeout(800);
  verifica((await ids()).length === 0, 'foto tolte con l\'intervento');

  console.log('Dati avvelenati');
  const avv = await P.evaluate(async () => {
    DC.unisci({ interventi: [{ id: 'vel00001', mod: Date.now(), dev: 'cccccccccccc', veicolo: 'auto0001', data: '2025-01-01', voci: ['tagliando'], foto: ['../../x', '<img src=x onerror=alert(1)>', 'abcdef0123456789', 'abcdef0123456789', 7, null] }] });
    let rifiutata = 0;
    for (const dati of [new Uint8Array([1, 2, 3, 4, 5, 6]), new TextEncoder().encode('<html>non sono un jpeg</html>'), new Uint8Array(0)]) { try { await DC.fotoDaByte('abcdef0123456789', dati); } catch (_) { rifiutata++; } }
    try { await DC.fotoDaByte('../../etc/passwd', new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])); } catch (_) { rifiutata++; }
    return { foto: DC.dati.interventi.vel00001.foto, rifiutata };
  });
  verifica(JSON.stringify(avv.foto) === '["abcdef0123456789"]', 'dall\'esterno entrano solo identificativi validi e senza doppi');
  verifica(avv.rifiutata === 4, 'file che non sono JPEG e nomi strani rifiutati');
  verifica(errori.length === 0, 'nessun errore in pagina' + (errori.length ? ': ' + errori.join(' | ') : ''));
  console.log(`\n${ok} riuscite, ${ko} fallite`);
  await b.close();
  process.exit(ko ? 1 : 0);
})();
