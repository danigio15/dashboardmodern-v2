/* «Implementa una funzione cerca che possa cercare all'interno di tutto il
 * config quella parola, cosi' da velocizzare le modifiche e le
 * configurazioni.»
 *
 * La configurazione sta in una novantina di caselle e venti schede, e ogni
 * scheda si disegna solo quando la si apre: per sapere dove sta scritto un
 * sensore bisognava aprirle tutte. Queste prove fissano cosa deve trovare una
 * ricerca perche' serva davvero: il nome, l'entita', il campo — e la strada
 * per arrivarci.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { appiattisci, cercaNelConfig } from "../src/core/cerca-nel-config.js";

const MAGAZZINO = Object.freeze({
  /* `cd_luci` tiene l'entita' nel NOME del campo e il nome della luce nel
   * valore: cercare solo fra i valori vorrebbe dire non trovare mai una luce
   * per entity_id. */
  cd_luci: { "light.salone": "Salone", "light.frigo_led": "Led del frigo" },
  cd_appliances: [
    { id: "a1", name: "Lavatrice", total_energy_entity: "sensor.lavatrice_kwh" },
    { id: "a2", name: "Frigorifero", total_energy_entity: "sensor.frigo_kwh" },
  ],
  cd_stanze: [{ id: "r1", name: "Città vecchia" }],
  cd_entity_overrides: { "dm.ev_cavo_collegato": "binary_sensor.cavo" },
});

test("una parola si trova sia nel nome sia nell'entita'", () => {
  const esiti = cercaNelConfig("frigo", MAGAZZINO);
  const dove = esiti.map((voce) => `${voce.chiave}|${voce.campo}|${voce.testo}`);
  assert.ok(dove.includes("cd_luci|light.frigo_led|Led del frigo"), "la luce per entity_id");
  assert.ok(dove.includes("cd_appliances|name|Frigorifero"), "l'elettrodomestico per nome");
  assert.ok(
    dove.includes("cd_appliances|total_energy_entity|sensor.frigo_kwh"),
    "e il suo contatore",
  );
});

test("il risultato dice in quale riga sta, non un numero", () => {
  const [primo] = cercaNelConfig("lavatrice_kwh", MAGAZZINO);
  assert.equal(primo.chiave, "cd_appliances");
  /* «la seconda riga di cd_appliances» non aiuta nessuno: la riga si chiama
   * col suo nome. */
  assert.equal(primo.dove, "Lavatrice");
  assert.equal(primo.campo, "total_energy_entity");
});

test("gli accenti non contano: «citta» trova «Città»", () => {
  assert.equal(appiattisci("Città"), "citta");
  assert.equal(cercaNelConfig("citta", MAGAZZINO).length, 1);
});

test("sotto le due lettere non si cerca", () => {
  /* Un elenco di trecento righe non e' una risposta: si aspetta che chi
   * scrive abbia detto abbastanza. */
  assert.deepEqual(cercaNelConfig("a", MAGAZZINO), []);
  assert.deepEqual(cercaNelConfig("", MAGAZZINO), []);
  assert.deepEqual(cercaNelConfig("  ", MAGAZZINO), []);
});

test("lo stesso posto non si conta due volte", () => {
  const esiti = cercaNelConfig("cavo", MAGAZZINO);
  const firme = new Set(esiti.map((voce) => voce.firma));
  assert.equal(firme.size, esiti.length);
  /* La casella delle mappature ha l'ago in tutti e due i lati — nel nome del
   * campo e nel valore — e resta un risultato solo. */
  assert.equal(esiti.length, 1);
});

test("un magazzino vuoto o rotto non fa cadere niente", () => {
  assert.deepEqual(cercaNelConfig("frigo", {}), []);
  assert.deepEqual(cercaNelConfig("frigo", null), []);
  assert.deepEqual(cercaNelConfig("frigo", { cd_luci: null, cd_stanze: undefined }), []);
});

test("chi combacia dall'inizio esce prima", () => {
  const magazzino = { cd_stanze: [{ name: "La camera degli ospiti" }, { name: "Camera" }] };
  const esiti = cercaNelConfig("camera", magazzino);
  assert.equal(esiti[0].testo, "Camera");
  assert.equal(esiti[1].testo, "La camera degli ospiti");
});
