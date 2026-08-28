/* Cambiare impianto rifa' il conto dei periodi, non solo i flussi.
 *
 * Giornaliera, Mensile e Report non nascono dagli stati: nascono da un
 * «bundle» che si chiede al registratore di Home Assistant. Chi lo chiede si
 * sveglia sull'evento di stato e guarda QUALE entita' e' cambiata —
 * `stateChangeAffectsEnergy` risponde no quando l'evento non ne porta nessuna.
 *
 * Cambiando impianto non cambia nessuna entita': cambia quali si leggono.
 * L'evento che la linguetta manda infatti non ne porta, quindi passava senza
 * che nessuno lo raccogliesse: il disegno ripartiva sulle caselle nuove senza
 * numeri dietro, e tutte e tre le linguette si azzeravano insieme finche' un
 * sensore qualunque della casa nuova non si muoveva da solo. «Si azzerano
 * tutte, non solo una linguetta.»
 *
 * Il conto vero ha bisogno del registratore, che in prova non c'e': quello che
 * si guarda qui e' la richiesta, cioe' l'anello che mancava.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { stateChangeAffectsEnergy } from "../src/sections/energy-section.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("un evento senza entita' non sveglia il conto dei periodi", () => {
  /* E' il caso della linguetta: nessuna entita' e' cambiata. */
  assert.equal(stateChangeAffectsEnergy({ detail: {} }), false);
  assert.equal(stateChangeAffectsEnergy(new CustomEvent("dashboardmodern:state-changed")), false);
});

test("la linguetta dell'impianto chiede il ricalcolo, non si affida all'evento", () => {
  const sezione = leggi("sections/energy-plants-section.js");
  assert.match(sezione, /import \{[^}]*scheduleEnergyRefresh[^}]*\} from "\.\/energy-section\.js"/);
  /* Dentro `scegli`, cioe' nel gesto che cambia impianto. */
  const scegli = sezione.slice(sezione.indexOf("function scegli("));
  const fine = scegli.indexOf("\n}\n");
  assert.match(scegli.slice(0, fine), /scheduleEnergyRefresh\(true\)/);
});

test("il conto dei periodi si puo' chiedere da fuori", async () => {
  const modulo = await import("../src/sections/energy-section.js");
  assert.equal(typeof modulo.scheduleEnergyRefresh, "function");
});
