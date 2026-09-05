/* Il travaso già scritto nella configurazione.
 *
 * La perdita è stata fermata dove nasceva; quello che era già finito nei
 * carichi resta lì. Questo giro lo toglie — ma solo dove si sa dimostrare chi
 * è la copia, perché due carichi con lo stesso sensore non dicono da soli
 * quale dei due è l'originale: lo specchio veniva riscritto da chi salvava per
 * ultimo, quindi il travaso è andato in tutte e due le direzioni, e nome,
 * icona e posizione della copia diventano identici all'originale.
 *
 * Una cosa lo specchio NON la portava: il contatore totale, quello di oggi,
 * quello del mese. Quelli il carico se li è tenuti suoi — ed è lì che si vede
 * la vittima: chi ha il contatore `sensor.pompa_kwh` e la potenza
 * `sensor.boiler_w` sta raccontando due macchine diverse.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  carichiTravasati,
  radiceDellEntita,
  togliLePotenzeTravasate,
} from "../src/core/carichi-travasati.js";

const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));

const SPECCHIO = { boiler: { name: "Boiler casa sotto", icon: "🔥", pwr: "sensor.boiler_w" } };

test("la radice dice di quale macchina parla un'entità", () => {
  assert.equal(radiceDellEntita("sensor.boiler_potenza"), "boiler");
  assert.equal(radiceDellEntita("sensor.boiler_kwh"), "boiler");
  assert.equal(radiceDellEntita("sensor.boiler_energia_oggi"), "boiler");
  assert.equal(radiceDellEntita("sensor.pompa_di_calore_w"), "pompa_di_calore");
  /* Un'entità fatta di sola coda non si riduce a niente: resterebbe una radice
   * vuota che somiglia a tutte le altre. */
  assert.equal(radiceDellEntita("sensor.power"), "power");
  assert.equal(radiceDellEntita(""), "");
});

test("la vittima si riconosce dai contatori che si è tenuti", () => {
  const carichi = [
    {
      id: "boiler",
      plant: "",
      power_entity: "sensor.boiler_w",
      total_energy_entity: "sensor.boiler_kwh",
    },
    {
      id: "pompa",
      plant: "impianto-2",
      power_entity: "sensor.boiler_w",
      total_energy_entity: "sensor.pompa_kwh",
    },
  ];
  const trovati = carichiTravasati({ loads: carichi, flowNodes: SPECCHIO });
  const vittima = trovati.find((voce) => voce.id === "pompa");
  const originale = trovati.find((voce) => voce.id === "boiler");
  assert.equal(vittima.certo, true);
  assert.deepEqual(vittima.altri, [""]);
  /* E l'originale non viene toccato: il suo contatore parla della sua macchina. */
  assert.equal(originale.certo, false);
  assert.deepEqual(
    togliLePotenzeTravasate(carichi, SPECCHIO).map((load) => [load.id, load.power_entity]),
    [
      ["boiler", "sensor.boiler_w"],
      ["pompa", ""],
    ],
  );
});

test("senza il segno non si cancella niente, e si resta in dubbio", () => {
  /* Due carichi con la sola potenza compilata: identici a guardarli. Qui la
   * plancia non può sapere in quale appartamento sta quel sensore, e
   * cancellare a caso butterebbe la metà buona. */
  const carichi = [
    { id: "boiler", plant: "", power_entity: "sensor.boiler_w" },
    { id: "pompa", plant: "impianto-2", power_entity: "sensor.boiler_w" },
  ];
  const trovati = carichiTravasati({ loads: carichi, flowNodes: SPECCHIO });
  assert.equal(trovati.length, 2);
  assert.equal(
    trovati.every((voce) => voce.certo === false),
    true,
  );
  assert.deepEqual(togliLePotenzeTravasate(carichi, SPECCHIO), carichi);
});

test("un doppione che lo specchio non spiega non è affar nostro", () => {
  /* Due cerchi che guardano la stessa presa e non passano dallo specchio: è
   * una scelta di chi configura, non un difetto, e non si tocca. */
  const carichi = [
    { id: "a", plant: "", power_entity: "sensor.presa_w", total_energy_entity: "sensor.a_kwh" },
    {
      id: "b",
      plant: "impianto-2",
      power_entity: "sensor.presa_w",
      total_energy_entity: "sensor.b_kwh",
    },
  ];
  assert.deepEqual(carichiTravasati({ loads: carichi, flowNodes: SPECCHIO }), []);
  assert.deepEqual(togliLePotenzeTravasate(carichi, SPECCHIO), carichi);
});

test("lo stesso sensore due volte nello STESSO impianto è una scelta", () => {
  /* Due cerchi della stessa casa possono guardare la stessa presa. Il travaso
   * è fra case diverse, e solo quello. */
  const carichi = [
    { id: "a", plant: "", power_entity: "sensor.boiler_w", total_energy_entity: "sensor.a_kwh" },
    { id: "b", plant: "", power_entity: "sensor.boiler_w", total_energy_entity: "sensor.b_kwh" },
  ];
  assert.deepEqual(carichiTravasati({ loads: carichi, flowNodes: SPECCHIO }), []);
});

test("senza specchio non c'è niente da guardare", () => {
  const carichi = [
    { id: "a", plant: "", power_entity: "sensor.boiler_w" },
    { id: "b", plant: "impianto-2", power_entity: "sensor.boiler_w" },
  ];
  assert.deepEqual(carichiTravasati({ loads: carichi, flowNodes: null }), []);
  assert.deepEqual(carichiTravasati({ loads: carichi, flowNodes: "niente" }), []);
  assert.deepEqual(carichiTravasati({}), []);
});

test("il segno della pulizia si mette dopo il salvataggio, non prima", () => {
  /* Scrivendolo prima, un salvataggio che non va a buon fine — la cassetta
   * condivisa che non risponde — lasciava il segno E il travaso: il giro non
   * ci riprovava mai più su quel dispositivo, e chi chiama la rifiuta senza
   * rumore. */
  const sorgente = readFileSync(
    join(RADICE, "src/sections/energy-loads-editor-section.js"),
    "utf8",
  );
  const dove = sorgente.indexOf("export async function pulisciIlTravasoUnaVolta");
  const corpo = sorgente.slice(dove, sorgente.indexOf("\n}", dove));
  const salvataggio = corpo.indexOf('replaceSection("loads", puliti)');
  const segno = corpo.lastIndexOf(`setItem(PULIZIA_TRAVASO_KEY, "1")`);
  assert.ok(salvataggio > 0 && segno > salvataggio);
  /* E due porte che chiamano insieme non fanno partire due salvataggi. */
  assert.match(corpo, /if \(state\.pulizia\) return state\.pulizia;/);
});
