/* «È possibile inserire un solo pneumatico, spero al prossimo rilascio sia
 * possibile inserirne 4» (#319).
 *
 * La casella era una sola, `dm.ev_pneumatici`, e chi ha il TPMS ha quattro
 * sensori: ne mappava uno e gli altri tre non avevano dove andare. Adesso le
 * ruote hanno la loro casella ciascuna, e la casella di prima resta dov'era —
 * vale il riepilogo, o l'avviso unico dell'auto — cosi' chi l'aveva compilata
 * non si accorge di niente.
 *
 * E le gomme non sono del motore. Stavano dentro il quadro termico, che su
 * un'auto elettrica non si disegna: chi ha un'elettrica compilava le caselle e
 * non le vedeva da nessuna parte, mentre il TPMS ce l'ha anche lei. Quando il
 * motore non e' termico resta il quadretto delle ruote, e basta quello.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  CASELLE_TERMICHE,
  RIFERIMENTI_TERMICI,
  RUOTE,
  letturaTermica,
  pneumaticiInAvviso,
  ruoteDellAuto,
} from "../src/core/auto-termica.js";

const leggi = (percorso) => readFile(new URL(`../src/${percorso}`, import.meta.url), "utf8");
const stato = (state, attributes = {}) => ({ state, attributes });

/* Le quattro gomme di un'auto vera, in bar, con la posteriore destra sgonfia. */
const QUATTRO = {
  mappa: {
    "dm.ev_pneumatico_ant_sx": "sensor.as",
    "dm.ev_pneumatico_ant_dx": "sensor.ad",
    "dm.ev_pneumatico_post_sx": "sensor.ps",
    "dm.ev_pneumatico_post_dx": "sensor.pd",
  },
  stati: {
    "sensor.as": stato("2.4", { unit_of_measurement: "bar" }),
    "sensor.ad": stato("2.4", { unit_of_measurement: "bar" }),
    "sensor.ps": stato("2.3", { unit_of_measurement: "bar" }),
    "sensor.pd": stato("1.7", { unit_of_measurement: "bar" }),
  },
};

test("ogni ruota ha la sua casella, e sono dm.ev_* come tutte le altre", () => {
  for (const ref of [
    "dm.ev_pneumatico_ant_sx",
    "dm.ev_pneumatico_ant_dx",
    "dm.ev_pneumatico_post_sx",
    "dm.ev_pneumatico_post_dx",
  ])
    assert.ok(RIFERIMENTI_TERMICI.includes(ref), ref);
  /* La casella di prima non si tocca: chi l'ha compilata la ritrova. */
  assert.ok(RIFERIMENTI_TERMICI.includes("dm.ev_pneumatici"));
  const perRef = new Map(CASELLE_TERMICHE.map((voce) => [voce.ref, voce]));
  for (const voce of RUOTE) {
    const casella = perRef.get(voce.ref);
    assert.ok(casella, voce.ref);
    assert.equal(casella.tipo, "pressione");
    assert.equal(casella.campo, voce.campo);
  }
  /* L'ordine e' quello con cui si guarda l'auto dall'alto. */
  assert.deepEqual(
    RUOTE.map((voce) => voce.ruota),
    ["antSx", "antDx", "postSx", "postDx"],
  );
});

test("le quattro pressioni si leggono tutte, ognuna con la sua unita'", () => {
  const lettura = letturaTermica(QUATTRO.mappa, QUATTRO.stati);
  const ruote = ruoteDellAuto(lettura);
  assert.deepEqual(
    ruote.map((voce) => [voce.ruota, voce.pressione, voce.unita]),
    [
      ["antSx", 2.4, "bar"],
      ["antDx", 2.4, "bar"],
      ["postSx", 2.3, "bar"],
      ["postDx", 1.7, "bar"],
    ],
  );
  /* Una pressione non e' un avviso: quattro numeri non fanno lampeggiare la
   * scheda, altrimenti l'auto chiederebbe attenzione tutti i giorni. */
  assert.equal(pneumaticiInAvviso(lettura), false);
  assert.equal(lettura.attenzione, false);
});

test("una ruota sola mappata e' una ruota sola, non quattro vuote", () => {
  const lettura = letturaTermica(
    { "dm.ev_pneumatico_post_dx": "sensor.pd" },
    { "sensor.pd": stato("2.1", { unit_of_measurement: "bar" }) },
  );
  assert.deepEqual(
    ruoteDellAuto(lettura).map((voce) => voce.ruota),
    ["postDx"],
  );
  /* E chi non ne ha mappata nessuna non ha ruote: la casella di riepilogo,
   * se c'e', resta quella di sempre. */
  const riepilogo = letturaTermica(
    { "dm.ev_pneumatici": "sensor.tpms" },
    { "sensor.tpms": stato("2.2", { unit_of_measurement: "bar" }) },
  );
  assert.deepEqual(ruoteDellAuto(riepilogo), []);
  assert.equal(riepilogo.pneumatici.pressione, 2.2);
});

test("una gomma in avviso fa chiedere attenzione all'auto, da qualunque ruota arrivi", () => {
  const lettura = letturaTermica(
    { "dm.ev_pneumatico_post_sx": "binary_sensor.ps" },
    { "binary_sensor.ps": stato("on") },
  );
  assert.equal(ruoteDellAuto(lettura)[0].avviso, true);
  assert.equal(pneumaticiInAvviso(lettura), true);
  assert.equal(lettura.attenzione, true);
  /* Una ruota che sta bene non allarma nessuno. */
  const sana = letturaTermica(
    { "dm.ev_pneumatico_post_sx": "binary_sensor.ps" },
    { "binary_sensor.ps": stato("off") },
  );
  assert.equal(pneumaticiInAvviso(sana), false);
  assert.equal(sana.attenzione, false);
  /* E l'avviso unico di prima continua a valere. */
  assert.equal(
    pneumaticiInAvviso(
      letturaTermica({ "dm.ev_pneumatici": "binary_sensor.tpms" }, { "binary_sensor.tpms": stato("low") }),
    ),
    true,
  );
});

test("le ruote non mappate non diventano zeri", () => {
  const lettura = letturaTermica(
    { "dm.ev_pneumatico_ant_sx": "sensor.as", "dm.ev_pneumatico_ant_dx": "sensor.ad" },
    { "sensor.as": stato("2.4", { unit_of_measurement: "bar" }), "sensor.ad": stato("unavailable") },
  );
  /* Mappata ma muta: la ruota c'e' nella mappatura e non ha un valore. Non e'
   * zero bar, che vorrebbe dire gomma a terra. */
  assert.equal(lettura.pneumaticoAntDx, null);
  assert.deepEqual(
    ruoteDellAuto(lettura).map((voce) => voce.ruota),
    ["antSx"],
  );
});

test("la scheda dell'auto porta le quattro caselle, con il nome della loro ruota", async () => {
  const sezione = await leggi("sections/auto-termica-section.js");
  for (const ref of [
    "dm.ev_pneumatico_ant_sx",
    "dm.ev_pneumatico_ant_dx",
    "dm.ev_pneumatico_post_sx",
    "dm.ev_pneumatico_post_dx",
  ])
    assert.match(sezione, new RegExp(`case "${ref.replace(/\./g, "\\.")}":`), ref);
  /* Le caselle entrano nella scheda dalla stessa strada delle altre: la
   * tabella del nucleo, non un elenco scritto una seconda volta. */
  assert.match(sezione, /for \(const voce of CASELLE_TERMICHE\)/);
  /* Il nome della ruota si dice una volta e vale per la scheda e per la card. */
  assert.match(sezione, /export function parolaDellaRuota/);
});

test("sull'auto elettrica il blocco resta, con le sole gomme", async () => {
  const sezione = await leggi("sections/auto-termica-section.js");
  /* Prima: niente motore termico, blocco rimosso, gomme comprese. */
  assert.doesNotMatch(sezione, /if \(!tipo\) \{\s*if \(blocco\) blocco\.remove\(\);/);
  assert.match(sezione, /const soloGomme = !tipo;/);
  /* Si toglie solo quando non c'e' nemmeno una gomma da dire. */
  assert.match(sezione, /if \(soloGomme && !gomme\.quadretto && !gomme\.riassunto\)/);
  assert.match(sezione, /soloGomme \? gommeSoleMarkup\(gomme\) : quadroMarkup\(lettura, tipo\)/);
});

test("il quadretto disegna quattro posti, anche quelli non mappati", async () => {
  const sezione = await leggi("sections/auto-termica-section.js");
  const pezzo = sezione.slice(sezione.indexOf("function gommeMarkup"), sezione.indexOf("function quadroMarkup"));
  assert.match(
    pezzo,
    /\$\{cella\("antSx"\)\}\$\{cella\("antDx"\)\}\$\{cella\("postSx"\)\}\$\{cella\("postDx"\)\}/,
  );
  /* Una ruota che manca e' un posto vuoto col suo nome, non un buco: si vede
   * subito quale sensore non e' stato messo. */
  assert.match(pezzo, /data-vuota="true"/);
  /* E la pressione si tocca come le altre misure, per aprire il suo storico. */
  assert.match(sezione, /class="dm-termica-gomma" data-dm-storico=/);
});
