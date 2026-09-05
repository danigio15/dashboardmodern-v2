/* L'analisi di ogni sezione dice la cosa vera.
 *
 * I casi qui sotto non sono inventati: sono le schermate arrivate dalla casa
 * vera, coi loro numeri. L'Energia con il fotovoltaico a 2,16 kW e la casa a
 * 574 W scriveva «4 cose, nessuna in funzione», e non perche' contasse male:
 * perche' quella frase veniva da un ripiego che sa contare solo cose accese e
 * spente, e le quattro righe dell'Energia sono casa, solare, rete e batteria.
 * La Sicurezza, con l'antifurto elencato nella finestra, scriveva «Qui non
 * c'e' ancora niente», perche' il suo antifurto non e' una riga.
 *
 * Una frase sbagliata non rompe niente e a occhio non si vede: si legge, sembra
 * una frase, e dice il contrario. L'unico modo di accorgersene e' pretendere il
 * testo a partire da numeri noti, ed e' quello che si fa qui.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { analisiDellaSezione, SEZIONI_LETTE } from "../src/core/analisi-sezione.js";
import { VERDETTI } from "../src/core/racconto-tessera.js";

const IT = (italiano) => italiano;
const EN = (_italiano, inglese) => inglese;

test("Energia: col sole che avanza non dice «nessuna in funzione»", () => {
  /* I numeri della schermata: casa 574 W, solare 2,16 kW, rete 41 W,
   * batteria -1,47 kW (il segno meno vuol dire che si sta caricando). */
  const esito = analisiDellaSezione(
    {
      key: "energia",
      today: 2,
      rows: [
        { group: "house", watts: 574 },
        { group: "solar", watts: 2160 },
        { group: "grid", watts: 41 },
        { group: "battery", watts: -1470 },
      ],
    },
    IT,
  );
  assert.ok(esito, "l'Energia deve avere una sua lettura");
  assert.doesNotMatch(esito.frase, /nessuna in funzione/i);
  assert.match(esito.frase, /2,16 kW/, "deve dire quanto fa il sole");
  assert.match(esito.frase, /574 W/, "deve dire quanto usa la casa");
  assert.ok(
    esito.punti.some((p) => /si carica a 1,47 kW/.test(p)),
    `il segno della batteria va detto a parole, non lasciato al meno: ${JSON.stringify(esito.punti)}`,
  );
  assert.ok(
    esito.punti.some((p) => /2,0 kWh/.test(p)),
    "l'energia di oggi e' un punto, non si perde",
  );
});

test("Energia: quando il sole non basta dice quanto ne copre", () => {
  const esito = analisiDellaSezione(
    {
      key: "energia",
      rows: [
        { group: "house", watts: 2000 },
        { group: "solar", watts: 500 },
        { group: "grid", watts: 1500 },
      ],
    },
    IT,
  );
  assert.match(esito.frase, /25%/, "500 su 2000 e' un quarto");
  assert.ok(esito.punti.some((p) => /Dalla rete arrivano 1,50 kW/.test(p)));
});

test("Energia: di notte non parla di sole", () => {
  const esito = analisiDellaSezione(
    {
      key: "energia",
      rows: [
        { group: "house", watts: 300 },
        { group: "solar", watts: 0 },
        { group: "grid", watts: 300 },
      ],
    },
    IT,
  );
  assert.match(esito.frase, /senza sole/);
  assert.doesNotMatch(esito.frase, /copre/);
});

test("Sicurezza: con l'antifurto non dice che non c'e' niente", () => {
  const esito = analisiDellaSezione(
    {
      key: "sicurezza",
      alarm: true,
      armed: false,
      triggered: false,
      doors: [{ name: "Portoncino" }, { name: "Garage" }],
    },
    IT,
  );
  assert.doesNotMatch(esito.frase, /non c'e' ancora niente/i);
  assert.match(esito.frase, /disinserito/i);
  assert.ok(esito.punti.some((p) => /2 ingressi sorvegliati/.test(p)));
});

test("Sicurezza: quando suona il tono e' rosso", () => {
  const esito = analisiDellaSezione(
    { key: "sicurezza", alarm: true, armed: true, triggered: true, doors: [] },
    IT,
  );
  assert.equal(esito.tono, VERDETTI.guarda);
  assert.match(esito.frase, /suonando/);
});

test("Temperatura: dice la differenza, non solo la media", () => {
  const esito = analisiDellaSezione(
    {
      key: "temperatura",
      rows: [
        { name: "Salone", temperature: 27.1, humidity: 48 },
        { name: "Cucina", temperature: 24.4, humidity: 52 },
        { name: "Garage", temperature: 21.8, humidity: 60 },
      ],
    },
    IT,
  );
  assert.match(esito.frase, /Salone/, "la piu' calda si nomina");
  assert.match(esito.frase, /5,3°/, "27,1 meno 21,8");
  assert.match(esito.frase, /3 stanze/);
  assert.ok(
    esito.punti.some((p) => /Garage/.test(p)),
    "la piu' fredda sta nei punti",
  );
});

test("Temperatura: con una stanza sola non parla di differenze", () => {
  const esito = analisiDellaSezione(
    { key: "temperatura", rows: [{ name: "Salone", temperature: 22 }] },
    IT,
  );
  assert.match(esito.frase, /Salone e' a 22,0°/);
  assert.doesNotMatch(esito.frase, /fra la piu'/);
});

test("Elettrodomestici: nomina quelli accesi e somma i watt", () => {
  const esito = analisiDellaSezione(
    {
      key: "elettrodomestici",
      rows: [
        { name: "Lavatrice", mode: "running", watts: 1200 },
        { name: "Lavastoviglie", mode: "running", watts: 800 },
        { name: "Forno", mode: "off", watts: 0 },
      ],
    },
    IT,
  );
  assert.equal(esito.tono, VERDETTI.corso);
  assert.match(esito.frase, /Lavatrice e Lavastoviglie/);
  assert.match(esito.frase, /su 3/);
  assert.ok(esito.punti.some((p) => /2,00 kW/.test(p)));
});

test("Piscina: il pH fuori norma vince sulla temperatura", () => {
  const esito = analisiDellaSezione(
    {
      key: "piscina",
      rows: [
        { name: "Acqua", raw: 27.5 },
        { name: "pH", raw: 8.1 },
      ],
    },
    IT,
  );
  assert.equal(esito.tono, VERDETTI.guarda);
  assert.match(esito.frase, /pH e' fuori norma/);
  assert.match(esito.frase, /27,5°/);
});

test("Auto: sotto il venti per cento e staccata, e' da guardare", () => {
  const esito = analisiDellaSezione({ key: "ev", ring: 12, attiva: false, rows: [] }, IT);
  assert.equal(esito.tono, VERDETTI.guarda);
  assert.match(esito.frase, /12%/);
});

/* ── l'auto a benzina non si attacca alla presa (#326) ─────────────────── */

test("Auto a benzina: si parla di serbatoio, non di spina", () => {
  /* «Aprendo la scheda auto viene mostrata la percentuale del carburante con
   * l'indicazione "E' al xx% e non e' attaccata".» Il numero in copertina e'
   * il serbatoio — la tessera lo dice riga per riga — e di un pieno di
   * benzina non si dice che non e' attaccato alla colonnina. */
  const esito = analisiDellaSezione(
    { key: "ev", ring: 62, attiva: false, rows: [{ carburante: true, km: 480 }] },
    IT,
  );
  assert.equal(esito.tono, VERDETTI.bene);
  assert.match(esito.frase, /serbatoio/i);
  assert.match(esito.frase, /62%/);
  assert.doesNotMatch(esito.frase, /attaccat|carica/i);
  /* L'autonomia resta: vale per tutte e due le alimentazioni. */
  assert.ok(esito.punti.some((punto) => /480/.test(punto)));
});

test("Auto a benzina in riserva: e' da guardare, e dice di fare rifornimento", () => {
  const esito = analisiDellaSezione(
    { key: "ev", ring: 8, attiva: false, rows: [{ carburante: true }] },
    IT,
  );
  assert.equal(esito.tono, VERDETTI.guarda);
  assert.match(esito.frase, /8%/);
  assert.match(esito.frase, /rifornimento/i);
});

test("Auto a benzina: «attiva» non la mette in carica", () => {
  /* La tessera puo' avere `attiva` acceso per altri motivi. Su un serbatoio
   * «in carica» resta una bugia, quindi non si dice. */
  const esito = analisiDellaSezione(
    { key: "ev", ring: 70, attiva: true, rows: [{ carburante: true }] },
    IT,
  );
  assert.doesNotMatch(esito.frase, /carica/i);
  assert.match(esito.frase, /serbatoio/i);
});

test("Garage misto: con un'elettrica in mezzo la spina torna a voler dire qualcosa", () => {
  /* La distinzione vale solo se TUTTE le auto vanno a carburante: la piu'
   * scarica puo' essere l'elettrica, e li' «attaccata» e' l'informazione
   * giusta. */
  const esito = analisiDellaSezione(
    {
      key: "ev",
      ring: 15,
      attiva: false,
      quante: 2,
      rows: [{ carburante: true }, { carburante: false }],
    },
    IT,
  );
  assert.match(esito.frase, /attaccat/i);
  assert.doesNotMatch(esito.frase, /serbatoio/i);
});

test("Auto elettrica: la frase di sempre non cambia", () => {
  const esito = analisiDellaSezione(
    { key: "ev", ring: 12, attiva: false, rows: [{ carburante: false }] },
    IT,
  );
  assert.equal(esito.tono, VERDETTI.guarda);
  assert.match(esito.frase, /12% e non e' attaccata/);
});

test("Irrigazione: dice quale zona sta bagnando", () => {
  const esito = analisiDellaSezione(
    {
      key: "irrigazione",
      rows: [
        { name: "Prato", on: true },
        { name: "Siepe", on: false },
      ],
    },
    IT,
  );
  assert.equal(esito.tono, VERDETTI.corso);
  assert.match(esito.frase, /Prato sta bagnando/);
  assert.match(esito.frase, /2 zone/);
});

test("Solare termico: dice il salto fra le sonde", () => {
  const esito = analisiDellaSezione(
    {
      key: "solare",
      attiva: true,
      rows: [
        { name: "Pannello", temperature: 68 },
        { name: "Accumulo", temperature: 44 },
      ],
    },
    IT,
  );
  assert.equal(esito.tono, VERDETTI.corso);
  assert.match(esito.frase, /24,0°/);
});

test("chi non ha una lettura riceve niente, non una frase sbagliata", () => {
  assert.equal(analisiDellaSezione({ key: "sezione-che-non-esiste", rows: [] }, IT), null);
});

test("ogni lettura risponde anche in inglese, e con un'altra frase", () => {
  const casi = {
    energia: {
      rows: [
        { group: "house", watts: 500 },
        { group: "solar", watts: 900 },
      ],
    },
    solare: {
      attiva: false,
      rows: [
        { name: "P", temperature: 30 },
        { name: "A", temperature: 20 },
      ],
    },
    sicurezza: { alarm: true, armed: true, doors: [{ name: "X" }] },
    temperatura: {
      rows: [
        { name: "A", temperature: 20 },
        { name: "B", temperature: 24 },
      ],
    },
    elettrodomestici: { rows: [{ name: "A", mode: "running", watts: 100 }] },
    telecamere: { rows: [{ name: "Ingresso" }] },
    ev: { ring: 80, attiva: true, rows: [] },
    robot: { rows: [{ name: "Robi", cleaning: true }] },
    piscina: { rows: [{ name: "Acqua", raw: 26 }] },
    irrigazione: { rows: [{ name: "Prato", on: true }] },
    media: {
      lettori: [{ nome: "Salotto", suona: true, titolo: "So What", artista: "Miles Davis" }],
    },
  };
  for (const chiave of SEZIONI_LETTE) {
    const tessera = { key: chiave, ...(casi[chiave] || { rows: [] }) };
    const italiano = analisiDellaSezione(tessera, IT);
    const inglese = analisiDellaSezione(tessera, EN);
    assert.ok(italiano?.frase, `${chiave}: manca la frase italiana`);
    assert.ok(inglese?.frase, `${chiave}: manca la frase inglese`);
    assert.notEqual(
      italiano.frase,
      inglese.frase,
      `${chiave}: la frase inglese e' identica all'italiana, quindi non e' tradotta`,
    );
  }
});

test("le sezioni senza lettura propria sono solo quelle che ne hanno gia' una", () => {
  /* Le sette che restano fuori — luci, clima, tapparelle, aperture, batterie,
   * allagamenti, todo — la loro frase ce l'hanno gia' in racconto-tessera.js,
   * e li' e' giusta: sono tutte fatte di cose che si accendono e si spengono.
   * Questa prova esiste perche' se domani nasce una sezione nuova, e nessuno
   * le scrive la lettura, non finisca a caso nel ripiego generico. */
  const conFraseAltrove = [
    "luci",
    "clima",
    "tapparelle",
    "aperture",
    "batterie",
    "allagamenti",
    "todo",
  ];
  const tutte = [...SEZIONI_LETTE, ...conFraseAltrove].sort();
  assert.deepEqual(tutte, [
    "allagamenti",
    "aperture",
    "batterie",
    "clima",
    "elettrodomestici",
    "energia",
    "ev",
    "irrigazione",
    "luci",
    "media",
    "piscina",
    "robot",
    "sicurezza",
    "solare",
    "tapparelle",
    "telecamere",
    "temperatura",
    "todo",
  ]);
});

/* ── quello che il modello aggiunge ────────────────────────────────────── */

const ORA = 3600_000;
const MINUTO = 60_000;
const ADESSO = Date.parse("2026-08-29T20:00:00Z");

/** Letture regolari, una ogni `passo`, valore da `fai`. */
function storia(quanti, passo, fai, fine = ADESSO) {
  const fuori = [];
  for (let i = quanti - 1; i >= 0; i -= 1)
    fuori.push({ quando: fine - i * passo, valore: fai(quanti - 1 - i) });
  return fuori;
}

test("senza storia il motore dice quello che diceva prima", () => {
  const tessera = { key: "energia", rows: [{ group: "house", watts: 574 }] };
  const senza = analisiDellaSezione(tessera, IT, ADESSO);
  const conNiente = analisiDellaSezione(tessera, IT, ADESSO, null);
  assert.deepEqual(senza, conNiente);
  assert.ok(senza.frase, "la finestra sta in piedi anche senza storia");
});

test("il modello dice quando il consumo e' fuori dal solito", () => {
  /* Tre giorni di storia: a quest'ora la casa fa 300 W. Adesso ne fa 900. */
  const punti = [];
  for (let giorno = 0; giorno < 3; giorno += 1)
    for (let i = 0; i < 8; i += 1)
      punti.push({ quando: ADESSO - giorno * 24 * ORA - i * 5 * MINUTO, valore: 300 });
  punti.push({ quando: ADESSO, valore: 900 });

  const esito = analisiDellaSezione(
    { key: "energia", rows: [{ group: "house", watts: 900 }] },
    IT,
    ADESSO,
    punti,
  );
  assert.ok(
    esito.punti.some((p) => /Piu' alto del solito per quest'ora/.test(p)),
    `manca il confronto col solito: ${JSON.stringify(esito.punti)}`,
  );
  assert.ok(
    esito.punti.some((p) => /900 W/.test(p)),
    "dice quanto fa adesso",
  );
  assert.ok(
    esito.punti.some((p) => /300 W/.test(p)),
    "e quanto fa di solito",
  );
});

test("quando e' il solito non spreca una riga per dirlo", () => {
  const punti = storia(30, 5 * MINUTO, () => 300);
  const esito = analisiDellaSezione(
    { key: "energia", rows: [{ group: "house", watts: 300 }] },
    IT,
    ADESSO,
    punti,
  );
  assert.ok(
    !esito.punti.some((p) => /solito/.test(p)),
    "«e' nella norma» e' il caso di quasi sempre: dirlo e' una riga sprecata",
  );
});

test("un valore molto fuori dal solito diventa da guardare", () => {
  /* Nessuno sta «facendo» niente — nessuna riga accesa — eppure c'e'
   * qualcosa: e' il caso per cui il modello esiste. */
  const punti = storia(40, 3 * MINUTO, () => 200);
  punti.push({ quando: ADESSO, valore: 3000 });
  const esito = analisiDellaSezione(
    { key: "energia", rows: [{ group: "house", watts: 3000 }] },
    IT,
    ADESSO,
    punti,
  );
  assert.equal(esito.tono, VERDETTI.guarda);
});

test("il modello dice quando l'auto sara' carica", () => {
  // dal 50% in su, un punto percentuale ogni cinque minuti
  const punti = storia(13, 5 * MINUTO, (i) => 50 + i);
  const esito = analisiDellaSezione(
    { key: "ev", ring: 62, attiva: true, rows: [] },
    IT,
    ADESSO,
    punti,
  );
  assert.ok(
    esito.punti.some((p) => /Ci arriva/.test(p)),
    `deve dire quando finisce: ${JSON.stringify(esito.punti)}`,
  );
});

test("quando non sa dire l'arrivo dice almeno il passo", () => {
  // la temperatura sale, ma non c'e' un bersaglio a cui arrivare
  const punti = storia(19, 10 * MINUTO, (i) => 20 + i / 6);
  const esito = analisiDellaSezione(
    { key: "temperatura", rows: [{ name: "Salone", temperature: 23 }] },
    IT,
    ADESSO,
    punti,
  );
  assert.ok(
    esito.punti.some((p) => /Sale di 1,0° all'ora/.test(p)),
    `deve dire il passo: ${JSON.stringify(esito.punti)}`,
  );
});

test("sul rumore non annuncia nessuna salita", () => {
  const ballo = [0, 40, -35, 25, -20, 45, -50, 15, 30, -10, 20, -25, 35, -40, 10];
  const punti = storia(ballo.length, 5 * MINUTO, (i) => 500 + ballo[i]);
  const esito = analisiDellaSezione(
    { key: "energia", rows: [{ group: "house", watts: 510 }] },
    IT,
    ADESSO,
    punti,
  );
  assert.ok(
    !esito.punti.some((p) => /Sale|Scende/.test(p)),
    `una retta si traccia anche sul rumore, ma non si annuncia: ${JSON.stringify(esito.punti)}`,
  );
});

test("il modello non aggiunge mai piu' di due righe", () => {
  const punti = storia(13, 5 * MINUTO, (i) => 50 + i);
  const senza = analisiDellaSezione({ key: "ev", ring: 62, attiva: true, rows: [] }, IT, ADESSO);
  const con = analisiDellaSezione(
    { key: "ev", ring: 62, attiva: true, rows: [] },
    IT,
    ADESSO,
    punti,
  );
  assert.ok(
    con.punti.length - senza.punti.length <= 2,
    "scriverle tutte trasforma la finestra in un bollettino",
  );
});

/* ── gli undici rilievi della revisione, uno per uno ────────────────────── */

test("l'irrigazione che bagna non viene annunciata come ferma", () => {
  /* Le righe portavano solo il testo tradotto — «in funzione» / «ferma» — e la
   * lettura, che cerca un booleano, le trovava tutte ferme proprio mentre
   * l'acqua usciva. Adesso la riga porta anche il dato grezzo. */
  const conGrezzo = analisiDellaSezione(
    { key: "irrigazione", attiva: true, rows: [{ name: "Prato", on: true, value: "in funzione" }] },
    IT,
  );
  assert.equal(conGrezzo.tono, VERDETTI.corso);
  assert.match(conGrezzo.frase, /Prato sta bagnando/);

  /* E se il grezzo non c'e' — dati vecchi — si ricade sul conto della tessera
   * invece di dire il falso. */
  const senzaGrezzo = analisiDellaSezione(
    { key: "irrigazione", attiva: true, rows: [{ name: "Prato", value: "in funzione" }] },
    IT,
  );
  assert.equal(senzaGrezzo.tono, VERDETTI.corso);
  assert.doesNotMatch(senzaGrezzo.frase, /ferme/);
});

test("il robot che pulisce non viene annunciato come fermo", () => {
  const conGrezzo = analisiDellaSezione(
    { key: "robot", rows: [{ name: "Robi", cleaning: true, battery: 60 }] },
    IT,
  );
  assert.equal(conGrezzo.tono, VERDETTI.corso);

  const senzaGrezzo = analisiDellaSezione(
    { key: "robot", attiva: true, rows: [{ name: "Robi", value: "In pulizia · 60%" }] },
    IT,
  );
  assert.equal(senzaGrezzo.tono, VERDETTI.corso, "il conto della tessera fa da rete");
});

test("le sonde del solare si leggono dal valore grezzo, non dal testo", () => {
  /* «56.2°» attraverso Number fa NaN: l'analisi del salto fra le sonde non
   * usciva mai. La riga adesso porta `raw` accanto a `value`. */
  const esito = analisiDellaSezione(
    {
      key: "solare",
      attiva: true,
      rows: [
        { name: "Pannello", raw: 68, value: "68°" },
        { name: "Accumulo", raw: 44, value: "44°" },
      ],
    },
    IT,
  );
  assert.match(esito.frase, /24,0°/, "il salto si calcola sul grezzo");
});

test("un dato che manca non vale zero", () => {
  /* `Number(null)` fa zero, e uno zero e' una misura: una stanza senza sensore
   * di umidita' entrava nella media come 0%. */
  const esito = analisiDellaSezione(
    {
      key: "temperatura",
      rows: [
        { name: "A", temperature: 20, humidity: 50 },
        { name: "B", temperature: 22, humidity: null },
      ],
    },
    IT,
  );
  const umidita = esito.punti.find((p) => /Umidita/.test(p));
  assert.match(umidita, /50%/, "la media e' di una stanza sola, non 25%");
});

test("con piu' auto non si dice che la piu' scarica e' in carica", () => {
  /* `ring` e' la carica piu' bassa fra tutte, `attiva` dice che QUALCUNA e'
   * attaccata: messe insieme diventavano «quella al 10% e' in carica» mentre in
   * carica c'era l'altra, all'80%. */
  const esito = analisiDellaSezione(
    { key: "ev", ring: 10, attiva: true, quante: 2, rows: [{}, {}] },
    IT,
  );
  assert.doesNotMatch(esito.frase, /^In carica, al 10%/);
  assert.match(esito.frase, /la piu' scarica e' al 10%/);
});

test("la lingua dei numeri si passa, non si indovina", () => {
  /* Chiedendo a tr("it","en") chi fosse, il tedesco finiva su «en-US»: una
   * finestra tedesca mescolava un titolo «1,25 kW» con un'analisi «1.25 kW». */
  const tessera = { key: "energia", rows: [{ group: "house", watts: 1250 }] };
  const tedesco = (_it, en) => en;
  assert.match(analisiDellaSezione(tessera, tedesco, Date.now(), null, "de-DE").frase, /1,25 kW/);
  assert.match(analisiDellaSezione(tessera, tedesco, Date.now(), null, "en-US").frase, /1\.25 kW/);
});

/* ── le finestre dicono quando, e da quanto ────────────────────────────── */

test("mentre la batteria si carica, dice quando sara' piena", () => {
  /* «Tipo: fra tot tempo le batterie di casa sono cariche.» La sezione Energia
   * ha due soggetti: di solito la potenza della casa, ma mentre la batteria si
   * carica la domanda diventa un'altra, e il traguardo e' il pieno. */
  const carica = storia(13, 5 * MINUTO, (i) => 60 + i); // dal 60% in su
  const esito = analisiDellaSezione(
    {
      key: "energia",
      soggetto: "carica",
      rows: [
        { group: "house", watts: 246 },
        { group: "battery", watts: -900 },
      ],
    },
    IT,
    ADESSO,
    carica,
  );
  const arrivo = esito.punti.find((p) => /piena/.test(p));
  assert.ok(arrivo, `deve dire quando sara' piena: ${JSON.stringify(esito.punti)}`);
  assert.match(arrivo, /La batteria e' piena fra/);
});

test("la pompa del solare dice da quanto gira, non solo che gira", () => {
  /* «Piuttosto: la pompa e' attiva da tot tempo.» Che sia accesa lo dice gia'
   * il colore del cerchio; da quanto, no. */
  const esito = analisiDellaSezione(
    {
      key: "solare",
      attiva: true,
      rows: [
        { name: "Pannello", raw: 80.9, on: true, daQuando: ADESSO - 40 * MINUTO },
        { name: "Accumulo", raw: 72.9 },
      ],
    },
    IT,
    ADESSO,
  );
  assert.match(esito.frase, /La pompa gira da 40 minuti/);
  assert.match(esito.frase, /8,0°/, "e continua a dire il salto");
});

test("senza il momento di partenza non si inventa una durata", () => {
  const esito = analisiDellaSezione(
    {
      key: "solare",
      attiva: true,
      rows: [
        { name: "Pannello", raw: 80.9 },
        { name: "Accumulo", raw: 72.9 },
      ],
    },
    IT,
    ADESSO,
  );
  assert.match(esito.frase, /La pompa gira:/);
  assert.doesNotMatch(esito.frase, /da /);
});
