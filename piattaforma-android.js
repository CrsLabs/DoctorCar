    // ======================================================================
    // DoctorCar nell'app Android. Questo blocco si aggiunge in fondo alla pagina (prepara.py) e si attiva
    // solo dentro l'app: nel browser del computer non fa niente.
    //  - file: «Salva come» di Android al posto dello scaricamento del browser
    //  - vibrazione leggera dei tasti
    //  - SINCRONIZZAZIONE DIRETTA con PairWood: i dispositivi abbinati si parlano nella stessa Wi‑Fi, in TLS 1.3,
    //    senza cloud e senza account. La rete la usa solo PairWood (codice nativo): questa pagina resta senza rete
    //    (CSP connect-src 'none') e scrive/legge solo file CIFRATI nella cartella privata di PairWood.
    // ======================================================================
    (function () {
      const CAP = window.Capacitor;
      if (!(CAP && CAP.isNativePlatform && CAP.isNativePlatform())) return;
      const DC = window.DC;
      const { esc, leggiJ, scriviJ, b64, byte, casuali, testo, daTesto } = DC;
      const nat = (metodo, opz) => CAP.nativePromise('DoctorCar', metodo, opz || {});
      const pw = (metodo, opz) => CAP.nativePromise('PairWood', metodo, opz || {});
      const $ = id => document.getElementById(id);
      const S = window.localStorage;

      // ---------- file ----------
      DC.impostaSalvaFile(async (nome, mime, dati) => {
        const r = await nat('salvaFile', { nome, mime, dati: b64(dati) });
        return !!(r && r.salvato);
      });

      // ---------- vibrazione: dal motore del telefono, con l'intensità scelta ----------
      // La pagina chiama navigator.vibrate(schema) come sul web; qui lo schema va al motore nativo, che regola anche l'ampiezza.
      try {
        Object.defineProperty(navigator, 'vibrate', { configurable: true, value: schema => {
          const tempi = (Array.isArray(schema) ? schema : [schema]).map(Number).filter(x => Number.isFinite(x) && x >= 0);
          if (!tempi.length || !tempi.some(x => x > 0)) return true;
          nat('vibra', { tempi, forza: DC.forzaVibrazione(), tipo: String(window.__tipoVibrazione || '') }).catch(() => {});
          return true;
        } });
      } catch (_) {}

      // ---------- dimensione del testo: nell'app è lo zoom del testo della WebView (Android la ricorda alla riapertura) ----------
      window.__testoNativo = v => { nat('dimensioneTesto', { percento: v }).catch(() => {}); };
      try { DC.applicaTesto(); } catch (_) {}

      // ---------- apertura con il logo ----------
      // All'apertura la pagina parte coperta dal blu (lo decide la testa della pagina): il logo compare dal centro in
      // dissolvenza, poi il nome; dopo un attimo la schermata sfuma e la Home entra, un riquadro dopo l'altro.
      // Non si salta. Con le animazioni spente il logo resta fermo un attimo. (Nelle prove automatiche dura un istante,
      // salvo quando si prova proprio l'apertura: window.__avvioIntero.)
      const animOn = () => document.documentElement.getAttribute('data-animazioni') === 'si';
      const inAvvio = document.documentElement.hasAttribute('data-avvio');
      const blocco = document.createElement('div');
      blocco.id = 'avvio';
      blocco.setAttribute('role', 'img'); blocco.setAttribute('aria-label', 'DoctorCar si sta aprendo');
      Object.assign(blocco.style, { position: 'fixed', inset: '0', zIndex: '9998', background: '#1e293b', display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '24px', visibility: 'visible' });
      blocco.innerHTML = `<div class="avvio-logo"><svg viewBox="8 24 84 52" width="196" height="122" aria-hidden="true"><g transform="translate(12 26.6) scale(0.836)"> <path fill-rule="evenodd" fill="#e2e8f0" d="M0 0 H14 A28 28 0 0 1 14 56 H0 Z M11 11 H14 A17 17 0 0 1 14 45 H11 Z"/> <path d="M79.300 40.900 A20 20 0 1 1 79.300 15.100" fill="none" stroke="#1e293b" stroke-width="23"/> <path d="M79.300 40.900 A20 20 0 1 1 79.300 15.100" fill="none" stroke="#f59e0b" stroke-width="16"/> <path d="M79.300 40.900 A20 20 0 1 1 79.300 15.100" fill="none" stroke="#1e293b" stroke-width="1.6" stroke-dasharray="3.2 3.6"/> <g transform="translate(76.45 28) scale(-0.34 0.34) translate(-50.5 -53.5)"> <path fill="#e2e8f0" d="M8 62 C8 53 12 50 20 49 L31 48 L42 33 C44 31 46 30 49 30 L70 30 C73 30 75 31 77 34 L86 48 C91 49 93 52 93 57 L93 63 C93 65 92 66 90 66 L8 66 Z"/> <path fill="#1e293b" d="M46 35 L49.5 35 L49.5 46 L37 46 Z M53.5 35 L69 35 C70.5 35 71.5 36 72.5 37.5 L77.5 46 L53.5 46 Z"/> <circle cx="27" cy="67" r="10.5" fill="#f59e0b"/><circle cx="27" cy="67" r="4.5" fill="#1e293b"/><circle cx="74" cy="67" r="10.5" fill="#f59e0b"/><circle cx="74" cy="67" r="4.5" fill="#1e293b"/> </g> </g></svg></div>` +
        `<div class="avvio-nome" style="font-size:30px;font-weight:800;color:#f1f5f9;letter-spacing:-0.01em">Doctor<span style="color:#f59e0b">Car</span></div>` +
        `<p class="avvio-motto" style="font-size:13px;color:#94a3b8;margin:0">L'auto sempre in ordine</p>`;
      document.body.appendChild(blocco);
      blocco.insertAdjacentHTML('beforeend',
        `<p id="bloccoTesto" class="blocco-ui" style="font-size:13px;color:#94a3b8;text-align:center;max-width:280px;margin:0">Dati protetti</p>` +
        `<button type="button" id="bloccoSblocca" class="tasto primo blocco-ui" style="min-height:48px;padding:0 24px;font-size:15px">Sblocca con l'impronta</button>`);

      // ---------- blocco con impronta (o PIN del telefono) ----------
      // All'apertura e quando si torna nell'app: la pagina resta coperta finché non si conferma chi tiene il telefono.
      // Non scatta per le uscite chieste dall'app stessa (fotocamera, scelta di file, «Salva come», richieste di permesso):
      // lì conta solo restare fuori più di 10 minuti.
      let puoBloccare = false;
      const bloccoScelto = () => S.getItem('doctorcar_blocco') !== 'no';
      const deveBloccare = () => puoBloccare && bloccoScelto();
      const bloccato = () => blocco.classList.contains('con-blocco') && blocco.style.display === 'flex';
      function mostraBlocco(si) {
        const root = document.documentElement;
        blocco.style.display = si ? 'flex' : 'none';
        blocco.classList.toggle('con-blocco', si);
        // sotto il blocco la pagina è nascosta davvero (non solo coperta): niente si legge né si preme, nemmeno con una tastiera
        if (si) { root.setAttribute('data-bloccato', ''); try { document.activeElement && document.activeElement.blur(); } catch (_) {} }
        else root.removeAttribute('data-bloccato');
      }
      let sbloccando = false, homeEntrata = false;
      async function sblocca() {
        if (sbloccando) return;
        sbloccando = true;
        try {
          await nat('verificaIdentita', { titolo: 'DoctorCar', sottotitolo: 'Sblocca per vedere i tuoi dati' });
          if (blocco.animate && animOn()) { const an = blocco.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-out', fill: 'forwards' }); await an.finished.catch(() => {}); mostraBlocco(false); an.cancel(); }
          else mostraBlocco(false);
          $('bloccoTesto').textContent = 'Dati protetti';
          if (!homeEntrata) { homeEntrata = true; try { DC.animaApertura(); } catch (_) {} }
        } catch (e) {
          $('bloccoTesto').textContent = e && e.code === 'ANNULLATO' ? 'Sblocco annullato.' : 'Sblocco non riuscito: riprova.';
        } finally { sbloccando = false; }
      }
      $('bloccoSblocca').addEventListener('click', sblocca);
      // uscite verso altre schermate chieste dall'app: valgono finché durano (e per qualche secondo dopo)
      const INTERNE = new Set(['salvaFile', 'apriImpostazioniNotifiche', 'verificaIdentita', 'scansionaQr', 'chiediNotifiche', 'scegliCartella', 'aggiungiAlCalendario', 'condividiFile', 'scattaFoto', 'posizione', 'apriMappa', 'attivaPosizione', 'impostazioniApp', 'email', 'apriLink']);
      let internePendenti = 0, ultimaInternaInizio = 0, ultimaInternaFinita = 0, uscitaInterna = 0;
      const npOrig = CAP.nativePromise.bind(CAP);
      CAP.nativePromise = (pl, m, o) => {
        if (!INTERNE.has(m)) return npOrig(pl, m, o);
        internePendenti++; ultimaInternaInizio = Date.now();
        // l'impronta conta solo finché è sullo schermo (e 1,5 s dopo: il PIN del telefono apre una schermata di Android); le altre uscite 4 s dopo
        return npOrig(pl, m, o).finally(() => { internePendenti = Math.max(0, internePendenti - 1); ultimaInternaFinita = Date.now() - (m === 'verificaIdentita' ? 2500 : 0); });
      };
      document.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('input[type=file]')) uscitaInterna = Date.now(); }, true);
      let inPausa = false, uscitoAlle = 0, fuoriPerNoi = false;
      const uscitaApp = () => {
        if (inPausa) return;
        inPausa = true; uscitoAlle = Date.now();
        fuoriPerNoi = (internePendenti > 0 && Date.now() - ultimaInternaInizio < 600000) || Date.now() - ultimaInternaFinita < 4000 || Date.now() - uscitaInterna < 6000;
        if (!fuoriPerNoi && deveBloccare()) mostraBlocco(true);   // il telefono mostra già il blu nelle app recenti
      };
      const rientroApp = () => {
        if (inPausa) {
          inPausa = false;
          if (fuoriPerNoi) { fuoriPerNoi = false; if (Date.now() - uscitoAlle > 10 * 60000 && deveBloccare()) mostraBlocco(true); }
        }
        if (bloccato()) sblocca();
      };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') uscitaApp(); else rientroApp(); });
      window.__pausaApp = uscitaApp; window.__ripresaApp = () => { if (inPausa) rientroApp(); };
      // Le operazioni delicate (copie di sicurezza, tabella, cancellare tutto) chiedono prima impronta o PIN.
      // «sempre»: anche se il blocco dell'app è spento (cancellare tutto).
      window.__confermaIdentita = async (titolo, sempre) => {
        if (!puoBloccare || (!sempre && !bloccoScelto())) return true;
        try { await nat('verificaIdentita', { titolo: 'DoctorCar', sottotitolo: titolo }); return true; }
        catch (e) { DC.avviso(e && e.code === 'ANNULLATO' ? 'Operazione annullata.' : 'Non riesco a verificare chi sei: riprova.', e && e.code === 'ANNULLATO' ? 'info' : 'errore'); return false; }
      };
      // l'impostazione
      function disegnaBlocco() {
        const sw = $('impBlocco'); if (!sw) return;
        sw.setAttribute('aria-checked', String(deveBloccare()));
        sw.setAttribute('aria-disabled', String(!puoBloccare)); sw.style.opacity = puoBloccare ? '' : '.55';
        $('bloccoNota').textContent = puoBloccare ? '' : 'Il telefono non ha né impronta né PIN: attiva un blocco dello schermo nelle impostazioni di Android per usare questa funzione.';
      }
      window.disegnaBlocco = disegnaBlocco;
      async function alternaBloccoApp() {
        if (!puoBloccare) { DC.avviso('Prima attiva un blocco dello schermo (impronta o PIN) nelle impostazioni di Android.', 'info'); return; }
        const spegne = bloccoScelto();
        if (!(await window.__confermaIdentita(spegne ? 'Conferma per spegnere il blocco' : 'Conferma per accendere il blocco', true))) return;
        try { S.setItem('doctorcar_blocco', spegne ? 'no' : 'si'); } catch (_) {}
        disegnaBlocco();
      }
      Object.assign(DC.COMANDI, { alternaBloccoApp });

      const durataAvvio = !inAvvio || (navigator.webdriver && !window.__avvioIntero) ? 0 : animOn() ? 2800 : 1200;   // il nome e il motto finiscono di comparire a 1,7 s: poi un attimo fermi, e solo dopo l'impronta
      const fineAvvio = new Promise(r => setTimeout(r, Math.max(0, durataAvvio - performance.now())));   // contati dall'apertura della pagina
      (async () => {
        const [ok] = await Promise.all([nat('puoSbloccare').then(r => !!(r && r.ok)).catch(() => false), fineAvvio]);
        puoBloccare = ok; disegnaBlocco();
        const root = document.documentElement;
        if (inAvvio) { blocco.style.display = 'flex'; root.removeAttribute('data-avvio'); }
        if (deveBloccare()) {   // dopo il logo, la richiesta dell'impronta
          if (inAvvio && durataAvvio) { blocco.classList.add('dopo-avvio'); setTimeout(() => blocco.classList.remove('dopo-avvio'), 900); }
          mostraBlocco(true); sblocca(); return;
        }
        if (inAvvio && durataAvvio && blocco.animate && animOn()) await blocco.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: 'ease-in-out' }).finished.catch(() => {});
        mostraBlocco(false);
        if (inAvvio && durataAvvio) { try { DC.animaApertura(); } catch (_) {} }   // la Home entra adesso, non sotto il logo
      })();

      // ---------- fluidità dello schermo (60 / 90 / 120 Hz) ----------
      // Automatica: decide Android. Massima: la frequenza più alta dello schermo (più fluido, un po' più di batteria).
      // 60 Hz: risparmio. Con le animazioni spente, «Automatica» vale come 60 Hz.
      let hzMassimi = 0;
      const sceltaFrequenza = () => { const v = S.getItem('doctorcar_frequenza'); return v === 'auto' || v === '60' ? v : 'massima'; };
      function applicaFrequenza() {
        const sc = sceltaFrequenza(), modo = sc === 'auto' && !animOn() ? '60' : sc;
        nat('impostaFrequenza', { modo }).catch(() => {});
      }
      function aggiornaFrequenza() {
        const sc = sceltaFrequenza();
        document.querySelectorAll('#impHz [data-hz]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.hz === sc)));
        const bm = document.querySelector('#impHz [data-hz="massima"]');
        if (bm) bm.textContent = hzMassimi > 60 ? `Massima (${hzMassimi} Hz)` : 'Massima';
      }
      function impostaFrequenza(modo) {
        if (modo !== 'auto' && modo !== 'massima' && modo !== '60') return;
        try { S.setItem('doctorcar_frequenza', modo); } catch (_) {}
        applicaFrequenza(); aggiornaFrequenza();
      }
      Object.assign(DC.COMANDI, { impostaFrequenza });
      // con le animazioni spente «Automatica» vale 60 Hz: si riapplica quando si accendono o spengono
      const alternaAnimOrig = DC.COMANDI.alternaAnimazioni;
      DC.COMANDI.alternaAnimazioni = function () { const r = alternaAnimOrig.apply(this, arguments); applicaFrequenza(); return r; };
      nat('frequenze').then(r => { hzMassimi = (r && r.massima) || 0; aggiornaFrequenza(); }).catch(() => {});
      applicaFrequenza(); aggiornaFrequenza();

      // ---------- tastiera: la barra in basso si nasconde, le finestre si accorciano ----------
      window.__tastiera = px => {
        document.documentElement.classList.toggle('con-tastiera', px > 0);
        document.documentElement.style.setProperty('--tastiera', px + 'px');
        const a = document.activeElement;
        if (px > 0 && a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) setTimeout(() => { try { a.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {} }, 120);
      };

      // ---------- cancellare ogni traccia ----------
      window.cancellaTuttoNativo = async () => {
        DC.attesa('Cancella tutto', 'Cancello i dati…');
        await pw('cancellaTutto').catch(() => {});
        try { S.clear(); } catch (_) {}
        try { await DC.Foto.cancellaTutto(); } catch (_) {}
        await nat('cancellaTutto').catch(() => location.reload());   // Android chiude l'app e toglie tutti i dati
      };

      // ======================================================================
      // SINCRONIZZAZIONE
      // Ogni dispositivo scrive un solo file, il suo: «doctorcar-<id>.dcsync», con TUTTI i dati (anche le cancellazioni),
      // cifrato con AES-256-GCM. Ogni dispositivo legge i file degli altri e li unisce ai suoi (vince la modifica più
      // recente, record per record). Nessun file ha due autori, quindi niente conflitti tra file.
      // Chiave: dal codice di abbinamento (20 caratteri, ~100 bit) con PBKDF2; sul dispositivo resta custodita con il
      // Keystore di Android. Lo stesso codice abbina i dispositivi in PairWood (solo chi lo conosce entra).
      // ======================================================================
      const K_SINC = 'doctorcar_sinc', K_STATO = 'doctorcar_sinc_stato';
      const CARTELLA = 'auto', PREFISSO = 'doctorcar-', ESTENSIONE = '.dcsync';
      const PORTA_DOCTORCAR = 47813;   // una porta per app: DoctorWood 47811, BothWise 47812, DoctorCar 47813 (sullo stesso telefono non si pestano i piedi)
      const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';   // senza I, L, O, U: non si confondono
      const ITERAZIONI = 600000;
      const sinc = () => { const c = leggiJ(K_SINC, null); return c && c.v === 1 && c.chiave && c.chiave.iv ? c : null; };
      const stato = () => Object.assign({ inviato: 0, ricevuto: 0, controllato: 0, hash: '', visti: {}, illeggibili: {}, errore: '' }, leggiJ(K_STATO, {}));
      const nuovoCodice = () => [...casuali(20)].map(x => ALFABETO[x & 31]).join('');
      const formattaCodice = c => c.match(/.{1,4}/g).join('-');
      const pulisciCodice = t => String(t || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
      const codiceValido = c => c.length === 20 && [...c].every(x => ALFABETO.includes(x));
      const chiaveDaCodice = c => DC.chiaveDaPassword('doctorcar-sincronia:' + c, testo.encode('doctorcar-sincronia-1'), ITERAZIONI);
      const mioFile = () => PREFISSO + DC.dispositivo() + ESTENSIONE;
      async function sha(t) { return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', testo.encode(t)))); }
      async function chiave(c) { const r = await nat('riprendi', c.chiave); return byte(r.dati); }
      const aad = dev => testo.encode('doctorcar-sincronia-1|' + dev);
      async function cifra(K, ogg) {
        const iv = casuali(12), dev = DC.dispositivo();
        const d = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(dev) }, await DC.chiaveAes(K), testo.encode(JSON.stringify(ogg)));
        return JSON.stringify({ app: 'DoctorCar', formato: 'sincronia', versione: 1, dispositivo: dev, iv: b64(iv), dati: b64(new Uint8Array(d)) });
      }
      async function decifra(K, nome, txt) {
        const b = JSON.parse(txt);
        if (!b || b.app !== 'DoctorCar' || b.formato !== 'sincronia' || typeof b.dispositivo !== 'string' || !/^[0-9a-f]{12}$/.test(b.dispositivo)
          || nome !== PREFISSO + b.dispositivo + ESTENSIONE || typeof b.iv !== 'string' || typeof b.dati !== 'string') throw new Error('formato');
        const d = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: byte(b.iv), additionalData: aad(b.dispositivo) }, await DC.chiaveAes(K), byte(b.dati));
        return JSON.parse(daTesto.decode(new Uint8Array(d)));
      }

      // ---------- foto: ogni foto è un file cifrato «doctorcar-foto-<id>.dcfoto», scritto una sola volta ----------
      const PREFISSO_FOTO = 'doctorcar-foto-', ESTENSIONE_FOTO = '.dcfoto';
      const nomeFoto = id => PREFISSO_FOTO + id + ESTENSIONE_FOTO;
      async function cifraFoto(K, id, bytes) {
        const iv = casuali(12);
        const d = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: testo.encode('doctorcar-foto-1|' + id) }, await DC.chiaveAes(K), bytes);
        return JSON.stringify({ app: 'DoctorCar', formato: 'foto', versione: 1, id, iv: b64(iv), dati: b64(new Uint8Array(d)) });
      }
      async function decifraFoto(K, id, txt) {
        const b = JSON.parse(txt);
        if (!b || b.app !== 'DoctorCar' || b.formato !== 'foto' || b.id !== id || typeof b.iv !== 'string' || typeof b.dati !== 'string') throw new Error('formato');
        return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: byte(b.iv), additionalData: testo.encode('doctorcar-foto-1|' + id) }, await DC.chiaveAes(K), byte(b.dati)));
      }
      async function sincronizzaFoto(K, fileFoto, esito) {
        const citate = new Set();
        for (const i of Object.values(DC.dati.interventi)) if (!i.del) for (const f of (i.foto || [])) citate.add(f);
        if (!citate.size) return;
        const inCartella = new Set(fileFoto.map(f => f.nome.slice(PREFISSO_FOTO.length, -ESTENSIONE_FOTO.length)));
        const locali = new Set(await DC.Foto.ids());
        let fatte = 0;
        for (const id of citate) {   // quelle che ho io e nella cartella mancano: si scrivono
          if (fatte >= 8) break;
          if (!locali.has(id) || inCartella.has(id)) continue;
          const r = await DC.Foto.prendi(id);
          if (!r || !r.blob) continue;
          await pwAvviato('scrivi', { cartella: CARTELLA, percorso: nomeFoto(id), testo: await cifraFoto(K, id, new Uint8Array(await r.blob.arrayBuffer())) });
          fatte++;
        }
        for (const id of citate) {   // quelle che mancano a me e nella cartella ci sono: si prendono
          if (fatte >= 16) break;
          if (locali.has(id) || !inCartella.has(id)) continue;
          const r = await pwAvviato('leggi', { cartella: CARTELLA, percorso: nomeFoto(id) });
          if (!r || !r.esiste) continue;
          try { await DC.fotoDaByte(id, await decifraFoto(K, id, r.testo)); esito.foto = (esito.foto || 0) + 1; fatte++; } catch (_) { }   // file non ancora arrivato tutto: al prossimo giro
        }
        if (esito.foto) DC.disegna();
      }
      // una foto tolta da un intervento: via anche il suo file condiviso
      window.addEventListener('foto-tolte', async e => {
        if (!sinc()) return;
        for (const id of ((e && e.detail) || [])) { try { await pwAvviato('elimina', { cartella: CARTELLA, percorso: nomeFoto(id) }); } catch (_) { } }
      });

      // ---------- PairWood ----------
      let pronto = null, rete = null;
      function avvia() {
        if (!pronto) {
          const c = sinc();
          pronto = pw('avvia', { cartelle: [CARTELLA], nome: (c && c.nome) || 'DoctorCar', minutiPeriodico: 30, porta: PORTA_DOCTORCAR })
            .then(st => { if (!avvia.ascolto) { avvia.ascolto = true; try { CAP.addListener('PairWood', 'evento', evento); } catch (_) {} } return st; })
            .catch(e => { pronto = null; throw e; });
        }
        return pronto;
      }
      const pwAvviato = async (m, o) => { await avvia(); return pw(m, o); };
      function evento(e) {
        if (!e || !sinc()) return;
        if (e.tipo === 'ricevuti') pianifica(300);   // file nuovi da un altro dispositivo: si leggono subito
        else if (e.tipo === 'abbinato') {
          const f = $('finDomanda'); if (f && !f.classList.contains('hidden') && !$('domandaQr').classList.contains('hidden') && f.chiudi) f.chiudi();
          DC.avviso('Abbinato con «' + String(e.dispositivo || 'dispositivo').slice(0, 64) + '».', 'ok'); pianifica(300); aggiornaVista();
        }
        else if (e.tipo === 'presentato') { DC.avviso('«' + String(e.dispositivo || 'dispositivo').slice(0, 64) + '» aggiunto: te l\'ha presentato «' + String(e.da || 'un tuo dispositivo').slice(0, 64) + '».', 'ok'); pianifica(500); }
        else if (e.tipo === 'sincronizzato') { rete = { raggiunti: Number(e.raggiunti) || 0, abbinati: Number(e.abbinati) || 0, quando: Date.now() }; aggiornaChip(); }
        else if (e.tipo === 'dimenticato' || e.tipo === 'abbinamentoPerso') aggiornaVista();
        else if (e.tipo === 'avviso' && /Troppi codici|occupata|vicinanze/.test(String(e.testo || ''))) DC.avviso('Sincronizzazione: ' + String(e.testo).slice(0, 200), 'errore');
      }

      // ---------- un giro: leggere gli altri, scrivere il proprio ----------
      let inCorso = false, timer = 0;
      async function sincronizza(forza) {
        const c = sinc();
        if (!c || inCorso) return null;
        inCorso = true;
        const st = stato(), esito = { ricevuti: 0, inviato: false };
        st.errore = '';
        let K = null;
        try {
          K = await chiave(c);
          const firma = f => f.modificato + ':' + f.dimensione;
          const grezzo = (((await pwAvviato('elenco', { cartella: CARTELLA, prefisso: PREFISSO })).file) || [])
            .map(f => ({ nome: String(f.percorso || ''), modificato: Number(f.modificato) || 0, dimensione: Number(f.dimensione) || 0 }))
            .filter(f => !f.nome.includes('/'));
          const elenco = grezzo.filter(f => f.nome.startsWith(PREFISSO) && f.nome.endsWith(ESTENSIONE));
          const fileFoto = grezzo.filter(f => f.nome.startsWith(PREFISSO_FOTO) && f.nome.endsWith(ESTENSIONE_FOTO));
          const mio = mioFile();
          for (const f of elenco) {
            if (f.nome === mio) continue;
            if (!forza && st.visti[f.nome] === firma(f)) continue;
            if (!forza && st.illeggibili[f.nome] === firma(f)) continue;
            const r = await pwAvviato('leggi', { cartella: CARTELLA, percorso: f.nome });
            if (!r || !r.esiste) continue;
            let o;
            try { o = await decifra(K, f.nome, r.testo); }
            catch (_) {
              if (st.illeggibili[f.nome] !== firma(f)) st.errore = 'Un dispositivo usa un codice diverso da questo (o il suo file non è arrivato tutto): ricollegalo con il codice giusto.';
              st.illeggibili[f.nome] = firma(f);
              continue;
            }
            delete st.illeggibili[f.nome];
            esito.ricevuti += DC.unisci(o && o.dati);
            st.visti[f.nome] = firma(f); st.ricevuto = Date.now();
          }
          for (const n of Object.keys(st.illeggibili)) if (!elenco.some(f => f.nome === n)) delete st.illeggibili[n];
          if (esito.ricevuti) { DC.salvaDati(); DC.disegna(); }
          // il proprio file: si riscrive solo se i dati sono cambiati (o se manca)
          const h = await sha(JSON.stringify(DC.dati));
          if (forza || h !== st.hash || !elenco.some(f => f.nome === mio)) {
            await pwAvviato('scrivi', { cartella: CARTELLA, percorso: mio, testo: await cifra(K, { creato: Date.now(), dati: DC.dati }) });
            st.hash = h; st.inviato = Date.now(); esito.inviato = true;
          }
          // le foto delle fatture (file a parte, uno per foto): quelle che mancano agli altri si mandano, quelle che mancano qui si prendono
          try { await sincronizzaFoto(K, fileFoto, esito); } catch (e) { st.errore = 'Foto non sincronizzate: ' + ((e && e.message) || e); }
          st.controllato = Date.now();
          if (st.errore) esito.errore = st.errore;
          return esito;
        } catch (e) {
          st.errore = (e && e.message) || String(e);
          return { errore: st.errore };
        } finally {
          if (K) K.fill(0);
          scriviJ(K_STATO, st);
          inCorso = false;
          aggiornaChip();
        }
      }
      function pianifica(ms) { clearTimeout(timer); if (sinc()) timer = setTimeout(() => sincronizza(false), ms || 2500); }
      // con «Sincronizza ora» prima si parla con gli altri dispositivi, poi si leggono i file arrivati
      async function sincronizzaOra() {
        try {
          await avvia(); await pw('sincronizza');
          const d = String(((await pw('diagnosi').catch(() => null)) || {}).testo || ''), m = /raggiunti (\d+) di (\d+)/.exec(d);
          const e = await sincronizza(true);
          if (e && e.errore) return e;
          if (m && Number(m[1]) === 0 && Number(m[2]) > 0) return Object.assign({}, e, { nessuno: true });
          return e;
        } catch (e) { return { errore: 'Sincronizzazione: ' + ((e && e.message) || e) }; }
      }
      window.addEventListener('dati-cambiati', () => pianifica(1500));
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pianifica(800); });
      setInterval(() => { if (document.visibilityState === 'visible') sincronizza(false); }, 60000);
      if (sinc()) { avvia().catch(e => { const st = stato(); st.errore = 'Sincronizzazione non avviata: ' + ((e && e.message) || e); scriviJ(K_STATO, st); aggiornaChip(); }); setTimeout(() => sincronizza(false), 2000); }

      // ---------- chip nell'intestazione ----------
      function aggiornaChip() {
        const b = $('statoSinc'), c = sinc();
        b.classList.toggle('hidden', !c);
        $('spazioTesta').classList.toggle('hidden', !!c);
        if (!c) return;
        const st = stato();
        let liv = 'ok', t = 'Sincronizzato';
        if (st.errore) { liv = 'errore'; t = 'Da controllare'; }
        else if (rete && rete.abbinati > 0 && rete.raggiunti === 0) { liv = 'avviso'; t = 'Nessuno vicino'; }
        else if (!st.controllato) { liv = 'avviso'; t = 'In attesa'; }
        b.dataset.liv = liv; $('statoSincTesto').textContent = t;
        b.setAttribute('aria-label', 'Sincronizzazione: ' + t);
        const f = $('finImpostazioni');
        if (f && !f.classList.contains('hidden') && $('cat-sinc') && !$('cat-sinc').classList.contains('hidden')) disegnaSinc();
      }
      function aggiornaVista() { aggiornaChip(); disegnaSinc(); }

      // ---------- la sezione «Sincronizzazione» delle Impostazioni ----------
      const quando = t => {
        if (!t) return 'mai';
        const s = Math.round((Date.now() - t) / 1000);
        if (s < 60) return 'adesso';
        if (s < 3600) return Math.round(s / 60) + ' min fa';
        return new Date(t).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      };
      async function disegnaSinc() {
        const box = $('sincCorpo'); if (!box) return;
        const c = sinc();
        if (!c) {
          box.innerHTML = `<p class="foglio-testo" style="font-size:13px">Tieni gli stessi dati su più telefoni e tablet (per esempio il tuo e quello di chi usa la stessa auto). I dispositivi si parlano direttamente nella stessa rete Wi‑Fi: niente cloud, niente account, collegamento cifrato solo tra dispositivi abbinati.</p>
            <button type="button" class="tasto primo pieno" data-click="sincPrimo()"><i class="ic ic-qr"></i>Collega un altro dispositivo</button>
            <button type="button" class="tasto pieno" data-click="sincUnisciti()"><i class="ic ic-dispositivi"></i>Ho già un codice</button>`;
          return;
        }
        const st = stato();
        let disp = [];
        try { const s = await pwAvviato('stato'); disp = s && Array.isArray(s.dispositivi) ? s.dispositivi : []; } catch (_) {}
        box.innerHTML = `
          <p class="foglio-testo" style="font-size:13px">Questo dispositivo: <b>${esc(c.nome || 'DoctorCar')}</b><br>Ultimo controllo: ${esc(quando(st.controllato))} · ricevuto: ${esc(quando(st.ricevuto))}</p>
          ${st.errore ? `<p class="nota c-rosso" role="alert">${esc(st.errore)}</p>` : ''}
          <p class="nota" style="font-weight:800">Dispositivi abbinati</p>
          ${disp.length ? disp.map(d => `<div class="riga"><span class="icona-tonda c-cielo"><i class="ic ic-dispositivi"></i></span>
            <span class="corpo"><span class="r1">${esc(String(d.nome || 'dispositivo').slice(0, 64))}</span><span class="r2">${Number(d.ultimoContatto) ? 'sentito ' + esc(quando(Number(d.ultimoContatto))) : 'non ancora sentito'}</span></span>
            <button type="button" class="tasto contorno" style="min-height:40px;padding:0 10px;font-size:12px" data-click="sincDimentica($1, $2)" data-p="${esc(JSON.stringify([String(d.id || ''), String(d.nome || '')]))}">Dimentica</button></div>`).join('')
            : '<p class="vuoto">Nessun dispositivo ancora: mostra il codice sull\'altro telefono o inquadralo da lì.</p>'}
          <button type="button" class="tasto primo pieno" data-click="sincOra()"><i class="ic ic-sinc"></i>Sincronizza ora</button>
          <div class="tasti-2">
            <button type="button" class="tasto" data-click="sincMostraCodice()"><i class="ic ic-qr"></i>Aggiungi</button>
            <button type="button" class="tasto pericolo" data-click="sincScollega()">Scollega</button>
          </div>
          <p class="nota">Per vedere i dati arrivare, tieni DoctorCar aperta su entrambi i dispositivi, nella stessa Wi‑Fi. Con l'app chiusa i dispositivi si cercano ogni tanto da soli.</p>`;
      }
      window.disegnaSinc = disegnaSinc;

      async function qrDi(codice) { try { return (await pw('qr', { testo: codice })).righe || null; } catch (_) { return null; } }
      async function nomeDispositivo() {
        const r = await DC.domanda({ titolo: 'Nome di questo dispositivo', testo: 'Così lo riconosci sugli altri dispositivi.', si: 'Avanti',
          campi: [{ etichetta: 'Nome', valore: 'Telefono', segnaposto: 'es. Telefono di Anna' }] });
        if (r.esito !== 'si') return null;
        return (r.valori[0] || '').trim().slice(0, 40) || 'DoctorCar';
      }
      async function salvaConf(K, codice, nome) {
        const conf = { v: 1, nome, chiave: await nat('custodisci', { dati: b64(K) }) };
        if (codice) conf.codice = await nat('custodisci', { dati: b64(testo.encode(codice)) });
        scriviJ(K_SINC, conf); scriviJ(K_STATO, {});
        pronto = null;
      }
      async function mostraCodice(codice, primo) {
        await avvia(); await pw('accettaAbbinamento', { codice, minuti: 10 });
        await DC.domanda({ titolo: 'Codice di abbinamento', evidenza: formattaCodice(codice), qr: await qrDi(codice), si: 'Fatto', no: '',
          testo: (primo ? 'Sull\'altro dispositivo: installa DoctorCar, poi ' : 'Sull\'altro dispositivo: ') + 'Impostazioni → «Sincronizzazione» → «Ho già un codice» → «Inquadra il QR» e punta la fotocamera qui (oppure scrivi il codice).\n\nEntro 10 minuti, con i due dispositivi nella stessa Wi‑Fi e DoctorCar aperta qui. Non mandare il codice per messaggio.' });
      }
      // primo dispositivo: crea il codice e lo mostra
      async function sincPrimo() {
        const nome = await nomeDispositivo(); if (!nome) return;
        const codice = nuovoCodice();
        DC.attesa('Sincronizzazione', 'Preparo la chiave…');
        let K;
        try { K = await chiaveDaCodice(codice); await salvaConf(K, codice, nome); } finally { if (K) K.fill(0); DC.chiudiAttesa(); }
        try { await mostraCodice(codice, true); }
        catch (e) { DC.avviso('Sincronizzazione non avviata: ' + ((e && e.message) || e), 'errore'); }
        const e = await sincronizza(true);
        aggiornaVista();
        if (e && e.errore) DC.avviso('Sincronizzazione: ' + e.errore, 'errore');
      }
      // il codice dell'altro dispositivo: si inquadra il QR oppure si scrive
      async function leggiCodice(errore) {
        let aMano = false;
        for (;;) {
          if (!aMano) {
            const q = await DC.domanda({ titolo: 'Codice di abbinamento', testo: 'Sull\'altro dispositivo: Impostazioni → «Sincronizzazione» → «Aggiungi» (o «Collega un altro dispositivo»). Inquadra il QR che compare: il collegamento parte da solo.', si: 'Inquadra il QR', alt: 'Scrivi il codice', errore });
            if (q.esito === 'alt') { aMano = true; errore = ''; continue; }
            if (q.esito !== 'si') return null;
            const r = await pw('scansionaQr').catch(e => ({ errore: (e && e.message) || 'Fotocamera non disponibile.' }));
            if (r && r.codice) {
              const c = pulisciCodice(r.codice);
              if (!codiceValido(c)) { errore = 'Quel QR non è un codice di abbinamento di DoctorCar.'; continue; }
              return c;
            }
            if (r && r.errore) { errore = r.errore + ' Puoi scrivere il codice.'; aMano = true; }
            continue;
          }
          const r = await DC.domanda({ titolo: 'Codice di abbinamento', testo: 'Scrivi il codice che vedi sull\'altro dispositivo (i trattini si mettono da soli).', si: 'Collega', alt: 'Inquadra il QR', errore,
            campi: [{ etichetta: 'Codice', codice: true, segnaposto: 'XXXX-XXXX-XXXX-XXXX-XXXX' }] });
          if (r.esito === 'alt') { aMano = false; errore = ''; continue; }
          if (r.esito !== 'si') return null;
          const c = pulisciCodice(r.valori[0]);
          if (!codiceValido(c)) { errore = 'Il codice ha 20 caratteri (lettere e numeri): controllalo.'; continue; }
          return c;
        }
      }
      async function sincUnisciti() {
        const nome = await nomeDispositivo(); if (!nome) return;
        let errore = '';
        for (;;) {
          const codice = await leggiCodice(errore);
          if (!codice) return;
          DC.attesa('Sincronizzazione', 'Cerco l\'altro dispositivo nella Wi‑Fi…');
          let K = null, altro = '';
          try {
            K = await chiaveDaCodice(codice);
            await salvaConf(K, codice, nome);
            await avvia();
            altro = ((await pw('abbina', { codice })) || {}).nome || '';
          } catch (e) {
            DC.chiudiAttesa(); if (K) K.fill(0);
            await pw('cancellaTutto').catch(() => {}); pronto = null;
            S.removeItem(K_SINC); S.removeItem(K_STATO);
            errore = ((e && e.message) || 'Abbinamento non riuscito.') + ' Controlla: stessa Wi‑Fi, DoctorCar aperta sull\'altro dispositivo con il codice in vista.';
            continue;
          }
          K.fill(0);
          DC.chiudiAttesa();
          const e = await sincronizzaOra();
          aggiornaVista();
          DC.avviso(e && e.errore ? 'Sincronizzazione: ' + e.errore : 'Collegato a «' + String(altro || 'altro dispositivo').slice(0, 64) + '»: da ora i dati viaggiano da soli.', e && e.errore ? 'errore' : 'ok');
          return;
        }
      }
      async function sincMostraCodice() {
        const c = sinc(); if (!c || !c.codice) return;
        let codice;
        try { codice = daTesto.decode(byte((await nat('riprendi', c.codice)).dati)); }
        catch (_) { DC.avviso('Il codice non è leggibile su questo dispositivo: scollega e ricollega la sincronizzazione.', 'errore'); return; }
        try { await mostraCodice(codice, false); } catch (e) { DC.avviso('Non riuscito: ' + ((e && e.message) || e), 'errore'); }
      }
      async function sincOra() {
        DC.attesa('Sincronizzazione', 'Cerco gli altri dispositivi…');
        const e = await sincronizzaOra();
        DC.chiudiAttesa();
        aggiornaVista();
        if (e && e.errore) DC.avviso('Sincronizzazione: ' + e.errore, 'errore');
        else if (e && e.nessuno) DC.avviso('Nessun altro dispositivo risponde. Controlla: stessa Wi‑Fi e DoctorCar aperta sull\'altro dispositivo.', 'info');
        else DC.avviso(e && e.ricevuti ? 'Sincronizzato: ' + e.ricevuti + ' dati arrivati.' : 'Sincronizzato: tutto già allineato.', 'ok');
      }
      async function sincDimentica(id, nome) {
        if (!id) return;
        if (!(await DC.chiedi('Dimenticare «' + String(nome || 'dispositivo').slice(0, 64) + '»?\n\nNon riceverà più i dati da questo dispositivo. Serve se l\'hai perso o non lo usi più (per maggiore sicurezza, dopo usa anche «Scollega» e ricollega gli altri con un codice nuovo).', 'Dimentica', 'Dimentica', true))) return;
        try { await pwAvviato('dimentica', { id }); DC.avviso('«' + String(nome || 'dispositivo').slice(0, 64) + '» dimenticato.', 'ok'); }
        catch (e) { DC.avviso('Non riuscito: ' + ((e && e.message) || e), 'errore'); }
        aggiornaVista();
      }
      async function sincScollega() {
        if (!(await DC.chiedi('Scollegare la sincronizzazione su questo dispositivo?\n\nI tuoi dati restano qui. Questo dispositivo dimentica gli abbinamenti e il codice: per ricollegarlo servirà di nuovo un codice.', 'Scollega', 'Scollega', true))) return;
        await pw('cancellaTutto').catch(() => {});
        pronto = null; rete = null;
        S.removeItem(K_SINC); S.removeItem(K_STATO);
        aggiornaVista();
        DC.avviso('Sincronizzazione scollegata.', 'ok');
      }
      Object.assign(DC.COMANDI, { sincPrimo, sincUnisciti, sincMostraCodice, sincOra, sincDimentica, sincScollega });
      aggiornaChip();
      window.__sincronizza = sincronizza;   // per le prove

      // ======================================================================
      // AVVISI SULLE SCADENZE
      // La pagina calcola quando avvisare (DC.calcolaPromemoria); qui si consegnano ad Android, che li fa scattare
      // all'ora giusta anche con l'app chiusa e dopo un riavvio del telefono. Si ricalcolano a ogni modifica dei dati.
      // ======================================================================
      const statoProm = { programmati: -1 };
      let timerProm = 0, chiedendo = false;
      async function notificheConcesse() { try { return !!(await nat('statoNotifiche')).concesso; } catch (_) { return false; } }
      async function riprogrammaPromemoria() {
        const o = DC.opzioniProm();
        if (!o.attivo) return;
        try { statoProm.programmati = Number((await nat('programmaPromemoria', { voci: DC.calcolaPromemoria(o).map(v => Object.assign({}, v, { titolo: DC.L(v.titolo || ''), testo: DC.Lrighe(v.testo || '') })) })).programmati) || 0; statoProm.errore = ''; }
        catch (e) { statoProm.errore = (e && e.message) || 'non programmati'; }
        disegnaAvvisi();
      }
      const pianificaProm = ms => { clearTimeout(timerProm); timerProm = setTimeout(riprogrammaPromemoria, ms || 2000); };
      async function attivaAvvisi() {
        let ok = false;
        try { ok = !!(await pw('chiediNotifiche')).concesso; } catch (_) { }
        if (!ok) ok = await notificheConcesse();
        if (!ok) { DC.impostaProm({ attivo: false }); DC.avviso('Android non permette le notifiche a DoctorCar: attivale dalle impostazioni del telefono.', 'errore'); disegnaAvvisi(); return false; }
        DC.impostaProm({ attivo: true, chiesto: true });
        await riprogrammaPromemoria();
        disegnaAvvisi();
        return true;
      }
      // la prima volta che ci sono scadenze si chiede (una volta sola) se si vogliono gli avvisi
      async function chiediAvvisiSeServe(tentativo) {
        const o = DC.opzioniProm();
        if (o.chiesto || o.attivo || chiedendo) return;
        if (!DC.veicoli().length || !Object.values(DC.dati.scadenze).some(x => !x.del)) return;
        if (document.querySelector('.finestra:not(.hidden)')) { if ((tentativo || 0) < 15) setTimeout(() => chiediAvvisiSeServe((tentativo || 0) + 1), 4000); return; }
        chiedendo = true;
        try {
          DC.impostaProm({ chiesto: true });
          const r = await DC.domanda({ titolo: 'Avvisi sulle scadenze', testo: 'Vuoi una notifica prima di tagliando, revisione, bollo e assicurazione?\n\nPuoi cambiare quando e a che ora in Impostazioni → Avvisi.', si: 'Sì, avvisami', no: 'No, grazie' });
          if (r.esito === 'si') await attivaAvvisi();
        } finally { chiedendo = false; }
      }
      async function disegnaAvvisi() {
        const sw = $('impAvvisi'); if (!sw) return;
        const o = DC.opzioniProm(), concesse = await notificheConcesse();
        sw.setAttribute('aria-checked', String(o.attivo));
        document.querySelectorAll('#avvisiAnticipo [data-anticipo]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.anticipo) === o.anticipo)));
        document.querySelectorAll('#avvisiOra [data-ora]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.ora) === o.ora)));
        const bloccate = !concesse && (o.attivo || o.chiesto);
        $('avvisiApri').classList.toggle('hidden', !bloccate);
        $('avvisiStato').textContent = bloccate ? 'Android sta bloccando le notifiche di DoctorCar: senza, gli avvisi non arrivano.'
          : !o.attivo ? 'Gli avvisi sono spenti.'
          : statoProm.errore ? 'Avvisi non programmati: ' + statoProm.errore
          : statoProm.programmati > 0 ? 'In programma ' + statoProm.programmati + (statoProm.programmati === 1 ? ' avviso' : ' avvisi') + ' (si aggiornano da soli).'
          : statoProm.programmati === 0 ? 'Nessun avviso in programma: le tue scadenze non sono ancora vicine.' : '';
      }
      window.disegnaAvvisi = disegnaAvvisi;
      async function alternaAvvisi() {
        const o = DC.opzioniProm();
        if (o.attivo) { DC.impostaProm({ attivo: false }); await nat('annullaPromemoria').catch(() => {}); statoProm.programmati = -1; disegnaAvvisi(); return; }
        await attivaAvvisi();
      }
      async function impostaAvvisi(cosa, valore) {
        DC.impostaProm(cosa === 'ora' ? { ora: Number(valore) } : { anticipo: Number(valore) });
        disegnaAvvisi();
        await riprogrammaPromemoria();
      }
      async function apriNotificheAndroid() { try { await nat('apriImpostazioniNotifiche'); } catch (_) { } }
      Object.assign(DC.COMANDI, { alternaAvvisi, impostaAvvisi, apriNotificheAndroid });
      window.addEventListener('dati-cambiati', () => { pianificaProm(2500); setTimeout(() => chiediAvvisiSeServe(0), 2500); });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pianificaProm(1500); });
      setTimeout(() => { riprogrammaPromemoria(); chiediAvvisiSeServe(0); }, 2500);
      window.__riprogrammaPromemoria = riprogrammaPromemoria;   // per le prove
      // la sosta a tempo ha bisogno delle notifiche: se sono spente si chiede (una volta per sosta)
      window.__attivaAvvisiSeSpenti = async () => {
        if (DC.opzioniProm().attivo) { await riprogrammaPromemoria(); return true; }
        const r = await DC.domanda({ titolo: 'Avvisi', testo: 'Per avvisarti della sosta servono le notifiche di DoctorCar. Le attivo?', si: 'Attiva', no: 'No' });
        return r.esito === 'si' ? attivaAvvisi() : false;
      };


      // ======================================================================
      // Aggiornamenti da GitHub: una volta a settimana (si può spegnere) o con «Controlla adesso».
      // La rete la usa solo la parte nativa; qui si decide quando chiedere e cosa mostrare.
      // ======================================================================
      const K_AGG = 'doctorcar_aggiornamenti', SETTIMANA = 7 * 864e5;
      const optAgg = () => { let o = null; try { o = JSON.parse(S.getItem(K_AGG)); } catch (_) { } o = o && typeof o === 'object' ? o : {}; return { attivo: o.attivo !== false, ultimo: Number(o.ultimo) || 0, rimandata: String(o.rimandata || '').slice(0, 20), errore: String(o.errore || '').slice(0, 200) }; };
      const salvaAgg = x => { try { S.setItem(K_AGG, JSON.stringify(Object.assign(optAgg(), x))); } catch (_) { } };
      const statoAgg = { trovata: null, inCorso: false, percento: -1 };
      const mb = n => (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
      function quandoAgg(ts) {
        if (!ts) return 'mai';
        const g = Math.floor((Date.now() - ts) / 864e5);
        return g <= 0 ? 'oggi' : g === 1 ? 'ieri' : g + ' giorni fa';
      }
      function disegnaAggiornamenti() {
        const sw = $('impAggiornamenti'); if (!sw) return;
        const o = optAgg(), t = statoAgg.trovata;
        sw.setAttribute('aria-checked', String(o.attivo));
        $('aggInstalla').classList.toggle('hidden', !t || statoAgg.inCorso);
        $('aggControlla').disabled = statoAgg.inCorso;
        $('aggStato').textContent = statoAgg.inCorso ? (statoAgg.percento >= 0 ? 'Scarico l\'aggiornamento… ' + statoAgg.percento + '%' : 'Controllo…')
          : t ? 'È uscita DoctorCar ' + t.versione + ' (' + mb(t.dimensione) + ').' + (t.novita ? '\nNovità: ' + t.novita : '')
          : o.errore ? 'Ultimo controllo ' + quandoAgg(o.ultimo) + ': ' + o.errore
          : 'Hai l\'ultima versione. Ultimo controllo: ' + quandoAgg(o.ultimo) + '.' + (o.attivo ? '' : ' Il controllo settimanale è spento.');
      }
      window.disegnaAggiornamenti = disegnaAggiornamenti;
      // chiede a GitHub; «aMano»: dal tasto (dice sempre com'è andata)
      async function controllaAggiornamenti(aMano) {
        if (statoAgg.inCorso) return;
        statoAgg.inCorso = true; statoAgg.percento = -1; disegnaAggiornamenti();
        let r = null;
        try { r = await nat('controllaAggiornamento'); salvaAgg({ ultimo: Date.now(), errore: '' }); }
        catch (e) { salvaAgg({ ultimo: Date.now(), errore: String((e && e.message) || 'controllo non riuscito').slice(0, 200) }); }
        statoAgg.inCorso = false;
        statoAgg.trovata = r && r.nuova ? { versione: String(r.versione || '').slice(0, 20), novita: String(r.novita || '').slice(0, 1500), dimensione: Number(r.dimensione) || 0 } : null;
        disegnaAggiornamenti();
        if (aMano === true) {
          if (!r) DC.avviso(optAgg().errore || 'Controllo non riuscito.', 'errore');
          else if (!statoAgg.trovata) DC.avviso('Hai già l\'ultima versione.', 'ok');
        }
        return statoAgg.trovata;
      }
      async function installaAggiornamento() {
        if (!statoAgg.trovata || statoAgg.inCorso) return;
        statoAgg.inCorso = true; statoAgg.percento = 0; disegnaAggiornamenti();
        DC.attesa('Aggiornamento', 'Scarico DoctorCar ' + statoAgg.trovata.versione + '…');
        try {
          const r = await nat('scaricaAggiornamento');
          DC.chiudiAttesa();
          if (r && r.permesso === false) DC.avviso('Senza il permesso di installare app, DoctorCar non può aggiornarsi da solo. Puoi riprovare quando vuoi.', 'errore');
        } catch (e) {
          DC.chiudiAttesa();
          DC.avviso((e && e.message) || 'Aggiornamento non riuscito.', 'errore');
        } finally { statoAgg.inCorso = false; statoAgg.percento = -1; disegnaAggiornamenti(); }
      }
      try { CAP.addListener('DoctorCar', 'aggiornamento', x => { statoAgg.percento = Math.max(0, Math.min(100, Number(x && x.percento) || 0)); const t = $('attesaTesto'); if (t && statoAgg.trovata) t.textContent = 'Scarico DoctorCar ' + statoAgg.trovata.versione + '… ' + statoAgg.percento + '%'; disegnaAggiornamenti(); }); } catch (_) { }
      function alternaAggiornamenti() { const o = optAgg(); salvaAgg({ attivo: !o.attivo }); disegnaAggiornamenti(); }
      // controllo settimanale: all'apertura (e al ritorno nell'app) se è passata una settimana; con «Più tardi» si richiede la settimana dopo
      let chiedendoAgg = false;
      async function controlloSettimanale(tentativo) {
        const o = optAgg();
        if (!o.attivo || chiedendoAgg || statoAgg.inCorso || Date.now() - o.ultimo < SETTIMANA) return;
        if (document.querySelector('.finestra:not(.hidden)')) { if ((tentativo || 0) < 15) setTimeout(() => controlloSettimanale((tentativo || 0) + 1), 4000); return; }
        const t = await controllaAggiornamenti(false);
        if (!t || document.querySelector('.finestra:not(.hidden)')) return;
        chiedendoAgg = true;
        try {
          const r = await DC.domanda({ titolo: 'È uscita DoctorCar ' + t.versione, testo: (t.novita ? 'Novità: ' + t.novita + '\n\n' : '') + 'I tuoi dati restano tutti. Android ti chiederà la conferma.', si: 'Aggiorna', no: 'Più tardi' });
          if (r.esito === 'si') await installaAggiornamento(); else salvaAgg({ rimandata: t.versione });
        } finally { chiedendoAgg = false; }
      }
      Object.assign(DC.COMANDI, { controllaAggiornamenti: () => controllaAggiornamenti(true), installaAggiornamento, alternaAggiornamenti });
      setTimeout(() => controlloSettimanale(0), 8000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(() => controlloSettimanale(0), 3000); });
      window.__aggiornamenti = { controlloSettimanale, optAgg, statoAgg };   // per le prove


      // ---------- Fotocamera dell'app (CameraX): «Scatta foto» apre la nostra, non quella del telefono ----------
      // Le foto arrivano alla stessa funzione di prima, come se le avesse scelte la finestra dei file.
      document.addEventListener('click', e => {
        const input = e.target && e.target.closest && e.target.closest('input[type=file][capture]');
        if (!input) return;
        e.preventDefault(); e.stopImmediatePropagation();
        scattaConFotocamera();
      }, true);
      let fotocameraAperta = false;
      async function scattaConFotocamera() {
        if (fotocameraAperta) return;
        fotocameraAperta = true;
        let r;
        try { r = await nat('scattaFoto', { massimo: 12 }); }
        catch (err) {
          DC.avviso(err && err.code === 'PERMESSO'
            ? 'Per scattare serve il permesso «Fotocamera»: concedilo nelle impostazioni di Android (App → DoctorCar → Autorizzazioni).'
            : 'Fotocamera non disponibile: ' + ((err && err.message) || err), 'errore');
          return;
        } finally { fotocameraAperta = false; }
        if (!r || r.annullato || !Array.isArray(r.foto) || !r.foto.length) return;
        const files = r.foto.map(f => new File([byte(f.dati)], f.nome, { type: 'image/jpeg', lastModified: Date.now() }));
        DC.COMANDI.aggiungiFoto({ type: 'change', target: { files, value: '' } });
      }

      // ======================================================================
      // SCORCIATOIE, WIDGET, NOTIFICHE CON I TASTI, PDF, CALENDARIO
      // ======================================================================
      window.__creaPdf = async (nome, html) => byte((await nat('creaPdf', { nome, html: DC.trHtml(html) })).dati);
      window.__condividi = o => nat('condividiFile', o.testo != null ? { testo: DC.Lrighe(o.testo), titolo: DC.L(o.titolo || '') } : Object.assign({}, o, o.titolo ? { titolo: DC.L(o.titolo) } : {}));
      window.__aggiungiAlCalendario = (titolo, data, nota) => nat('aggiungiAlCalendario', { titolo, data, nota });
      window.__posizione = opz => nat('posizione', opz || {});
      // durante l'affinamento Android manda ogni lettura migliore: la pagina la mostra subito
      try { CAP.addListener('DoctorCar', 'posizione', x => { if (typeof window.__posizioneMigliore === 'function') window.__posizioneMigliore(x); }); } catch (_) {}
      window.__apriMappa = (lat, lon) => nat('apriMappa', { lat, lon });
      window.__apriLink = url => nat('apriLink', { url });
      // barra di stato e barra in basso: stesso colore della parte alta della pagina, icone scure sul chiaro e chiare sul
      // tema scuro (uguale in DoctorCar, DoctorWood e BothWise); si rifà dopo il cambio di tema e al ritorno nell'app
      const coloreInAlto = () => {
        for (let el = document.elementFromPoint(innerWidth / 2, 2); el; el = el.parentElement) {
          const m = (getComputedStyle(el).backgroundColor || '').match(/[\d.]+/g);
          if (m && m.length >= 3 && !(m.length >= 4 && Number(m[3]) < 0.9)) return '#' + m.slice(0, 3).map(x => Math.round(+x).toString(16).padStart(2, '0')).join('');
        }
        return '';
      };
      const coloreBarre = () => {
        const chiaro = document.documentElement.getAttribute('data-tema') === 'chiaro';
        requestAnimationFrame(() => { nat('barre', { chiaro, colore: coloreInAlto() }).catch(() => {}); });
      };
      coloreBarre(); [400, 1500, 4000].forEach(ms => setTimeout(coloreBarre, ms));
      new MutationObserver(coloreBarre).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') coloreBarre(); });
      window.__attivaPosizione = () => nat('attivaPosizione');
      window.__email = (a, oggetto, testo) => nat('email', { a, oggetto, testo });
      window.__impostazioniApp = () => nat('impostazioniApp');
      window.__indirizzo = async (lat, lon) => String((await nat('indirizzo', { lat, lon })).testo || '');
      // cose fatte dalle notifiche con l'app chiusa: si applicano appena la pagina è pronta e a ogni ritorno
      async function applicaCoda() {
        try { const r = await nat('azioniInCoda'); if (r && Array.isArray(r.azioni) && r.azioni.length) DC.applicaAzioni(r.azioni); } catch (_) { }
      }
      // scorciatoia dell'icona o del widget (anche ad app già aperta)
      async function applicaScorciatoia() {
        try { const r = await nat('scorciatoia'); if (r && r.cosa) await DC.apriScorciatoia(r.cosa); } catch (_) { }
      }
      window.__scorciatoia = applicaScorciatoia;
      let timerWidget = 0;
      const widgetInLingua = w => !DC.inglese() ? w : Object.assign({}, w, { riga1: DC.L(w.riga1 || ''), riga2: DC.L(w.riga2 || ''), intest: DC.L(w.intest || ''), righe: (w.righe || []).map(r => Object.assign({}, r, { t: DC.L(r.t || ''), d: DC.L(r.d || '') })) });
      // la parte Android (notifiche, widget, fotocamera) parla la stessa lingua della pagina
      try { nat('lingua', { inglese: !!DC.inglese() }).catch(() => {}); } catch (_) { }
      // lingua cambiata nelle Impostazioni: notifiche, widget e fotocamera la seguono subito
      window.addEventListener('lingua-cambiata', () => { try { nat('lingua', { inglese: !!DC.inglese() }).catch(() => {}); } catch (_) { } aggiornaWidget(); try { window.__riprogrammaPromemoria && window.__riprogrammaPromemoria(); } catch (_) { } });
      function aggiornaWidget() { clearTimeout(timerWidget); timerWidget = setTimeout(() => { try { nat('aggiornaWidget', widgetInLingua(DC.testoWidget())).catch(() => {}); } catch (_) { } }, 1500); }
      window.addEventListener('dati-cambiati', aggiornaWidget);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { applicaCoda(); aggiornaWidget(); } });
      window.__applicaCoda = applicaCoda;   // per le prove
      setTimeout(async () => { await applicaCoda(); await applicaScorciatoia(); aggiornaWidget(); }, 1200);

      // ======================================================================
      // COPIA AUTOMATICA IN UNA CARTELLA (ogni 7 giorni, cifrata, con la password scelta una volta sola)
      // La password sta nel Keystore di Android; la cartella è una a scelta (anche su Drive o su una scheda).
      // ======================================================================
      const K_AUTO = 'doctorcar_autocopia';
      const leggiAuto = () => leggiJ(K_AUTO, {}) || {};
      let inCopia = false;
      async function nomeCartella() { try { return String((await nat('cartellaCopie')).nome || ''); } catch (_) { return ''; } }
      async function disegnaAutoCopia() {
        const el = $('autoCopiaStato'); if (!el) return;
        const a = leggiAuto(), cartella = a.attiva ? await nomeCartella() : '';
        const attiva = !!(a.attiva && a.pw && cartella);
        $('autoCopiaSpegni').classList.toggle('hidden', !a.attiva);
        $('autoCopiaOra').classList.toggle('hidden', !attiva);
        $('autoCopiaScegli').lastChild.textContent = attiva ? 'Cambia cartella' : 'Scegli la cartella';
        el.textContent = attiva ? 'Attiva: una copia cifrata ogni settimana in «' + cartella + '»' + (a.ultima ? ' (ultima il ' + new Date(a.ultima).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) + ')' : '') + '. Tiene le ultime 5.'
          : a.attiva ? 'La cartella non è più raggiungibile: sceglila di nuovo.'
          : 'Spenta. DoctorCar può salvare da sé una copia cifrata ogni settimana in una cartella che scegli (anche su Drive).';
      }
      window.disegnaAutoCopia = disegnaAutoCopia;
      async function eseguiAutoCopia(manuale) {
        const a = leggiAuto();
        if (inCopia || !a.attiva || !a.pw) return false;
        if (!manuale && a.ultima && Date.now() - a.ultima < 7 * 86400000) return false;
        if (!DC.veicoli().length) return false;
        inCopia = true;
        try {
          const password = daTesto.decode(byte((await nat('riprendi', a.pw)).dati));
          let foto = {};
          try { foto = await DC.fotoPerCopia(); } catch (_) { }
          if (Object.values(foto).reduce((t, x) => t + x.length, 0) / 1e6 > DC.COPIA_MAX_MB) foto = {};
          const busta = await DC.cifraCopia(password, foto);
          await nat('scriviInCartella', { nome: 'DoctorCar-copia-' + new Date().toISOString().slice(0, 10) + '.dccopia', dati: b64(testo.encode(busta)) });
          scriviJ(K_AUTO, Object.assign(a, { ultima: Date.now(), errore: '' }));
          try { S.setItem('doctorcar_ultima_copia', String(Date.now())); } catch (_) { }
          if (manuale) DC.avviso('Copia salvata nella cartella.', 'ok');
          disegnaAutoCopia();
          return true;
        } catch (e) {
          scriviJ(K_AUTO, Object.assign(a, { errore: String((e && e.message) || e).slice(0, 120) }));
          if (manuale) DC.avviso('Copia non riuscita: ' + ((e && e.message) || e), 'errore');
          return false;
        } finally { inCopia = false; }
      }
      async function autoCopiaScegli() {
        if (!(await DC.confermaIdentita('Conferma per attivare la copia automatica'))) return;
        const gia = leggiAuto();
        let password = '';
        if (!(gia.attiva && gia.pw)) {
          let errore = '';
          for (;;) {
            const r = await DC.domanda({ titolo: 'Copia automatica', testo: 'La copia è cifrata con una password tua. La scrivi una volta sola: DoctorCar la custodisce nel telefono e la copia parte da sola. Per riaprire la copia ti servirà questa password: non perderla.', si: 'Avanti', errore,
              campi: [{ etichetta: 'Password (almeno 12 caratteri)', tipo: 'password' }, { etichetta: 'Ripeti la password', tipo: 'password' }] });
            if (r.esito !== 'si') return;
            const [p1, p2] = r.valori;
            errore = DC.problemaPassword(p1) || (p1 !== p2 ? 'Le due password non sono uguali.' : '');
            if (!errore) { password = p1; break; }
          }
        }
        let nome;
        try { nome = String((await nat('scegliCartella')).nome || ''); } catch (e) { if (!e || e.code !== 'ANNULLATO') DC.avviso('Cartella non scelta.', 'errore'); return; }
        const nuovo = Object.assign({}, gia, { attiva: true });
        if (password) nuovo.pw = await nat('custodisci', { dati: b64(testo.encode(password)) });
        scriviJ(K_AUTO, nuovo);
        await disegnaAutoCopia();
        const ok = await eseguiAutoCopia(true);
        if (!ok) DC.avviso('Cartella scelta, ma la prima copia non è riuscita.', 'errore');
      }
      async function autoCopiaOra() { await eseguiAutoCopia(true); }
      async function autoCopiaSpegni() {
        if (!(await DC.chiedi('Spegnere la copia automatica? Le copie già nella cartella restano lì.', 'Spegni', 'Copia automatica'))) return;
        try { await nat('dimenticaCartella'); } catch (_) { }
        scriviJ(K_AUTO, {});
        disegnaAutoCopia();
      }
      Object.assign(DC.COMANDI, { autoCopiaScegli, autoCopiaOra, autoCopiaSpegni });
      window.addEventListener('dati-cambiati', () => setTimeout(() => eseguiAutoCopia(false), 6000));
      setTimeout(() => eseguiAutoCopia(false), 9000);
      window.__eseguiAutoCopia = eseguiAutoCopia;   // per le prove
    })();
