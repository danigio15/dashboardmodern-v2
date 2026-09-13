/* «Ho configurato 2 contatori di energia, quando vado su report - analisi vedo
 *  il consumo mensile di tutti i dispositivi di entrambi i contatori, non solo
 *  del contatore selezionato.» (#527)
 *
 * Ha ragione, ed era l'ultimo posto rimasto indietro sugli impianti. Di quale
 * impianto sia un carico sta scritto addosso al carico da quando gli impianti
 * esistono, e il flusso lo guarda da sempre; il Report no — prendeva tutto — e
 * con due case sotto lo stesso tetto sommava le due, che è esattamente la cosa
 * che avere due contatori serve a non fare.
 *
 * Due cose da difendere, e la seconda è quella che si dimentica.
 *
 * La prima: chi non ha mai chiesto un secondo impianto non deve accorgersi che
 * questo codice esiste. Senza impianto l'elenco è quello di sempre, e un
 * carico senza il campo appartiene al primo — che è come otto carichi già
 * configurati restano dove sono il giorno in cui il campo compare.
 *
 * La seconda: cambiare linguetta deve cambiare l'elenco. Il guscio storico lo
 * tiene in una variabile costruita una volta, e la rifà al salvataggio di un
 * elettrodomestico — non al cambio di impianto, che non conosce. Senza quella
 * riga la correzione qui sotto si vedrebbe solo ricaricando la pagina.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { canonicalReportDevices } from "../src/core/energy-projection.js";
import { PRIMO_IMPIANTO, plantAt } from "../src/core/energy-plants.js";

/* Due case sotto lo stesso tetto: la prima è quella di sempre — id implicito,
 * carichi senza campo — e la seconda ha il suo. */
const DUE_IMPIANTI = Object.freeze({
  house: { total_energy: "sensor.casa_uno" },
  plants: [{ id: "impianto-2", name: "Di sopra", house: { total_energy: "sensor.casa_due" } }],
});

const CARICHI = Object.freeze([
  { id: "forno", name: "Forno", total_energy_entity: "sensor.forno_kwh" },
  { id: "lava", name: "Lavatrice", total_energy_entity: "sensor.lava_kwh", plant: "" },
  {
    id: "pompa",
    name: "Pompa di sopra",
    total_energy_entity: "sensor.pompa_kwh",
    plant: "impianto-2",
  },
]);

const nomi = (voci) => voci.map((voce) => voce.name).sort();

test("senza impianto l'elenco è quello di sempre", () => {
  /* La casa sola: chi non ha mai aperto quella schermata non passa di qui. */
  assert.deepEqual(nomi(canonicalReportDevices([], CARICHI)), [
    "Forno",
    "Lavatrice",
    "Pompa di sopra",
  ]);
});

test("col primo impianto scelto si vedono solo i suoi", () => {
  /* E «i suoi» comprende chi non ha il campo: un carico scritto prima che gli
   * impianti esistessero è della prima casa, non di nessuna. */
  const primo = plantAt(DUE_IMPIANTI, PRIMO_IMPIANTO);
  assert.deepEqual(nomi(canonicalReportDevices([], CARICHI, {}, primo)), ["Forno", "Lavatrice"]);
});

test("col secondo impianto scelto si vede solo il suo", () => {
  const secondo = plantAt(DUE_IMPIANTI, "impianto-2");
  assert.deepEqual(nomi(canonicalReportDevices([], CARICHI, {}, secondo)), ["Pompa di sopra"]);
});

test("e gli elettrodomestici seguono la stessa regola dei carichi", () => {
  /* Il Report nasce da due elenchi — apparecchi e carichi — e un apparecchio
   * dichiarato nella seconda casa non deve comparire nel report della prima.
   * La regola è una sola per tutti e due: `plantLoads`, la stessa del flusso. */
  const apparecchi = [
    { id: "asciu", name: "Asciugatrice", total_energy_entity: "sensor.asciu_kwh" },
    {
      id: "forno2",
      name: "Forno di sopra",
      total_energy_entity: "sensor.forno2_kwh",
      plant: "impianto-2",
    },
  ];
  const primo = plantAt(DUE_IMPIANTI, PRIMO_IMPIANTO);
  assert.deepEqual(nomi(canonicalReportDevices(apparecchi, [], {}, primo)), ["Asciugatrice"]);
  const secondo = plantAt(DUE_IMPIANTI, "impianto-2");
  assert.deepEqual(nomi(canonicalReportDevices(apparecchi, [], {}, secondo)), ["Forno di sopra"]);
});

test("il guscio chiede l'elenco dell'impianto che si sta guardando", () => {
  /* Il guscio storico chiama questa lista con due argomenti soli e di impianti
   * non sa niente: glielo si mette nel punto in cui la funzione pura incontra
   * la plancia viva, cioè dove la si pubblica. */
  const entry = readFileSync(new URL("../legacy/modules-entry.js", import.meta.url), "utf8");
  assert.match(entry, /const reportDelPiano = \(appliances, loads, states\) =>/);
  assert.match(entry, /plantAt\(store\.getSection\("energy"\) \|\| \{\}, impiantoAperto\(\)\)/);
  assert.match(entry, /canonicalReportDevices: reportDelPiano,/);
});

test("e cambiare linguetta rifà l'elenco", () => {
  /* Senza questa riga la correzione si vedrebbe solo ricaricando la pagina:
   * il guscio l'elenco lo tiene in una variabile presa una volta. */
  const sorgente = readFileSync(
    new URL("../src/sections/energy-plants-section.js", import.meta.url),
    "utf8",
  );
  assert.match(
    sorgente,
    /root\.cdRebuildReportDevices\?\.\(\);\s*\n\s*root\.buildReportSelect\?\.\(\);/,
  );
});
