/* I varchi di casa: quali contatti contano, e come stanno (#367, #377).
 *
 * «In verde dovrebbe segnare i sensori contact chiusi e in rosso quelli aperti
 * … almeno a colpo d'occhio so quante finestre sono aperte in questo momento»
 * e «una sezione porte … magari che la card principale come per le luci mostri
 * solo il numero di porte aperte». Sono la stessa domanda fatta da due
 * persone, e la risposta è una: quanti sono aperti adesso, e quali.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  contoDeiVarchi,
  eUnVarcoDiCasa,
  normalizzaVarchi,
  varchiConfigurati,
  varchiDiCasa,
} from "../src/core/varchi-di-casa.js";

const STATI = {
  "binary_sensor.porta_ingresso": {
    state: "on",
    attributes: { device_class: "door", friendly_name: "Porta ingresso" },
  },
  "binary_sensor.finestra_cucina": {
    state: "off",
    attributes: { device_class: "window", friendly_name: "Finestra cucina" },
  },
  "binary_sensor.portone_garage": {
    state: "unavailable",
    attributes: { device_class: "garage_door", friendly_name: "Portone garage" },
  },
  "binary_sensor.movimento": {
    state: "on",
    attributes: { device_class: "motion", friendly_name: "Movimento" },
  },
  "sensor.temperatura": { state: "21", attributes: { device_class: "temperature" } },
};

const nomeDi = (entity) => STATI[entity]?.attributes?.friendly_name || entity;

test("conta come varco solo quello che Home Assistant chiama varco", () => {
  assert.equal(eUnVarcoDiCasa("binary_sensor.porta_ingresso", STATI["binary_sensor.porta_ingresso"]), true);
  /* Un rilevatore di movimento è un binary_sensor come gli altri, ma non è un
   * varco: contarlo vorrebbe dire dire «una porta aperta» a chi passa. */
  assert.equal(eUnVarcoDiCasa("binary_sensor.movimento", STATI["binary_sensor.movimento"]), false);
  assert.equal(eUnVarcoDiCasa("sensor.temperatura", STATI["sensor.temperatura"]), false);
});

test("chi ha la casa corregge il rilevamento", () => {
  /* Il sensore del frigorifero etichettato «door» si toglie… */
  const senza = { escluse: ["binary_sensor.porta_ingresso"] };
  assert.equal(
    eUnVarcoDiCasa("binary_sensor.porta_ingresso", STATI["binary_sensor.porta_ingresso"], senza),
    false,
  );
  /* …e il template che nessuno ha etichettato si aggiunge. */
  const con = { aggiunte: ["binary_sensor.mio_contatto"] };
  assert.equal(eUnVarcoDiCasa("binary_sensor.mio_contatto", { state: "on" }, con), true);
});

test("gli aperti vengono prima, e i muti non si contano fra i chiusi", () => {
  const righe = varchiDiCasa(STATI, {}, new Set(), nomeDi);
  assert.deepEqual(
    righe.map((riga) => riga.stato),
    ["aperto", "", "chiuso"],
  );
  const conto = contoDeiVarchi(righe);
  /* Un sensore che non risponde non è una finestra chiusa: contarlo chiuso
   * sarebbe una bugia tranquillizzante. */
  assert.deepEqual(
    { aperti: conto.aperti, chiusi: conto.chiusi, muti: conto.muti, totale: conto.totale },
    { aperti: 1, chiusi: 1, muti: 1, totale: 3 },
  );
  assert.deepEqual(conto.nomi, ["Porta ingresso"]);
});

test("il verso girato lo decide chi lo dice già, non una regola nuova", () => {
  /* Un contatto girato sta a ON quando l'infisso è CHIUSO: è la stessa regola
   * della configurazione e delle Finestre, e averne una seconda qui vorrebbe
   * dire che prima o poi si contraddicono. */
  const girati = new Set(["binary_sensor.porta_ingresso"]);
  const righe = varchiDiCasa(STATI, {}, girati, nomeDi);
  const porta = righe.find((riga) => riga.entity === "binary_sensor.porta_ingresso");
  assert.equal(porta.stato, "chiuso");
  assert.equal(contoDeiVarchi(righe).aperti, 0);
});

test("il nome scritto a mano vince su quello dell'integrazione", () => {
  const righe = varchiDiCasa(
    STATI,
    { nomi: { "binary_sensor.porta_ingresso": "Portoncino di casa" } },
    new Set(),
    nomeDi,
  );
  const porta = righe.find((riga) => riga.entity === "binary_sensor.porta_ingresso");
  assert.equal(porta.name, "Portoncino di casa");
});

test("senza contatti non c'e' niente da mostrare", () => {
  assert.equal(varchiConfigurati({ "sensor.temperatura": STATI["sensor.temperatura"] }), false);
  assert.equal(varchiConfigurati(STATI), true);
  assert.deepEqual(varchiDiCasa({}, {}, new Set()), []);
  assert.deepEqual(contoDeiVarchi(), { aperti: 0, chiusi: 0, muti: 0, totale: 0, nomi: [] });
});

test("la configurazione si ripulisce di quello che non e' un'entita'", () => {
  const scelte = normalizzaVarchi({
    escluse: ["binary_sensor.uno", "senza-punto", "binary_sensor.uno"],
    aggiunte: ["binary_sensor.due"],
    nomi: { "binary_sensor.due": "  Cantina  ", "no": "niente", "binary_sensor.tre": "  " },
  });
  assert.deepEqual(scelte.escluse, ["binary_sensor.uno"]);
  assert.deepEqual(scelte.aggiunte, ["binary_sensor.due"]);
  assert.deepEqual(scelte.nomi, { "binary_sensor.due": "Cantina" });
});
