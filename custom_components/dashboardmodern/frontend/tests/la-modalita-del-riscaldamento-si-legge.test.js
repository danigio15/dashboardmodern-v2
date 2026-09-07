/* «In genere i termostati smart espongono una o più entità che indicano la
 * modalità del riscaldamento. Io ho TADO e due modalità HOME e AWAY ma altri
 * potrebbero avere altre modalità, tipo HOLIDAY, BOOST ecc.» (#362)
 *
 * Un termosifone a 17 gradi con la casa in FUORI sta facendo il suo lavoro; lo
 * stesso termosifone con la casa in CASA è un termosifone che non scalda. La
 * card diceva target e ambiente, e non diceva quale dei due casi fosse.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  chiamataDelModo,
  famigliaDelModo,
  letturaDelModo,
  nomeDelModo,
  prossimoModo,
} from "../src/core/modo-del-clima.js";

const TADO = {
  state: "HOME",
  attributes: { options: ["HOME", "AWAY", "HOLIDAY"] },
};

test("le modalità si riconoscono comunque siano scritte", () => {
  /* «Fuori casa», «fuori_casa» e «FUORI-CASA» sono la stessa modalità: le
   * lettere accentate e i separatori non devono decidere niente. */
  assert.equal(famigliaDelModo("AWAY"), "away");
  assert.equal(famigliaDelModo("Fuori casa"), "away");
  assert.equal(famigliaDelModo("fuori_casa"), "away");
  assert.equal(famigliaDelModo("HOME"), "home");
  assert.equal(famigliaDelModo("Vacanza"), "holiday");
  assert.equal(famigliaDelModo("boost"), "boost");
});

test("una modalità mai vista si mostra lo stesso, col suo nome", () => {
  /* Le modalità non sono un elenco chiuso — ognuno ha le sue — e meglio una
   * parola che non conosciamo che nessuna. */
  assert.equal(famigliaDelModo("night_time"), "");
  assert.equal(nomeDelModo("night_time"), "Night time");
  assert.equal(nomeDelModo("AWAY", "it"), "Fuori casa");
  assert.equal(nomeDelModo("AWAY", "en"), "Away");
});

test("un select si può cambiare, un sensore si legge e basta", () => {
  const scelta = letturaDelModo("select.tado_modo", TADO, "it");
  assert.equal(scelta.disponibile, true);
  assert.equal(scelta.nome, "In casa");
  assert.equal(scelta.cambiabile, true);
  assert.equal(scelta.scelte.length, 3);
  assert.equal(scelta.scelte[0].attuale, true);

  /* Un sensore che dice HOME non si può mettere su AWAY, e una pastiglia che
   * si preme senza fare niente è peggio di una che non si preme. */
  const letto = letturaDelModo("sensor.tado_modo", { state: "Fuori casa" }, "it");
  assert.equal(letto.disponibile, true);
  assert.equal(letto.nome, "Fuori casa");
  assert.equal(letto.cambiabile, false);
});

test("su un climate la modalità è il preset, non lo stato", () => {
  /* Lo stato di un termostato è «heat» — cioè cosa sta facendo — mentre la
   * modalità è il preset: leggere lo stato sarebbe la risposta a un'altra
   * domanda. */
  const lettura = letturaDelModo(
    "climate.salone",
    { state: "heat", attributes: { preset_mode: "boost", preset_modes: ["comfort", "eco", "boost"] } },
    "it",
  );
  assert.equal(lettura.valore, "boost");
  assert.equal(lettura.famiglia, "boost");
  assert.equal(lettura.servizio, "climate.set_preset_mode");
  assert.equal(lettura.campo, "preset_mode");
});

test("quello che dice «non lo so» non si disegna", () => {
  /* Un'integrazione che non ha ancora risposto non è una modalità: scrivere
   * «Unknown» sulla card sarebbe peggio di non scrivere niente. */
  assert.equal(letturaDelModo("sensor.x", { state: "unknown" }).disponibile, false);
  assert.equal(letturaDelModo("sensor.x", { state: "unavailable" }).disponibile, false);
  assert.equal(letturaDelModo("sensor.x", null).disponibile, false);
  assert.equal(letturaDelModo("", { state: "HOME" }).disponibile, false);
});

test("la chiamata si descrive, non si esegue", () => {
  /* Chi la esegue è chi ha la connessione: così «cosa succede se tocco questa
   * pastiglia» si prova a tavolino. */
  const lettura = letturaDelModo("select.tado_modo", TADO, "it");
  assert.deepEqual(chiamataDelModo(lettura, "AWAY"), {
    dominio: "select",
    servizio: "select_option",
    dati: { entity_id: "select.tado_modo", option: "AWAY" },
  });
  // Una modalità che quel select non offre non si manda.
  assert.equal(chiamataDelModo(lettura, "PARTY"), null);
  // E su un sensore non si manda niente.
  assert.equal(chiamataDelModo(letturaDelModo("sensor.m", { state: "HOME" }), "AWAY"), null);
});

test("con due modalità il tocco passa all'altra", () => {
  /* Un menu con due voci dentro è un passaggio in più per niente, ed è
   * esattamente il caso di TADO. */
  const due = letturaDelModo(
    "input_select.casa",
    { state: "HOME", attributes: { options: ["HOME", "AWAY"] } },
    "it",
  );
  assert.equal(prossimoModo(due), "AWAY");
  assert.equal(due.servizio, "input_select.select_option");
  // E dall'ultima si torna alla prima.
  const inFondo = letturaDelModo(
    "input_select.casa",
    { state: "AWAY", attributes: { options: ["HOME", "AWAY"] } },
    "it",
  );
  assert.equal(prossimoModo(inFondo), "HOME");
});
