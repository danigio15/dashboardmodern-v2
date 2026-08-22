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

/* Una voce che entra deve poter uscire.
 *
 * L'elenco degli avvisi lo stampa il runtime da una mappa di gruppi scritta a
 * mano che si ferma ai suoi cinque: un allagamento salvato contava nel quadro e
 * si apriva nel popup, ma dalla configurazione spariva — non si poteva piu'
 * rinominare, e soprattutto non si poteva piu' togliere.
 */
test("la configurazione stampa le righe degli allagamenti", () => {
  const sezione = leggi("sections/flood-alerts-section.js");
  assert.match(sezione, /ensureFloodEditorRows/, "le righe non vengono stampate");
  assert.match(sezione, /data-dm-flood-del/, "manca il cestino");
  // Il cestino e' quello del runtime: sa distinguere una voce aggiunta da una
  // arrivata da sola, e riscriverlo a mano vorrebbe dire sbagliarlo.
  assert.match(sezione, /edDelAvviso\?\.\(FLOOD_GROUP, id\)/, "il cestino non riusa quello vero");
});

/* Togliere l'ultimo non fa ripartire il rilevamento.
 *
 * «La lista non c'e' ancora» sembrava il modo naturale di dire «non ho ancora
 * guardato», ma il runtime cancella la chiave quando resta vuota: al
 * ricaricamento successivo il rilevamento sarebbe ripartito rimettendo dentro
 * proprio quello che era stato tolto.
 */
test("tolto l'ultimo, non ne ricompaiono", () => {
  const states = { "binary_sensor.perdita": bagnato };
  // La chiave e' sparita col cestino, ma il primo giro e' gia' stato fatto.
  const { entities, primoAvvio } = floodEntities({}, {}, states, true);
  assert.deepEqual(entities, [], "il rilevamento e' ripartito da solo");
  assert.equal(primoAvvio, false);
});

test("ma al primissimo avvio guarda ancora", () => {
  const states = { "binary_sensor.perdita": bagnato };
  const { entities, primoAvvio } = floodEntities({}, {}, states, false);
  assert.deepEqual(entities, ["binary_sensor.perdita"]);
  assert.equal(primoAvvio, true, "il primo giro va segnato");
});

/* «Ho guardato» si puo' dire solo se c'era qualcosa da guardare.
 *
 * La passata gira anche prima che gli stati di Home Assistant siano arrivati, e
 * li' l'elenco delle entita' e' vuoto per forza. Segnarsi il giro in quel
 * momento voleva dire non rilevare mai piu' niente, su nessuna casa: il
 * sensore di allagamento non sarebbe mai comparso da solo.
 */
test("col registro vuoto non si e' guardato, si e' solo passati di li'", () => {
  const sezione = leggi("sections/flood-alerts-section.js");
  assert.match(
    sezione,
    /primoAvvio && Object\.keys\(states\)\.length/,
    "il segno si mette anche senza stati",
  );
});

test("e gli stati arrivati dopo vengono comunque visti", () => {
  // Con il segno non ancora messo, la passata successiva rileva.
  const states = { "binary_sensor.perdita": bagnato };
  assert.deepEqual(floodEntities({}, {}, {}, false).entities, [], "senza stati non trova niente");
  assert.deepEqual(floodEntities({}, {}, states, false).entities, ["binary_sensor.perdita"]);
});
