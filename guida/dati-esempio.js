// Dati d'esempio realistici per le schermate della guida (due auto di una famiglia, due anni di storia).
// Le date sono calcolate rispetto a oggi, così le scadenze risultano sempre «in arrivo», «in regola» o «scadute».
module.exports = function datiEsempio(oggi = new Date()) {
  const g = n => { const d = new Date(oggi); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const dev = 'a1b2c3d4e5f6'; let k = 0;
  const id = p => p + (++k).toString(36).padStart(4, '0');
  const r = (o) => Object.assign({ id: id('r'), mod: 1700000000000 + k, dev }, o);
  const veicoli = [
    r({ id: 'panda01', tipo: 'auto', nome: 'Panda', marca: 'Fiat', modello: 'Panda 1.2 Easy', targa: 'GA123BC', anno: 2019, alimentazione: 'benzina', immatricolazione: '2019-04-10' }),
    r({ id: 'golf01', tipo: 'auto', nome: 'Golf di Marco', marca: 'Volkswagen', modello: 'Golf 2.0 TDI', targa: 'FX456DE', anno: 2017, alimentazione: 'diesel', immatricolazione: '2017-09-22' }),
  ];
  const interventi = [], rifornimenti = [], letture = [];
  // Panda: ~11.000 km l'anno, pieni ogni ~3 settimane
  let km = 52000; const serie = [];
  for (let d = -700; d <= -3; d += 21) {
    const litri = Math.round((32 + 3 * Math.cos(d / 50)) * 100) / 100, prezzo = 1.78 + 0.07 * Math.sin(d / 90);
    km += Math.round(litri * (16.2 + 0.9 * Math.sin(d / 37) - (d > -330 && d < -300 ? 3.2 : 0)));   // un pieno con consumo anomalo
    serie.push([d, km]);
    rifornimenti.push(r({ veicolo: 'panda01', data: g(d), km, quantita: litri, costo: Math.round(litri * prezzo * 100) / 100, pieno: true, chi: d % 42 === 0 ? 'Marco' : 'Anna' }));
  }
  letture.push(r({ veicolo: 'panda01', data: g(-1), km: km + 140 }));
  // i km degli interventi seguono quelli dei rifornimenti (niente avvisi di «km più bassi di prima»)
  const interp = (ser, d) => { let a = ser[0], b = ser[ser.length - 1];
    for (const x of ser) { if (x[0] <= d) a = x; if (x[0] >= d) { b = x; break; } }
    if (d <= ser[0][0]) return ser[0][1] - Math.round((ser[0][0] - d) * 35);
    return b[0] === a[0] ? a[1] : Math.round(a[1] + (b[1] - a[1]) * (d - a[0]) / (b[0] - a[0])); };
  const kmP = d => interp(serie, d);
  interventi.push(
    r({ veicolo: 'panda01', data: g(-640), km: kmP(-640), voci: ['tagliando', 'olio', 'filtro_olio', 'filtro_abitacolo'], officina: 'Autofficina Rossi', costo: 185, descrizione: 'Tagliando annuale' }),
    r({ veicolo: 'panda01', data: g(-590), km: kmP(-590), voci: ['gomme_togli'], officina: 'Gommista Bianchi', costo: 30 }),
    r({ veicolo: 'panda01', data: g(-420), km: kmP(-420), voci: ['pastiglie', 'dischi'], officina: 'Autofficina Rossi', costo: 240 }),
    r({ veicolo: 'panda01', data: g(-390), km: kmP(-390), voci: ['revisione'], officina: 'Centro revisioni Lario', costo: 79 }),
    r({ veicolo: 'panda01', data: g(-280), km: kmP(-280), voci: ['tagliando', 'olio', 'filtro_olio', 'filtro_aria', 'candele'], officina: 'Autofficina Rossi', costo: 260, descrizione: 'Tagliando con candele' }),
    r({ veicolo: 'panda01', data: g(-230), km: kmP(-230), voci: ['gomme_togli'], officina: 'Gommista Bianchi', costo: 30 }),
    r({ veicolo: 'panda01', data: g(-150), km: kmP(-150), voci: ['batteria'], officina: 'Elettrauto Verdi', costo: 115 }),
    r({ veicolo: 'panda01', data: g(-25), km: kmP(-25), voci: ['gomme_monta'], officina: 'Gommista Bianchi', costo: 30 }),
    r({ veicolo: 'panda01', data: g(-8), km: kmP(-8), voci: ['lavaggio'], costo: 12 }),
  );
  let kmg = 128000; const serieG = [];
  for (let d = -330; d <= -6; d += 16) { const l = 44 + (d % 3); kmg += Math.round(l * (18.5 + 0.6 * Math.cos(d / 40))); serieG.push([d, kmg]); rifornimenti.push(r({ veicolo: 'golf01', data: g(d), km: kmg, quantita: l, costo: Math.round(l * 1.69 * 100) / 100, pieno: true, chi: 'Marco' })); }
  const kmG = d => interp(serieG, d);
  interventi.push(
    r({ veicolo: 'golf01', data: g(-500), km: kmG(-500), voci: ['tagliando', 'olio', 'filtro_olio', 'filtro_gasolio'], officina: 'Officina VW Como', costo: 320 }),
    r({ veicolo: 'golf01', data: g(-200), km: kmG(-200), voci: ['distribuzione'], officina: 'Officina VW Como', costo: 690, descrizione: 'Kit distribuzione e pompa acqua' }),
    r({ veicolo: 'golf01', data: g(-60), km: kmG(-60), voci: ['multa'], costo: 42, note: 'Divieto di sosta' }),
  );
  const scadenze = [
    r({ veicolo: 'panda01', voce: 'tagliando', nome: 'Tagliando', ogniKm: 15000, ogniMesi: 12, costo: 260 }),
    r({ veicolo: 'panda01', voce: 'revisione', nome: 'Revisione', ogniMesi: 24, primaMesi: 48, costo: 79 }),
    r({ veicolo: 'panda01', voce: 'bollo', nome: 'Bollo', ogniMesi: 12, prossimaData: g(12), costo: 171 }),
    r({ veicolo: 'panda01', voce: 'assicurazione', nome: 'Assicurazione', ogniMesi: 12, prossimaData: g(96), costo: 420 }),
    r({ veicolo: 'panda01', voce: 'distribuzione', nome: 'Cinghia distribuzione', ogniKm: 120000, ogniMesi: 72 }),
    r({ veicolo: 'golf01', voce: 'tagliando', nome: 'Tagliando', ogniKm: 30000, ogniMesi: 24, costo: 320 }),
    r({ veicolo: 'golf01', voce: 'revisione', nome: 'Revisione', ogniMesi: 24, primaMesi: 48, ultimaData: g(-735), costo: 79 }),
    r({ veicolo: 'golf01', voce: 'assicurazione', nome: 'Assicurazione', ogniMesi: 12, prossimaData: g(40), costo: 560 }),
    r({ veicolo: '_io', voce: 'patente', nome: 'Patente di Anna', ogniMesi: 120, prossimaData: g(210) }),
  ];
  const gomme = [
    r({ veicolo: 'panda01', tipo: 'invernali', misura: '175/65 R14', marca: 'Michelin Alpin', dot: '3821', stato: 'montate', montataData: g(-25), montataKm: kmP(-25), kmPrima: 18000 }),
    r({ veicolo: 'panda01', tipo: 'estive', misura: '175/65 R14', marca: 'Pirelli Cinturato', dot: '1222', stato: 'magazzino', kmPrima: 26000 }),
  ];
  const appunti = [
    r({ veicolo: 'panda01', testo: 'Rumore dalla ruota davanti a destra quando freno', data: g(-9), fatto: false }),
    r({ veicolo: 'panda01', testo: 'Spia dell\'airbag accesa ogni tanto', data: g(-3), fatto: false }),
  ];
  const scorte = [
    r({ veicolo: 'panda01', nome: 'Olio 5W-40', quantita: 1, unita: 'litri', minimo: 1, voce: 'olio', prezzo: 8.9, note: 'Scaffale in alto' }),
    r({ veicolo: 'panda01', nome: 'Lampadina H4', quantita: 2, unita: 'pezzi', prezzo: 6.5, note: 'Cassetto degli attrezzi' }),
    r({ veicolo: 'golf01', nome: 'Olio 5W-30 VW 507', quantita: 4, unita: 'litri', minimo: 1, voce: 'olio', prezzo: 11.5, note: 'Scaffale in alto' }),
    r({ veicolo: 'golf01', nome: 'Spazzole tergicristallo', quantita: 0, unita: 'coppie', voce: 'tergicristalli', prezzo: 24 }),
  ];
  const D = { veicoli, interventi, rifornimenti, scadenze, letture, gomme, appunti, scorte };
  return {
    doctorcar_dati: JSON.stringify(D), doctorcar_dispositivo: dev, doctorcar_primo: '1', doctorcar_chi: 'Anna',
    doctorcar_budget: '250', doctorcar_ultima_copia: String(oggi.getTime() - 5 * 86400000),
  };
};
