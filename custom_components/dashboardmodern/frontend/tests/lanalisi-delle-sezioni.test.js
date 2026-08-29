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
  const esito = analisiDellaSezione({
    key: "energia",
    today: 2,
    rows: [
      { group: "house", watts: 574 },
      { group: "solar", watts: 2160 },
      { group: "grid", watts: 41 },
      { group: "battery", watts: -1470 },
    ],
  }, IT);
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
  const esito = analisiDellaSezione({
    key: "energia",
    rows: [
      { group: "house", watts: 2000 },
      { group: "solar", watts: 500 },
      { group: "grid", watts: 1500 },
    ],
  }, IT);
  assert.match(esito.frase, /25%/, "500 su 2000 e' un quarto");
  assert.ok(esito.punti.some((p) => /Dalla rete arrivano 1,50 kW/.test(p)));
});

test("Energia: di notte non parla di sole", () => {
  const esito = analisiDellaSezione({
    key: "energia",
    rows: [
      { group: "house", watts: 300 },
      { group: "solar", watts: 0 },
      { group: "grid", watts: 300 },
    ],
  }, IT);
  assert.match(esito.frase, /senza sole/);
  assert.doesNotMatch(esito.frase, /copre/);
});

test("Sicurezza: con l'antifurto non dice che non c'e' niente", () => {
  const esito = analisiDellaSezione({
    key: "sicurezza",
    alarm: true,
    armed: false,
    triggered: false,
    doors: [{ name: "Portoncino" }, { name: "Garage" }],
  }, IT);
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
  const esito = analisiDellaSezione({
    key: "temperatura",
    rows: [
      { name: "Salone", temperature: 27.1, humidity: 48 },
      { name: "Cucina", temperature: 24.4, humidity: 52 },
      { name: "Garage", temperature: 21.8, humidity: 60 },
    ],
  }, IT);
  assert.match(esito.frase, /Salone/, "la piu' calda si nomina");
  assert.match(esito.frase, /5,3°/, "27,1 meno 21,8");
  assert.match(esito.frase, /3 stanze/);
  assert.ok(esito.punti.some((p) => /Garage/.test(p)), "la piu' fredda sta nei punti");
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
  const esito = analisiDellaSezione({
    key: "elettrodomestici",
    rows: [
      { name: "Lavatrice", mode: "running", watts: 1200 },
      { name: "Lavastoviglie", mode: "running", watts: 800 },
      { name: "Forno", mode: "off", watts: 0 },
    ],
  }, IT);
  assert.equal(esito.tono, VERDETTI.corso);
  assert.match(esito.frase, /Lavatrice e Lavastoviglie/);
  assert.match(esito.frase, /su 3/);
  assert.ok(esito.punti.some((p) => /2,00 kW/.test(p)));
});

test("Piscina: il pH fuori norma vince sulla temperatura", () => {
  const esito = analisiDellaSezione({
    key: "piscina",
    rows: [
      { name: "Acqua", raw: 27.5 },
      { name: "pH", raw: 8.1 },
    ],
  }, IT);
  assert.equal(esito.tono, VERDETTI.guarda);
  assert.match(esito.frase, /pH e' fuori norma/);
  assert.match(esito.frase, /27,5°/);
});

test("Auto: sotto il venti per cento e staccata, e' da guardare", () => {
  const esito = analisiDellaSezione({ key: "ev", ring: 12, attiva: false, rows: [] }, IT);
  assert.equal(esito.tono, VERDETTI.guarda);
  assert.match(esito.frase, /12%/);
});

test("Irrigazione: dice quale zona sta bagnando", () => {
  const esito = analisiDellaSezione({
    key: "irrigazione",
    rows: [{ name: "Prato", on: true }, { name: "Siepe", on: false }],
  }, IT);
  assert.equal(esito.tono, VERDETTI.corso);
  assert.match(esito.frase, /Prato sta bagnando/);
  assert.match(esito.frase, /2 zone/);
});

test("Solare termico: dice il salto fra le sonde", () => {
  const esito = analisiDellaSezione({
    key: "solare",
    attiva: true,
    rows: [
      { name: "Pannello", temperature: 68 },
      { name: "Accumulo", temperature: 44 },
    ],
  }, IT);
  assert.equal(esito.tono, VERDETTI.corso);
  assert.match(esito.frase, /24,0°/);
});

test("chi non ha una lettura riceve niente, non una frase sbagliata", () => {
  assert.equal(analisiDellaSezione({ key: "sezione-che-non-esiste", rows: [] }, IT), null);
});

test("ogni lettura risponde anche in inglese, e con un'altra frase", () => {
  const casi = {
    energia: { rows: [{ group: "house", watts: 500 }, { group: "solar", watts: 900 }] },
    solare: { attiva: false, rows: [{ name: "P", temperature: 30 }, { name: "A", temperature: 20 }] },
    sicurezza: { alarm: true, armed: true, doors: [{ name: "X" }] },
    temperatura: { rows: [{ name: "A", temperature: 20 }, { name: "B", temperature: 24 }] },
    elettrodomestici: { rows: [{ name: "A", mode: "running", watts: 100 }] },
    telecamere: { rows: [{ name: "Ingresso" }] },
    ev: { ring: 80, attiva: true, rows: [] },
    robot: { rows: [{ name: "Robi", cleaning: true }] },
    piscina: { rows: [{ name: "Acqua", raw: 26 }] },
    irrigazione: { rows: [{ name: "Prato", on: true }] },
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
  const conFraseAltrove = ["luci", "clima", "tapparelle", "aperture", "batterie", "allagamenti", "todo"];
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
