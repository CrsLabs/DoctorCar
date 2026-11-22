// Il robot: in ogni sezione preme TUTTI i tasti visibili (anche dentro le finestre che si aprono), rispondendo «No» alle domande
// distruttive, e segnala errori in pagina, finestre rimaste bloccate, tasti senza effetto e pagine che sbordano.
// Si fa sia nella pagina web (8786) sia nella pagina dell'app con un Android simulato (8785).
// Uso: node prove/robot.js
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const MOCK = fs.readFileSync(path.join(__dirname, 'promemoria.js'), 'utf8').match(/const MOCK = `([\s\S]*?)`;/)[1];
let totale = 0, problemi = [];
const segnala = (m) => { problemi.push(m); console.log('  ✗ ' + m); };

async function giro(nome, url, android) {
  console.log(nome);
  const b = await chromium.launch();
  // INGLESE=file.json: l'app in inglese; alla fine si scrivono nel file i testi rimasti senza traduzione
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: process.env.INGLESE ? 'en-GB' : 'it-IT', acceptDownloads: true });
  if (android) await ctx.addInitScript(MOCK);
  if (process.env.INGLESE) await ctx.addInitScript(() => { window.__nonTradotti = new Set(); try { if (!localStorage.getItem('doctorcar_lingua')) localStorage.setItem('doctorcar_lingua', '"en"'); } catch (_) { } });
  const P = await ctx.newPage();
  const errori = [];
  P.on('pageerror', e => errori.push('errore: ' + e.message));
  P.on('console', m => { if (m.type() === 'error') errori.push('console: ' + m.text()); });
  P.on('filechooser', () => {}); P.on('download', () => {}); P.on('dialog', d => d.dismiss());
  await P.goto(url);
  P.on('framenavigated', f => { if (f === P.mainFrame() && process.env.DEBUG) console.log('   !!! navigazione verso', f.url()); });
  P.on('crash', () => console.log('   !!! pagina crashata'));
  const m = Date.now(), dev = 'aaaaaaaaaaaa';
  await P.evaluate(([m, dev]) => {
    const oggi = new Date(), g = n => { const d = new Date(oggi); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    DC.unisci({
      veicoli: [{ id: 'auto0001', mod: m, dev, nome: 'Panda', marca: 'Fiat', modello: '1.2', targa: 'AB123CD', alimentazione: 'benzina', immatricolazione: '2019-03-15' },
                { id: 'auto0002', mod: m, dev, nome: 'Zoe', alimentazione: 'elettrica' }],
      interventi: [{ id: 'int00001', mod: m, dev, veicolo: 'auto0001', data: g(-200), km: 60000, voci: ['tagliando', 'olio'], costo: 210, officina: 'Rossi', foto: [] },
                   { id: 'int00002', mod: m, dev, veicolo: 'auto0002', data: g(-30), km: 12000, voci: ['pneumatici'], costo: 400 }],
      rifornimenti: [{ id: 'rif00001', mod: m, dev, veicolo: 'auto0001', data: g(-90), km: 58000, quantita: 35, costo: 60, pieno: true },
                     { id: 'rif00002', mod: m, dev, veicolo: 'auto0001', data: g(-30), km: 58500, quantita: 33, costo: 58, pieno: true }],
      scadenze: [{ id: 'scad0001', mod: m, dev, veicolo: 'auto0001', voce: 'tagliando', nome: 'Tagliando', ogniKm: 15000, ogniMesi: 12 },
                 { id: 'scad0002', mod: m, dev, veicolo: 'auto0001', voce: 'bollo', nome: 'Bollo', ogniMesi: 12, prossimaData: g(10) },
                 { id: 'scad0003', mod: m, dev, veicolo: 'auto0001', voce: 'revisione', nome: 'Revisione', ogniMesi: 24, prossimaData: g(-5) },
                 { id: 'scad0004', mod: m, dev, veicolo: 'auto0002', voce: 'batteria', nome: 'Batteria', ogniMesi: 60 }],
      letture: [{ id: 'let00001', mod: m, dev, veicolo: 'auto0001', data: g(-5), km: 59000 }] });
    DC.salvaDati(); DC.disegna();
  }, [m, dev]);
  await P.waitForTimeout(320);

  const rispondiDomanda = async () => {
    // «Butta via» se c'è, altrimenti Indietro (che per le domande vuol dire «no»)
    if (await P.locator('#domandaAlt:visible').count()) await P.locator('#domandaAlt').click({ timeout: 2000 }).catch(() => {});
    else await P.keyboard.press('Escape');
    await P.waitForTimeout(450);
  };
  const chiudiTutto = async () => {
    for (let k = 0; k < 8; k++) {
      if (await P.locator('#finDomanda:not(.hidden)').count()) { await rispondiDomanda(); continue; }
      const aperta = await P.evaluate(() => [...document.querySelectorAll('.finestra')].some(f => !f.classList.contains('hidden')));
      if (!aperta) break;
      await P.keyboard.press('Escape'); await P.waitForTimeout(450);
    }
    return !(await P.evaluate(() => [...document.querySelectorAll('.finestra')].some(f => !f.classList.contains('hidden'))));
  };
  const VISTE = ['home', 'interventi', 'scadenze', 'rifornimenti', 'spese', 'veicoli'];
  for (const v of VISTE) {
    // livello 0: i tasti della sezione; livello 1: quelli dentro la finestra che si apre
    const preparati = async () => { await chiudiTutto(); await P.evaluate(v => DC.COMANDI.vai(v), v); await P.waitForTimeout(220); };
    await preparati();
    const quanti = await P.locator('main button:visible, header button:visible, #barraNav button:visible').count();
    for (let i = 0; i < quanti; i++) {
      await preparati();
      const tasti = P.locator('main button:visible, header button:visible, #barraNav button:visible');
      if (i >= await tasti.count()) break;
      const t = tasti.nth(i), etichetta = ((await t.textContent().catch(() => '')) || (await t.getAttribute('aria-label')) || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      if (process.env.DEBUG) console.log('   click', v, i, etichetta);
      const prima = errori.length;
      await t.evaluate(el => el.scrollIntoView({ block: 'center' })).catch(() => {});   // come farebbe una persona: lo porta a metà schermo, non sotto le barre fisse
      // coperto per un attimo da qualcosa di fisso (barra in basso, avviso in alto): una persona scorrerebbe o aspetterebbe;
      // il robot lo preme direttamente, così controlla comunque che il tasto funzioni
      try { await t.click({ timeout: 3000 }).catch(async e => { if (!/intercepts pointer events|Timeout/.test(e.message)) throw e; if (!(await t.isVisible())) throw e; await t.evaluate(el => el.click()); }); } catch (e) { segnala(`${nome} · ${v}: «${etichetta}» non si può premere (${e.message.split('\n')[0].slice(0, 80)})`); continue; }
      totale++;
      await P.waitForTimeout(180);
      // dentro la finestra aperta: preme tutti i suoi tasti, uno alla volta
      const finestra = await P.evaluate(() => { const f = [...document.querySelectorAll('.finestra')].filter(x => !x.classList.contains('hidden')).pop(); return f ? f.id : ''; });
      if (finestra && finestra !== 'finDomanda' && finestra !== 'finAttesa') {
        const n2 = await P.locator('#' + finestra + ' button:visible').count();
        for (let j = 0; j < Math.min(n2, 40); j++) {
          const dentro = P.locator('#' + finestra + ' button:visible');
          if (j >= await dentro.count()) break;
          const t2 = dentro.nth(j), e2 = ((await t2.textContent().catch(() => '')) || (await t2.getAttribute('aria-label')) || '').trim().replace(/\s+/g, ' ').slice(0, 40);
          if (/^Chiudi$|Chiudi avviso|Cancella tutto|Elimina|Scollega|Importa|Esporta|Sostituisci|^Close$|Close notice|Delete|Unlink|Disconnect|Import|Export|Replace/i.test(e2) && !/Esporta in tabella|Export to (a )?spreadsheet/.test(e2)) continue;   // distruttivi: li provano le altre prove
          if (await t2.getAttribute('data-lingua')) continue;   // la lingua ricarica la pagina: la prova prove/inglese.js
          if (await t2.getAttribute('aria-disabled') === 'true') continue;   // non disponibile su questo telefono (es. impronta assente): lo provano le altre prove
          if (process.env.DEBUG) console.log('      dentro', finestra, j, e2);
          try { await t2.click({ timeout: 2500 }); totale++; } catch (e) { segnala(`${nome} · ${v} · ${finestra}: «${e2}» non si può premere (${e.message.split('\n').slice(0, 3).join(' ').slice(0, 160)})`); }
          await P.waitForTimeout(140);
          // chiusa (o sta sfumando via perché sopra se n'è aperta un'altra al suo posto): si aspetta la fine e si riapre
          const inCima = await P.evaluate(() => DC.pila.slice(-1)[0] || '');
          if (inCima !== finestra && !['finDomanda', 'finTendina', 'finData'].includes(inCima)) await P.waitForTimeout(650);
          if (inCima !== finestra && !['finDomanda', 'finTendina', 'finData'].includes(inCima) || !(await P.evaluate(id => { const f = document.getElementById(id); return f && !f.classList.contains('hidden'); }, finestra))) {
            // la finestra si è chiusa (era «Chiudi» o «Salva»): si riapre per provare gli altri
            await preparati(); await tasti.nth(i).click({ timeout: 3000 }).catch(() => {}); await P.waitForTimeout(320);
            if (!(await P.evaluate(id => { const f = document.getElementById(id); return f && !f.classList.contains('hidden'); }, finestra))) break;
            continue;
          }
          // una domanda aperta dal tasto: si risponde di no
          if (await P.locator('#finDomanda:not(.hidden)').count()) await rispondiDomanda();
          // una finestra aperta sopra (calendario, tendina): Indietro la chiude e si torna alla finestra di prima
          // (una volta sola, poi si aspetta la fine della dissolvenza: un secondo Indietro chiuderebbe anche la finestra sotto)
          const sopra = await P.evaluate(() => { const f = [...document.querySelectorAll('.finestra')].filter(x => !x.classList.contains('hidden')).pop(); return f ? f.id : ''; });
          if (sopra && sopra !== finestra) { if (sopra === 'finDomanda') await rispondiDomanda(); else await P.keyboard.press('Escape'); await P.waitForTimeout(900); }
        }
      }
      if (process.env.PROGRESSO) console.log('   ' + v + ' #' + i + '/' + quanti + ' «' + etichetta + '»');
      if (errori.length > prima) segnala(`${nome} · ${v}: «${etichetta}» ha dato errore: ${errori.slice(prima).join(' | ').slice(0, 200)}`);
      if (!(await chiudiTutto())) segnala(`${nome} · ${v}: dopo «${etichetta}» resta una finestra aperta che Indietro non chiude`);
    }
    // la pagina non deve sbordare di lato
    const largo = await P.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (largo > 1) segnala(`${nome} · ${v}: la pagina sborda di ${largo}px`);
  }
  if (errori.length) segnala(`${nome}: errori in pagina: ${[...new Set(errori)].join(' | ').slice(0, 400)}`);
  if (process.env.INGLESE) { const f = process.env.INGLESE, prima = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [], ora = await P.evaluate(() => [...(window.__nonTradotti || [])]).catch(() => []); fs.writeFileSync(f, JSON.stringify([...new Set([...prima, ...ora])].sort(), null, 1)); console.log('   testi senza traduzione: ' + ora.length); }
  await b.close();
}
(async () => {
  await giro('Pagina web', 'http://127.0.0.1:8786/sorgente-DoctorCar.html', false);
  await giro('App Android (simulata)', 'http://127.0.0.1:8785/index.html', true);
  console.log(`\n${totale} tasti premuti, ${problemi.length} problemi`);
  process.exit(problemi.length ? 1 : 0);
})();
