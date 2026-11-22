// Impaginazione: in nessuna finestra i blocchi devono restringersi o sovrapporsi, anche con tutte le sezioni aperte,
// su schermi piccoli e grandi, nella pagina web e nell'app; la pagina non deve sbordare di lato.
// Uso: node prove/layout.js
const { chromium } = require('playwright');
let ok = 0, ko = 0;
const verifica = (cond, nome) => { if (cond) { ok++; } else { ko++; console.log('  ✗ ' + nome); } };
const SCHERMI = [['320×568', 320, 568], ['360×640', 360, 640], ['412×915', 412, 915], ['tablet 800×1280', 800, 1280], ['PC 1280×800', 1280, 800]];
(async () => {
  const b = await chromium.launch();
  for (const [url, nome] of [['http://127.0.0.1:8786/sorgente-DoctorCar.html', 'pagina web'], ['http://127.0.0.1:8785/index.html', 'app']]) {
    for (const [etichetta, w, h] of SCHERMI) {
      for (const testo of [100, 115, 130]) {
        const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'it-IT' }), P = await ctx.newPage();
        if (nome === 'app') await P.addInitScript("window.Capacitor={isNativePlatform:()=>true,addListener:()=>({remove(){}}),nativePromise:()=>Promise.resolve({})}");
        await P.addInitScript(t => { try { localStorage.setItem('doctorcar_testo', JSON.stringify(t)); } catch (_) {} }, testo);
        if (process.env.INGLESE) await P.addInitScript(() => { try { localStorage.setItem('doctorcar_lingua', '"en"'); } catch (_) {} });   // INGLESE=1: le stesse prove con l'app in inglese
        const errori = []; P.on('pageerror', e => errori.push(e.message));
        await P.goto(url);
        // nell'app il testo lo ingrandisce Android (zoom della WebView): qui si simula ogni scritta × il fattore, a ogni passo
        const ingrandisci = async () => { if (nome === 'app' && testo !== 100) await P.evaluate(f => {
          for (const e of document.querySelectorAll('[data-zfs]')) { const o = e.getAttribute('data-zfs'); if (o) e.style.setProperty('font-size', o); else e.style.removeProperty('font-size'); e.removeAttribute('data-zfs'); }
          const el = [...document.querySelectorAll('body, body *')].map(e => [e, parseFloat(getComputedStyle(e).fontSize)]);
          for (const [e, px] of el) { e.setAttribute('data-zfs', e.style.getPropertyValue('font-size') || ''); e.style.setProperty('font-size', (px * f) + 'px', 'important'); }
        }, testo / 100); };
        const dove = `${nome} · ${etichetta}${testo !== 100 ? ' · testo grande' : ''}`;
        await P.evaluate(() => { DC.unisci({ veicoli: [{ id: 'auto0001', mod: 1, dev: 'aaaaaaaaaaaa', nome: 'Panda', alimentazione: 'benzina' }] }); DC.salvaDati(); DC.disegna(); });
        const controlla = async (id, cosa) => {
          await ingrandisci(); await P.waitForTimeout(80);
          const r = await P.evaluate(id => {
            const f = document.querySelector('#' + id + ' > .foglio'); if (!f) return null;
            const stretti = [...f.children].filter(c => c.getBoundingClientRect().height > 0 && c.scrollHeight - c.getBoundingClientRect().height > 2).map(c => c.className || c.id);
            // blocchi che si coprono: due figli consecutivi con i rettangoli sovrapposti
            const el = [...f.children].filter(c => c.getBoundingClientRect().height > 0).map(c => c.getBoundingClientRect()); let sovr = 0;
            for (let i = 1; i < el.length; i++) if (el[i].top < el[i - 1].bottom - 1) sovr++;
            return { stretti, sovr, sbordo: document.documentElement.scrollWidth - document.documentElement.clientWidth, foglioSbordo: f.scrollWidth - f.clientWidth };
          }, id);
          verifica(r && r.stretti.length === 0, `${dove}: ${cosa}: blocchi schiacciati (${r && r.stretti.join(', ')})`);
          verifica(r && r.sovr === 0, `${dove}: ${cosa}: blocchi sovrapposti`);
          verifica(r && r.sbordo <= 1 && r.foglioSbordo <= 1, `${dove}: ${cosa}: sborda di lato`);
        };
        // impostazioni con tutte le sezioni aperte
        await P.locator('header [data-click="apriImpostazioni()"]').click(); await P.waitForTimeout(450);
        for (const k of await P.evaluate(() => [...document.querySelectorAll('[data-cat]')].filter(e => e.offsetParent).map(e => e.dataset.cat))) { try { await P.locator('[data-cat="' + k + '"]').click({ timeout: 4000 }); } catch (e) { verifica(false, `${dove}: la sezione «${k}» delle Impostazioni non si può aprire (fuori dallo schermo?)`); } await P.waitForTimeout(150); }
        await controlla('finImpostazioni', 'Impostazioni tutte aperte');
        await P.keyboard.press('Escape'); await P.waitForTimeout(550);
        // modulo dell'intervento con le foto
        await P.locator('#barraNuovo [data-click="nuovoIntervento()"]').click(); await P.waitForTimeout(450);
        await controlla('finModulo', 'nuovo intervento');
        await P.keyboard.press('Escape'); await P.waitForTimeout(550);
        // la barra in basso: nessuna scritta sotto gli 11 px sullo schermo, nessuna che esce dal suo tasto
        await ingrandisci();
        const barra = await P.evaluate(() => [...document.querySelectorAll('#navVoci .nav span, #barraNuovo .bn span')].map(e => { const r = e.getBoundingClientRect(), p = e.closest('button').getBoundingClientRect(); return { px: parseFloat(getComputedStyle(e).fontSize), fuori: r.left < p.left - 1 || r.right > p.right + 1 }; }));
        verifica(barra.every(b => b.px >= 10.9), `${dove}: scritte della barra sotto gli 11 px (${barra.map(b => b.px.toFixed(1)).join(',')})`);
        verifica(barra.every(b => !b.fuori), `${dove}: una scritta della barra esce dal suo tasto`);
        for (const v of ['interventi', 'scadenze', 'rifornimenti', 'spese', 'veicoli', 'home']) {
          await P.evaluate(v => DC.COMANDI.vai(v), v); await P.waitForTimeout(150); await ingrandisci();
          const sb = await P.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          verifica(sb <= 1, `${dove}: sezione ${v} sborda di ${sb}px`);
        }
        verifica(errori.length === 0, `${dove}: errori ${errori.join(' | ')}`);
        await ctx.close();
      }
    }
  }
  console.log(`${ok} controlli riusciti, ${ko} falliti`);
  await b.close(); process.exit(ko ? 1 : 0);
})();
