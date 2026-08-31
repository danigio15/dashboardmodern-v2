/* «Nel popup vengono mostrate anche aspiratore canna fumaria e pompa
 * termocamino, ma nella sezione clima non e' presente alcun campo per
 * impostarlo: il campo deve essere libero, e se non viene inserito nulla
 * deve scomparire.»
 *
 * Il pannello sotto le stanze del Caldo era tre righe cablate nel guscio —
 * una addirittura su `switch.caldaia`, l'entita' dell'impianto di qualcuno.
 * Le voci ora vivono in `cd_termico_caldo`: qui si prova la logica pura —
 * la config comanda, il vuoto scelto resta vuoto, e la semina storica tocca
 * solo a chi quelle entita' le ha davvero.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { vociTermiche } from "../src/sections/termico-del-caldo-section.js";

test("senza config e senza entita' storiche, nessuna voce: il pannello sparisce", () => {
  assert.deepEqual(vociTermiche(null, {}, {}), []);
});

test("la semina storica tocca solo a chi ha davvero quelle entita'", () => {
  const voci = vociTermiche(
    null,
    { "switch.caldaia": { state: "on" } },
    { "dm.core_053": "switch.pompa_termocamino" },
  );
  assert.deepEqual(
    voci.map((voce) => voce.name),
    ["Caldaia", "Pompa termocamino"],
  );
  /* L'aspiratore non e' mappato: non si semina. */
});

test("una config svuotata apposta resta vuota, anche con le storiche in casa", () => {
  assert.deepEqual(vociTermiche([], { "switch.caldaia": { state: "on" } }, {}), []);
});

test("la config comanda, e le voci storpie non passano", () => {
  const voci = vociTermiche([
    { name: "Pompa pellet", entity: "switch.pellet", icon: "♨️" },
    { name: "", entity: "switch.senza_nome" },
    { name: "Senza punto", entity: "nondominio" },
  ]);
  assert.deepEqual(voci, [{ name: "Pompa pellet", entity: "switch.pellet", icon: "♨️" }]);
});

test("una voce senza icona prende la fiamma, non il vuoto", () => {
  assert.equal(vociTermiche([{ name: "Caldaia", entity: "switch.c" }])[0].icon, "🔥");
});
