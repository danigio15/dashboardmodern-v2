/* La tapparella lasciata a uno spiraglio conta come chiusa (#298).
 *
 * «Vorrei poter definire un determinato valore percentuale, es. 10%, per
 * considerare le tapparelle chiuse. Di solito le imposto cosi' per mantenere un
 * minimo il passaggio d'aria, ma il sistema le rileva aperte.»
 *
 * La soglia e' una sola per tutta la casa, sta nel nucleo come regola, e la
 * leggono tutti e due i posti che dicono «aperta»: la pagina Finestre e la
 * tessera in Home. Due letture della stessa soglia scritte in due modi
 * finirebbero prima o poi per dire cose diverse sulla stessa tapparella.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  CHIAVE_SOGLIA_CHIUSA,
  SOGLIA_CHIUSA_MASSIMA,
  coverClosedThreshold,
  coverIsClosedAt,
  sogliaDellaCopertura,
} from "../src/core/cover-kind.js";

const leggi = (percorso) => readFile(new URL(`../src/${percorso}`, import.meta.url), "utf8");

test("la soglia si legge come numero, e vuoto vuol dire zero", () => {
  assert.equal(coverClosedThreshold(10), 10);
  assert.equal(coverClosedThreshold("10"), 10);
  assert.equal(coverClosedThreshold(" 7.6 "), 8);
  /* Vuoto non e' un numero: e' «come sempre». */
  assert.equal(coverClosedThreshold(""), 0);
  assert.equal(coverClosedThreshold(null), 0);
  assert.equal(coverClosedThreshold(undefined), 0);
  assert.equal(coverClosedThreshold("ciao"), 0);
  assert.equal(coverClosedThreshold(-5), 0);
});

test("la soglia non va oltre la meta': a mezz'asta non e' uno spiraglio", () => {
  assert.equal(SOGLIA_CHIUSA_MASSIMA, 50);
  assert.equal(coverClosedThreshold(90), 50);
  assert.equal(coverClosedThreshold(1000), 50);
});

test("al dieci per cento e' chiusa se la soglia dice dieci, aperta se non dice niente", () => {
  assert.equal(coverIsClosedAt(10, 10), true);
  assert.equal(coverIsClosedAt(8, 10), true);
  assert.equal(coverIsClosedAt(11, 10), false);
  /* Zero e' il comportamento di sempre: chiusa solo a zero. */
  assert.equal(coverIsClosedAt(10, 0), false);
  assert.equal(coverIsClosedAt(0, 0), true);
  assert.equal(coverIsClosedAt(0), true);
  /* Senza posizione non si decide niente: lo dira' lo stato. */
  assert.equal(coverIsClosedAt(null, 10), null);
  assert.equal(coverIsClosedAt("—", 10), null);
});

test("la pagina Finestre e la tessera in Home leggono la stessa soglia", async () => {
  const scena = await leggi("sections/shutter-scene-section.js");
  assert.match(scena, /coverClosedThreshold\(readJson\(CHIAVE_SOGLIA_CHIUSA, 0\)\)/);
  /* Ogni riga porta la sua soglia, o quella di casa (dal campo: «ognuno puo'
   * avere una percentuale differente»); la pastiglia della card e il conto in
   * cima passano tutti e due da quella. */
  assert.match(scena, /soglia: sogliaDellaCopertura\(item, sogliaChiusa\(\)\)/);
  assert.match(scena, /view\.position > sogliaDi\(view\) \? "open" : "closed"/);
  assert.match(scena, /!view\.moving && view\.position > sogliaDi\(view\)/);
  const widgets = await leggi("sections/home-widgets-section.js");
  assert.match(widgets, /position > sogliaDellaCopertura\(item, readJson\(CHIAVE_SOGLIA_CHIUSA, 0\)\)/);
  /* E dove la posizione c'e' comanda lei: lo stato «open» di Home Assistant
   * non riapre una tapparella che la soglia dice chiusa. */
  assert.match(widgets, /Number\.isFinite\(position\)\s*\?\s*position > sogliaDellaCopertura/);
  /* La riga: la sua soglia vince, vuota vale quella di casa, zero scritto e' zero. */
  assert.equal(sogliaDellaCopertura({ soglia: 15 }, 10), 15);
  assert.equal(sogliaDellaCopertura({ soglia: "" }, 10), 10);
  assert.equal(sogliaDellaCopertura({}, 10), 10);
  assert.equal(sogliaDellaCopertura({ soglia: 0 }, 10), 0);
  assert.equal(sogliaDellaCopertura({ soglia: 90 }, 10), 50, "oltre la meta' non e' uno spiraglio");
  const scheda = await leggi("sections/shutter-window-section.js");
  assert.match(scheda, /id="ed-tp-soglia-riga"/);
  const crud = await leggi("sections/editor-crud-section.js");
  assert.match(crud, /const soglia = sogliaScritta\(doc\.getElementById\("ed-tp-soglia-riga"\)\?\.value\);/);
  assert.match(crud, /soglia: clean\(doc\.getElementById\("ed-tp-soglia-riga"\)\?\.value\),/);
});

test("la soglia si scrive nella scheda Finestre e viaggia con la configurazione", async () => {
  const scheda = await leggi("sections/shutter-window-section.js");
  assert.match(scheda, /id="ed-tp-soglia"/);
  assert.match(scheda, /writeJsonIfChanged\(CHIAVE_SOGLIA_CHIUSA, soglia\)/);
  /* In cima alla scheda, non dentro il modulo di una riga: e' della casa. */
  assert.match(scheda, /ensureSogliaField\(body\);/);
  const persistenza = await leggi("sections/config-persistence-section.js");
  assert.match(persistenza, new RegExp(`"${CHIAVE_SOGLIA_CHIUSA}"`));
  assert.match(persistenza, /CONFIG_KEYS_REVISION = 26/);
  assert.equal(CHIAVE_SOGLIA_CHIUSA, "cd_tapparelle_soglia");
});
