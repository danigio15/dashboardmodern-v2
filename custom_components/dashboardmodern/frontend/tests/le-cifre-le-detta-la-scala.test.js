/* «I valori grezzi sono ad esempio "Volatile organic compounds" 0,11 ppm ma la
 *  dashboard visualizza 1,1 ppm.» (#530)
 *
 * I numeri di quella frase non erano i nostri — i dati dell'entità, chiesti e
 * arrivati, dicono che la plancia stampava lo stato di Home Assistant senza
 * toccarlo. Ma la domanda era giusta, ed è nel titolo: le cifre decimali.
 *
 * Si scriveva con una cifra sola sotto il cento. Per quasi tutte le misure va
 * bene — l'anidride carbonica si misura a centinaia di ppm, le polveri a
 * decine di microgrammi — ma i composti organici volatili in ppm hanno i
 * gradini a 0,065, 0,22 e 0,66: con una cifra sola «0,065» diventa «0,1» e
 * «0,04» diventa «0,0». La plancia non riusciva a stampare il numero che
 * decide il suo stesso colore, e l'aria buona e quella cattiva si scrivevano
 * uguali.
 *
 * Le cifre le detta la SCALA su cui si giudica, non il valore. Le due cose da
 * difendere sono che le misure sotto l'unità diventino leggibili, e che
 * nessun'altra cambi aspetto: chi non aveva il difetto non deve accorgersi di
 * niente.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { letturaDellAria, valoreScritto } from "../src/core/aria-model.js";

const leggi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");

/* Le scale vere del magazzino, così le prove non inventano soglie loro. */
const VOC_PPM = [0.065, 0.22, 0.66];
const VOC_PPB = [65, 220, 660];
const CO2 = [800, 1000, 1400];
const PM25 = [15, 25, 50];
const MONOSSIDO = [4, 10, 30];

test("sotto l'unità le cifre bastano a leggere il numero che decide il colore", () => {
  /* Erano tutti e tre «0,1» o «0,0»: tre arie diverse scritte uguali. */
  assert.equal(valoreScritto({ valore: 0.04, soglie: VOC_PPM }, "it"), "0,04");
  assert.equal(valoreScritto({ valore: 0.065, soglie: VOC_PPM }, "it"), "0,065");
  assert.equal(valoreScritto({ valore: 0.11, soglie: VOC_PPM }, "it"), "0,11");
  assert.equal(valoreScritto({ valore: 0.22, soglie: VOC_PPM }, "it"), "0,22");
});

test("gli zeri in coda non si scrivono dove le cifre le ha chieste la scala", () => {
  /* «0,100» non dice niente più di «0,1», e una tessera stretta le paga. */
  assert.equal(valoreScritto({ valore: 0.1, soglie: VOC_PPM }, "it"), "0,1");
  assert.equal(valoreScritto({ valore: 0.5, soglie: VOC_PPM }, "it"), "0,5");
});

test("le misure che il difetto non aveva restano scritte com'erano", () => {
  assert.equal(valoreScritto({ valore: 356, soglie: CO2 }, "it"), "356");
  assert.equal(valoreScritto({ valore: 20, soglie: PM25 }, "it"), "20,0");
  assert.equal(valoreScritto({ valore: 7.3, soglie: PM25 }, "it"), "7,3");
  assert.equal(valoreScritto({ valore: 110, soglie: VOC_PPB }, "it"), "110");
  assert.equal(valoreScritto({ valore: 2.5, soglie: MONOSSIDO }, "it"), "2,5");
});

test("la lettura si porta dietro la scala su cui è stata giudicata", () => {
  /* Senza, chi stampa dovrebbe indovinarla un'altra volta: è esattamente il
   * modo in cui erano nate tre copie della stessa regola. */
  const lettura = letturaDellAria(
    "sensor.voc",
    {
      state: "0.11",
      attributes: { unit_of_measurement: "ppm", device_class: "volatile_organic_compounds_parts" },
    },
    "it",
    null,
  );
  assert.deepEqual(lettura.soglie, VOC_PPM);
  assert.equal(valoreScritto(lettura, "it"), "0,11");
});

test("un sensore vero del #530 si scrive come lo scrive Home Assistant", () => {
  /* I tre dell'AIR cucina, con gli attributi che ha incollato chi segnala. */
  const casi = [
    ["356", "ppm", "carbon_dioxide", "356"],
    ["20.0", "μg/m³", "volatile_organic_compounds", "20,0"],
    ["0.1", "ppm", "volatile_organic_compounds_parts", "0,1"],
  ];
  for (const [state, unita, classe, atteso] of casi) {
    const lettura = letturaDellAria(
      "sensor.prova",
      { state, attributes: { unit_of_measurement: unita, device_class: classe } },
      "it",
      null,
    );
    assert.equal(valoreScritto(lettura, "it"), atteso, `${classe} ${state}`);
  }
});

test("la regola sta in un posto solo", () => {
  /* Era in tre: la copertina della tessera, le righe della finestra e la
   * frase. Tre copie sono tre modi di scriverla diversa. */
  const widget = leggi("../src/sections/home-widgets-section.js");
  const aria = leggi("../src/core/aria-model.js");
  const quanteVolte = (testo, ago) => testo.split(ago).length - 1;
  /* La riga dell'aria non deve più indovinare le cifre da sé. */
  for (const pezzo of ["copertina.valore >= 100", "lettura.valore >= 100", "peggiore.valore >= 100"])
    assert.equal(quanteVolte(widget + aria, pezzo), 0, pezzo);
  assert.equal(quanteVolte(aria, "function cifreDellaMisura"), 1);
});
