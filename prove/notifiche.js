// Le notifiche: in basso (sopra la barra) e chiuse scorrendole con il dito, di lato e verso il basso. Uso: node prove/notifiche.js
const { chromium, devices } = require('playwright');
const APP = [
  { nome: 'DoctorCar web', url: 'http://127.0.0.1:8786/sorgente-DoctorCar.html', id: 'avviso', barra: 'barraNav', mostra: t => DC.avviso('Prova', t), init: {} },
  { nome: 'DoctorCar app', url: 'http://127.0.0.1:8785/index.html', id: 'avviso', barra: 'barraNav', mostra: t => DC.avviso('Prova', t), init: {} },
];
let ok = 0, ko = 0; const t = (n, c, x = '') => { (c ? ok++ : ko++); console.log((c ? '  ✓ ' : '  ✗ ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const b = await chromium.launch();
  for (const A of APP) for (const anim of ['si', 'no']) {
    console.log(`▶ ${A.nome} (animazioni ${anim})`);
    const ctx = await b.newContext({ ...devices['Pixel 7'], hasTouch: false, isMobile: false, locale: 'it-IT' });
    await ctx.addInitScript(([i, a]) => { if (sessionStorage.getItem('__f')) return; sessionStorage.setItem('__f', '1'); for (const k in i) localStorage.setItem(k, i[k]); for (const k of ['doctorwood_animazioni', 'doctorcar_animazioni', 'bothwise_animazioni']) localStorage.setItem(k, a); }, [A.init, anim]);
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.goto(A.url); await p.waitForTimeout(3500);
    await p.evaluate(() => { document.querySelectorAll('[id^=modal]:not(.hidden), .finestra:not(.hidden)').forEach(m => { try { m.classList.add('hidden'); } catch (_) {} }); });
    for (const [tipo, dx, dy] of [['info', 0, 60], ['ok', 100, 0], ['errore', -100, 0], ['info', 0, 25]]) {
      await p.evaluate(`(${A.mostra})(${JSON.stringify(tipo)})`); await p.waitForTimeout(700);
      const pos = await p.evaluate(([id, barra]) => { const e = document.getElementById(id), c = (e.firstElementChild && e.firstElementChild.tagName === 'DIV') ? e.firstElementChild : e; const r = c.getBoundingClientRect(); const bb = barra && document.getElementById(barra); const top = bb && getComputedStyle(bb).display !== 'none' ? bb.getBoundingClientRect().top : innerHeight; return { basso: r.top > innerHeight / 2, sopraBarra: r.bottom <= top + 1, x: r.x + r.width / 3, y: r.y + r.height / 2 }; }, [A.id, A.barra]);
      t(`«${tipo}» in basso, sopra la barra`, pos.basso && pos.sopraBarra, JSON.stringify(pos));
      await p.evaluate(() => getSelection().removeAllRanges()); await p.mouse.move(pos.x, pos.y); await p.mouse.down(); await p.mouse.move(pos.x + dx / 2, pos.y + dy / 2, { steps: 4 }); await p.mouse.move(pos.x + dx, pos.y + dy, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(700);
      t(`«${tipo}» scorso col dito (${dx}, ${dy}) sparisce`, await p.evaluate(id => document.getElementById(id).classList.contains('hidden'), A.id));
    }
    t('nessun errore', !err.length, err.join(' | '));
    await ctx.close();
  }
  console.log(`\n${ok} riusciti, ${ko} falliti`); await b.close();
})();
