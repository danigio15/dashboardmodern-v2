/* I programmi del popup lavatrice, puri.
 *
 * «Dare in config la scelta dei programmi da inserire come tasti»: dalla
 * config se scritta, altrimenti la semina storica per chi ha i quattro
 * script del guscio davvero mappati. Svuotata apposta, resta vuota.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { programmiLavatrice } from "../src/sections/il-popup-della-lavatrice-section.js";

test("la config scritta comanda, e si normalizza", () => {
  const voci = programmiLavatrice([
    { name: "Eco 40", entity: "script.lavatrice_eco" },
    { name: "", entity: "script.senza_nome" },
    { name: "Senza punto", entity: "nonentita" },
    { name: "Lana", entity: "switch.lana", icon: "🧶" },
  ]);
  assert.deepEqual(
    voci.map((voce) => voce.name),
    ["Eco 40", "Lana"],
  );
  assert.equal(voci[0].icon, "🧺");
  assert.equal(voci[1].icon, "🧶");
});

test("mai scritta: si seminano solo gli storici mappati davvero", () => {
  const voci = programmiLavatrice(null, {
    "dm.lavatrice_script_programma_30": "script.rapido_30",
  });
  assert.deepEqual(
    voci.map((voce) => voce.name),
    ["Rapido 30'"],
  );
  assert.deepEqual(programmiLavatrice(null, {}), []);
});

test("svuotata apposta resta vuota", () => {
  assert.deepEqual(programmiLavatrice([]), []);
});
