// Crea guida/DoctorCar-Guida.pdf da guida/guida.html (le immagini sono in guida/img, scattate da schermate.js).
// Con l'argomento «tutorial» crea il file dei tutorial (tutorial.html).
// Uso (dalla cartella doctorcar): node guida/genera-guida.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const modo = process.argv[2] === 'tutorial' ? 'tutorial' : 'guida';
const gradle = fs.readFileSync(path.join(__dirname, '..', 'android', 'app', 'build.gradle'), 'utf8');
const versione = (gradle.match(/versionName "([^"]+)"/) || [])[1] || '?';
const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const oggi = new Date(); const data = `${oggi.getDate()} ${mesi[oggi.getMonth()]} ${oggi.getFullYear()}`;

(async () => {
  const html = fs.readFileSync(path.join(__dirname, modo + '.html'), 'utf8').replace('{{VERSIONE}}', versione).replace('{{DATA}}', data);
  const tmp = path.join(__dirname, '.guida-compilata.html'); fs.writeFileSync(tmp, html);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + tmp); await p.waitForLoadState('load');
  await p.emulateMedia({ media: 'print' });
  const out = path.join(__dirname, 'DoctorCar-' + (modo === 'tutorial' ? 'Tutorial' : 'Guida') + '.pdf');
  await p.pdf({ path: out, format: 'A4', printBackground: true, margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
    displayHeaderFooter: true, headerTemplate: '<div></div>',
    footerTemplate: `<div style="font-size:8px;color:#94a3b8;width:100%;text-align:center;font-family:sans-serif">DoctorCar ${versione} · ${modo === 'tutorial' ? 'Tutorial' : "Guida all'uso"} · pagina <span class="pageNumber"></span> di <span class="totalPages"></span></div>` });
  await b.close(); fs.unlinkSync(tmp);
  console.log('Creato ' + out + ' (versione ' + versione + ')');
})();
