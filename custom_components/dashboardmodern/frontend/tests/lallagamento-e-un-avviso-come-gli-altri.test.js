/* Gli allagamenti, accanto agli altri avvisi.
 *
 * Il Quadro Avvisi sorvegliava cinque liste — Aperture, Batterie, Luci, Clima
 * e Riscaldamento — e chi ha un sensore di allagamento sotto il lavello non
 * aveva dove metterlo: restava un avviso «personalizzato», con l'icona da
 * scegliere a mano e fuori dal conteggio delle altre. Chiesto piu' volte, e
 * giustamente: una perdita d'acqua non e' il caso particolare di qualcun
 * altro.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FLOOD_GROUP,
  countWet,
  floodEntities,
  floodIsWet,
  isFloodSensor,
} from "../src/sections/flood-alerts-section.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

const bagnato = { state: "on", attributes: { device_class: "moisture" } };
const asciutto = { state: "off", attributes: { device_class: "moisture" } };

test("un sensore di allagamento e' quello che Home Assistant dichiara tale", () => {
  assert.equal(isFloodSensor("binary_sensor.perdita_lavello", asciutto), true);
  // La classe la dice Home Assistant: non si indovina dal nome.
  assert.equal(isFloodSensor("binary_sensor.allagamento_cantina", { attributes: {} }), false);
  // E resta un binary_sensor: un `sensor.` con la stessa classe non e' questo.
  assert.equal(isFloodSensor("sensor.umidita", bagnato), false);
});

test("bagnato e' `on`, come per ogni binary_sensor", () => {
  assert.equal(floodIsWet(bagnato), true);
  assert.equal(floodIsWet(asciutto), false);
  assert.equal(floodIsWet(undefined), false);
});

test("il primo avvio si serve da solo dai sensori dichiarati", () => {
  const states = {
    "binary_sensor.perdita_lavello": asciutto,
    "binary_sensor.perdita_caldaia": bagnato,
    "binary_sensor.porta_ingresso": { state: "off", attributes: { device_class: "door" } },
    "light.cucina": { state: "on", attributes: {} },
  };
  const { entities, primoAvvio } = floodEntities({}, {}, states);
  assert.equal(primoAvvio, true);
  assert.deepEqual(entities, ["binary_sensor.perdita_lavello", "binary_sensor.perdita_caldaia"]);
});

test("una volta configurata, la lista e' dell'utente", () => {
  const states = { "binary_sensor.perdita_caldaia": bagnato, "binary_sensor.altro": asciutto };
  const extras = { [FLOOD_GROUP]: ["binary_sensor.perdita_caldaia"] };
  const { entities, primoAvvio } = floodEntities(extras, {}, states);
  assert.equal(primoAvvio, false, "non e' piu' il primo avvio");
  assert.deepEqual(entities, ["binary_sensor.perdita_caldaia"], "non si ripopola da sola");
});

test("chi la svuota la ritrova vuota", () => {
  /* Il difetto classico di chi rileva da solo: si toglie una voce, si ricarica
   * e la si ritrova. La lista vuota e' una scelta, non un vuoto da riempire. */
  const states = { "binary_sensor.perdita_caldaia": bagnato };
  const { entities } = floodEntities({ [FLOOD_GROUP]: [] }, {}, states);
  assert.deepEqual(entities, []);
});

test("quello che si toglie resta tolto", () => {
  const states = { "binary_sensor.a": bagnato, "binary_sensor.b": asciutto };
  const { entities } = floodEntities(
    { [FLOOD_GROUP]: ["binary_sensor.a", "binary_sensor.b"] },
    { [FLOOD_GROUP]: ["binary_sensor.a"] },
    states,
  );
  assert.deepEqual(entities, ["binary_sensor.b"]);
});

test("lo stesso sensore scritto due volte esce una volta sola", () => {
  const { entities } = floodEntities(
    { [FLOOD_GROUP]: ["binary_sensor.a", " binary_sensor.a ", ""] },
    {},
    {},
  );
  assert.deepEqual(entities, ["binary_sensor.a"]);
});

test("il contatore conta i bagnati, non i configurati", () => {
  const states = { "binary_sensor.a": bagnato, "binary_sensor.b": asciutto };
  assert.equal(countWet(["binary_sensor.a", "binary_sensor.b"], states), 1);
  assert.equal(countWet([], states), 0);
  // Un sensore configurato che Home Assistant non conosce non conta.
  assert.equal(countWet(["binary_sensor.sparito"], states), 0);
});

test("il gruppo si sceglie dove si scelgono gli altri", () => {
  const editor = leggi("sections/alerts-section.js");
  assert.match(editor, /\["allag", "💧"/, "la voce manca nell'editor degli avvisi");
});

test("la sezione e' installata insieme agli altri avvisi", () => {
  const runtime = leggi("sections/section-runtime.js");
  assert.match(runtime, /installFloodAlertsSection\(\)/, "non viene installata");
  assert.match(runtime, /"flood-alerts"/, "non e' dichiarata fra le sezioni");
  // Dopo chi possiede l'editor degli avvisi, o la voce nel menu non trova posto.
  assert.ok(
    runtime.indexOf("installFloodAlertsSection()") > runtime.indexOf("installAlertsSection()"),
    "va installata dopo l'editor degli avvisi",
  );
});
