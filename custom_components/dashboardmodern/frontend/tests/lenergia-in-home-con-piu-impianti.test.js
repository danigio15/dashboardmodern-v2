/* «Ho fatto due impianti diversi avendo due appartamenti uniti con due contatori
 * separati. Tutto bene nella sezione energia ma il widget in Home page è solo
 * quello del primo impianto. Suggerisco di scegliere se avere un widget solo
 * (con la somma di tutti gli impianti) oppure un widget per ogni impianto»
 * (#286).
 *
 * La tessera leggeva i quattro gruppi al primo livello, che sono quelli del
 * primo impianto: il secondo contatore non compariva da nessuna parte, e chi
 * guardava la Home vedeva metà della propria casa senza che niente lo dicesse.
 *
 * La scelta è quella suggerita, ed è una scelta perché le due risposte sono
 * tutte e due giuste: chi ha unito due appartamenti ha una casa sola e vuole un
 * numero solo; chi tiene i contatori separati per pagarli separati li vuole
 * separati. Di serie la somma.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  TESSERA_PER_IMPIANTO,
  TESSERA_SOMMA,
  TESSERE_IMPIANTI_KEY,
  comeSiVedeLEnergia,
  plantKey,
  plantLabel,
  sommaLetture,
  sommaNumeri,
} from "../src/core/energy-plants.js";

test("di serie si somma, e la scelta è una parola sola", () => {
  assert.equal(comeSiVedeLEnergia(""), TESSERA_SOMMA);
  assert.equal(comeSiVedeLEnergia(null), TESSERA_SOMMA);
  assert.equal(comeSiVedeLEnergia("qualcosa"), TESSERA_SOMMA);
  assert.equal(comeSiVedeLEnergia(TESSERA_PER_IMPIANTO), TESSERA_PER_IMPIANTO);
  assert.equal(TESSERE_IMPIANTI_KEY, "cd_energia_tessere");
});

test("i gruppi si sommano fra impianti, e quello che nessuno misura resta fuori", () => {
  const primo = [
    { group: "house", watts: 820 },
    { group: "solar", watts: 1400 },
  ];
  const secondo = [
    { group: "house", watts: 310 },
    { group: "grid", watts: -120 },
  ];
  const somma = sommaLetture([primo, secondo]);
  const per = Object.fromEntries(somma.map((riga) => [riga.group, riga.watts]));
  assert.equal(per.house, 1130);
  assert.equal(per.solar, 1400, "il fotovoltaico ce l'ha solo il primo, e vale lo stesso");
  assert.equal(per.grid, -120, "il segno resta: −120 W vuol dire che si sta immettendo");
  /* La batteria che nessuno dei due misura non compare come zero: uno zero
   * scritto grande sopra una casa che consuma è peggio di niente. */
  assert.equal("battery" in per, false);
});

test("due batterie al 50% non fanno il 100%", () => {
  const somma = sommaLetture([
    [{ group: "battery", watts: -500, soc: 40 }],
    [{ group: "battery", watts: 200, soc: 80 }],
  ]);
  assert.equal(somma[0].watts, -300);
  assert.equal(somma[0].soc, 60, "la percentuale è una media, non una somma");
  /* Una sola batteria misurata dà la sua percentuale, non la metà. */
  const sola = sommaLetture([[{ group: "battery", watts: null, soc: 70 }], [{ group: "house", watts: 10 }]]);
  assert.equal(sola.find((riga) => riga.group === "battery").soc, 70);
});

test("sommare niente non fa zero", () => {
  assert.equal(sommaNumeri([null, undefined]), null);
  assert.equal(sommaNumeri([]), null);
  assert.equal(sommaNumeri([4.2, null, 1.8]), 6);
  assert.equal(sommaNumeri([0]), 0, "uno zero misurato è un numero");
});

test("la prima tessera tiene la chiave di sempre, le altre portano il loro id", () => {
  /* Così l'ordine e la visibilità che si erano già scelti per «energia»
   * restano suoi: chi aveva spostato la tessera in cima non la ritrova in
   * fondo il giorno che aggiunge il secondo contatore. */
  assert.equal(plantKey("energia", { id: "impianto" }, 0), "energia");
  assert.equal(plantKey("energia", { id: "impianto-2" }, 1), "energia_impianto-2");
  assert.equal(plantLabel({ name: "Appartamento di sopra" }, 1, "Impianto"), "Appartamento di sopra");
  assert.equal(plantLabel({}, 1, "Impianto"), "Impianto 2");
});

test("la tessera legge l'impianto, e le sue sorelle sono riconosciute", () => {
  const ponte = readFileSync(
    new URL("../src/sections/home-widgets-section.js", import.meta.url),
    "utf8",
  );
  /* Chi decideva guardando la chiave «energia» deve riconoscere anche le
   * sorelle, altrimenti la seconda tessera esce senza caselle, senza il verso
   * della batteria e senza il suo popup. */
  assert.match(ponte, /const eUnaTesseraEnergia = \(chiave\) =>/);
  assert.doesNotMatch(ponte, /widget\?\.key === "energia"/);
  assert.doesNotMatch(ponte, /widget\.key === "energia"/);
  /* E gli slot storici valgono solo per il primo impianto: gli altri sono nati
   * dopo e non ne hanno, quindi coi campi vuoti avrebbero letto le entità del
   * primo e detto gli stessi numeri. */
  assert.match(ponte, /\(primo \? slot : ""\)/);
});

test("la scelta viaggia, perché è come si vuole vedere la plancia", () => {
  const persistenza = readFileSync(
    new URL("../src/sections/config-persistence-section.js", import.meta.url),
    "utf8",
  );
  assert.match(persistenza, new RegExp(`"${TESSERE_IMPIANTI_KEY}"`));
});

test("con un impianto solo la domanda non si fa", () => {
  const impianti = readFileSync(
    new URL("../src/sections/energy-plants-section.js", import.meta.url),
    "utf8",
  );
  /* Una domanda senza risposte è solo una riga in più da leggere. */
  assert.match(impianti, /if \(lista\.length < 2\) return "";/);
  assert.match(impianti, /data-dm-tessere/);
});
