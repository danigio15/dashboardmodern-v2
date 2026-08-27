/* Un infisso, quattro caselle.
 *
 * La scheda Tapparelle chiedeva una entita' sola piu' un menu che diceva di
 * che tipo fosse. Ma sulla stessa finestra ci stanno insieme la tapparella, la
 * tenda e la tenda da sole, e chi le ha tutte non aveva modo di dirlo: poteva
 * sceglierne una e basta. Segnalato come bloccante.
 *
 * Le caselle adesso sono una per funzione, e il tipo non si dichiara piu':
 * lo dice la casella in cui hai scritto.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { COVER_SLOTS, coverEntries, coverSlotDownRelay } from "../src/core/cover-kind.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("una riga con tutte e tre le coperture ne produce tre", () => {
  const infisso = {
    name: "Camera",
    entity: "cover.tapparella_camera",
    tenda: "cover.tenda_camera",
    tendaSole: "cover.tenda_sole_camera",
    contact: "binary_sensor.finestra_camera",
  };
  assert.deepEqual(coverEntries(infisso), [
    { entity: "cover.tapparella_camera", kind: "", down: "" },
    { entity: "cover.tenda_camera", kind: "tenda", down: "" },
    { entity: "cover.tenda_sole_camera", kind: "tenda_sole", down: "" },
  ]);
});

test("una riga con la sola tapparella resta una sola copertura", () => {
  assert.deepEqual(coverEntries({ entity: "cover.x" }), [{ entity: "cover.x", kind: "", down: "" }]);
});

test("le caselle vuote non contano, e l'ordine e' quello delle caselle", () => {
  assert.deepEqual(coverEntries({ tendaSole: "cover.sole", entity: "", tenda: "  " }), [
    { entity: "cover.sole", kind: "tenda_sole", down: "" },
  ]);
});

test("la stessa entita' scritta due volte esce una volta sola", () => {
  const doppia = { entity: "cover.x", tenda: "cover.x" };
  assert.deepEqual(coverEntries(doppia), [{ entity: "cover.x", kind: "", down: "" }]);
});

test("una riga vecchia col tipo dichiarato lo conserva", () => {
  assert.deepEqual(coverEntries({ entity: "cover.x", kind: "tenda", down: "" }), [
    { entity: "cover.x", kind: "tenda", down: "" },
  ]);
});

test("una riga vuota non produce niente", () => {
  assert.deepEqual(coverEntries({}), []);
  assert.deepEqual(coverEntries(), []);
});

test("le caselle sono una per funzione, nell'ordine giusto", () => {
  assert.deepEqual(
    COVER_SLOTS.map((slot) => slot.campo),
    ["entity", "tenda", "tendaSole"],
  );
});

test("la scheda stampa le tre caselle in piu' e non il menu del tipo", () => {
  const modulo = leggi("sections/shutter-window-section.js");
  for (const id of ["ed-tp-tenda", "ed-tp-tendasole", "ed-tp-contact"]) {
    assert.match(modulo, new RegExp(`"${id}"`), `manca la casella ${id}`);
  }
  assert.doesNotMatch(modulo, /ensureKindField/);
  // Un menu rimasto da una versione precedente va tolto, non lasciato li'.
  assert.match(modulo, /#ed-tp-kind[\s\S]{0,80}remove\(\)/);
});

test("quello che si scrive nelle caselle viene salvato e riletto", () => {
  const crud = leggi("sections/editor-crud-section.js");
  for (const campo of ["tenda", "tendaSole"]) {
    assert.match(crud, new RegExp(`${campo}: clean\\(doc\\.getElementById`), `${campo} non salvato`);
  }
  assert.match(crud, /setField\("ed-tp-tenda", item\.tenda/);
  assert.match(crud, /setField\("ed-tp-tendasole", item\.tendaSole/);
});

test("anche la tenda puo' stare su due rele', con il suo verso di discesa", () => {
  /* «Possibilità di mettere due switch per tapparelle anche per tende e tende
   * da sole»: due tende su due Shelly 2PM sono due motori a due fili, e il
   * secondo rele' valeva solo per la tapparella. Adesso ogni casella della
   * riga porta il suo. */
  const riga = {
    entity: "switch.tapparella_su",
    down: "switch.tapparella_giu",
    tenda: "switch.tenda_su",
    tendaDown: "switch.tenda_giu",
    tendaSole: "cover.tenda_da_sole",
    tendaSoleDown: "switch.qualcosa_giu",
  };
  assert.deepEqual(coverEntries(riga), [
    { entity: "switch.tapparella_su", kind: "", down: "switch.tapparella_giu" },
    { entity: "switch.tenda_su", kind: "tenda", down: "switch.tenda_giu" },
    /* La tenda da sole e' una copertura vera: i due versi li ha gia' Home
     * Assistant, e un rele' in piu' sarebbe solo un modo per farsi male. */
    { entity: "cover.tenda_da_sole", kind: "tenda_sole", down: "" },
  ]);
  assert.equal(coverSlotDownRelay(riga, "tenda"), "switch.tenda_giu");
  assert.equal(coverSlotDownRelay(riga, "tendaSole"), "");
});
