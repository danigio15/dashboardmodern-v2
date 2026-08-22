/* La fascia verde deve nascondere la sezione che si sta guardando.
 *
 * Sulla scheda Aspirapolvere «🟢 Sezione visibile in dashboard — tocca per
 * nascondere» non nascondeva niente. La mappa che dice quale sezione appartiene
 * a quale scheda dell'editor e' stata scritta prima che l'Aspirapolvere
 * esistesse: senza la sua riga la fascia su quella scheda non e' la sua, e il
 * tocco finiva su un'altra preferenza o su nessuna.
 *
 * Le due chiavi devono essere la stessa parola: quella che l'editor scrive in
 * `cd_sections` e quella che la barra legge per accendere la voce.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { TAB_SECTION_KEYS } from "../src/sections/config-uniformity-section.js";
import { ROBOT_TAB } from "../src/sections/robot-section.js";
import { ROBOT_EDITOR_TAB } from "../src/sections/robot-editor-section.js";

test("la scheda Aspirapolvere sa quale sezione accende e spegne", () => {
  assert.equal(TAB_SECTION_KEYS[ROBOT_EDITOR_TAB], ROBOT_TAB);
});

test("nessuna scheda punta a una sezione vuota", () => {
  for (const [scheda, sezione] of Object.entries(TAB_SECTION_KEYS)) {
    assert.equal(typeof sezione, "string", `${scheda} non ha una sezione`);
    assert.ok(sezione.length > 0, `${scheda} punta a una sezione vuota`);
  }
});

test("due schede non si contendono la stessa sezione", () => {
  const sezioni = Object.values(TAB_SECTION_KEYS);
  assert.equal(sezioni.length, new Set(sezioni).size, "una sezione ha due interruttori");
});
