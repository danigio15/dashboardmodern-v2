/* «Le batterie quelle cariche non le fa vedere? Sarebbe carino che le batterie
 * stessero nel config come le altre cose configurazioni.» (#398)
 *
 * Le batterie erano un elenco che compariva in Home solo quando una scendeva
 * sotto il venti per cento — venti scritto nel codice, uguale per tutti — e
 * sparita quella spariva l'argomento. Adesso sono una sezione come le altre:
 * la sua pagina, la sua scheda nel Config, la sua tessera.
 *
 * Qui si tiene ferma la parte che si può sbagliare in silenzio: cosa conta
 * come batteria, quando è scarica, e come si riassumono.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  SOGLIA_MASSIMA,
  SOGLIA_PREDEFINITA,
  batterieLette,
  eUnaBatteria,
  riepilogoBatterie,
  sogliaDelleBatterie,
} from "../src/core/batterie-di-casa.js";
import { CHIAVI_PER_SCHEDA } from "../src/core/lelenco-delle-sezioni.js";
import { famigliaDellaScheda } from "../src/core/alberatura-del-config.js";

const leggi = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

const batteria = (livello, nome) => ({
  state: String(livello),
  attributes: { device_class: "battery", unit_of_measurement: "%", friendly_name: nome },
});

const CASA = {
  "sensor.serratura": batteria(12, "Serratura"),
  "sensor.telecomando": batteria(88, "Telecomando"),
  "sensor.sonda": batteria(31, "Sonda"),
  "sensor.morta": {
    state: "unavailable",
    attributes: { device_class: "battery", unit_of_measurement: "%" },
  },
};

test("è una batteria solo ciò che dice una percentuale", () => {
  assert.equal(eUnaBatteria(CASA["sensor.serratura"]), true);
  /* Un `device_class: battery` che risponde on/off esiste — è l'allarme
   * «batteria scarica» di certi sensori — ma non è un livello, e in un elenco
   * di percentuali scriverebbe «on%» accanto a «34%». */
  assert.equal(eUnaBatteria({ attributes: { device_class: "battery" } }), false);
  assert.equal(
    eUnaBatteria({ attributes: { device_class: "humidity", unit_of_measurement: "%" } }),
    false,
  );
  assert.equal(eUnaBatteria(null), false);
});

test("la soglia si sceglie, e non era scegliibile", () => {
  /* Venti stava scritto nel codice: chi ha una serratura da cambiare al trenta
   * e un telecomando che dura fino al cinque aveva un numero solo per due
   * cose diverse. */
  assert.equal(sogliaDelleBatterie({}), SOGLIA_PREDEFINITA);
  assert.equal(sogliaDelleBatterie(null), SOGLIA_PREDEFINITA);
  assert.equal(sogliaDelleBatterie({ soglia: 35 }), 35);
  /* E non si può scrivere un numero che spegne l'avviso o lo accende sempre. */
  assert.equal(sogliaDelleBatterie({ soglia: 0 }), 1);
  assert.equal(sogliaDelleBatterie({ soglia: 999 }), SOGLIA_MASSIMA);
  assert.equal(sogliaDelleBatterie({ soglia: "boh" }), SOGLIA_PREDEFINITA);
});

test("le più scariche prima, e le mute in fondo", () => {
  const righe = batterieLette(Object.keys(CASA), CASA, { soglia: 20 });
  assert.deepEqual(
    righe.map((riga) => riga.name),
    ["Serratura", "Sonda", "Telecomando", "sensor.morta"],
  );
  /* Una che non risponde non è né carica né scarica: contarla carica sarebbe
   * una bugia tranquillizzante, contarla scarica manderebbe a cambiare una
   * pila che sta benissimo. */
  const muta = righe.at(-1);
  assert.equal(muta.muta, true);
  assert.equal(muta.scarica, false);
  assert.equal(muta.level, null);
});

test("la soglia decide chi è da cambiare, e cambiarla cambia il conto", () => {
  const venti = riepilogoBatterie(batterieLette(Object.keys(CASA), CASA, { soglia: 20 }));
  assert.equal(venti.scariche, 1);
  /* Alzandola al trentacinque anche la sonda al 31% entra nel conto: è
   * esattamente la cosa che prima non si poteva dire. */
  const trentacinque = riepilogoBatterie(batterieLette(Object.keys(CASA), CASA, { soglia: 35 }));
  assert.equal(trentacinque.scariche, 2);
});

test("il riepilogo dice anche quale chiederà una pila per prima", () => {
  const conto = riepilogoBatterie(batterieLette(Object.keys(CASA), CASA, { soglia: 20 }));
  assert.equal(conto.quante, 4);
  assert.equal(conto.lette, 3);
  assert.equal(conto.mute, 1);
  assert.equal(conto.minima.name, "Serratura");
  /* Senza nessuna che risponda non c'è una più bassa: dire zero sarebbe
   * inventare un allarme. */
  const solaMuta = riepilogoBatterie(batterieLette(["sensor.morta"], CASA, {}));
  assert.equal(solaMuta.minima, null);
  assert.equal(solaMuta.scariche, 0);
  assert.deepEqual(riepilogoBatterie([]).quante, 0);
});

test("il nome scelto vince su quello di fabbrica", () => {
  const righe = batterieLette(["sensor.serratura"], CASA, {
    soglia: 20,
    nome: (entity) => (entity === "sensor.serratura" ? "Porta di casa" : ""),
  });
  assert.equal(righe[0].name, "Porta di casa");
});

test("la sezione esiste come tutte le altre: scheda, chiave, famiglia", () => {
  /* «Sarebbe carino che le batterie stessero nel config come le altre cose»:
   * questo è il senso letterale della richiesta. */
  assert.equal(CHIAVI_PER_SCHEDA.batterie, "batterie");
  /* Sta con la casa e non con gli avvisi: sono la manutenzione delle cose che
   * ci sono dentro, non una notizia che arriva. */
  assert.equal(famigliaDellaScheda("batterie"), "casa");
});

test("la tessera, la pagina e la scheda guardano lo stesso elenco e la stessa soglia", async () => {
  /* Se la scheda ne toglie una e la tessera continua a contarla, chi l'ha
   * tolta pensa che la plancia non l'abbia sentito. */
  const widget = await leggi("../src/sections/home-widgets-section.js");
  assert.match(widget, /const soglia = sogliaDelleBatterie\(readJson\(CHIAVE_BATTERIE, \{\}\)\)/);
  assert.doesNotMatch(widget, /row\.level <= 20/);
  for (const file of ["batterie-section.js", "batterie-editor-section.js"])
    assert.match(await leggi(`../src/sections/${file}`), /batterieSorvegliate/);
});

test("il modello resta puro: nessun DOM, nessuna memoria, nessun orologio", async () => {
  const modello = await leggi("../src/core/batterie-di-casa.js");
  assert.doesNotMatch(modello, /\bdocument\.|\blocalStorage\.|Date\.now|new Date\(/);
});
