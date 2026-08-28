/* Una scrittura di Energia resta nella casa che si sta guardando.
 *
 * L'oggetto salvato tiene il PRIMO impianto al primo livello e gli altri in un
 * elenco accanto. Scrivere «al primo livello» vuol dire quindi scrivere nella
 * prima casa, sempre: tre giri lo facevano — il salvataggio dei campi (gia'
 * sistemato), lo svuotamento dei campi di periodo e il riconoscimento
 * automatico. Con la seconda casa davanti agli occhi, quei due ultimi
 * cancellavano o riempivano l'altra, e la maschera restava com'era.
 *
 * Qui si guarda il posatore, che e' l'unico che sa dove va una scrittura.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { plantList } from "../src/core/energy-plants.js";
import { scriviNellImpianto } from "../src/core/energy-writer.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

const DUE_CASE = Object.freeze({
  id: "impianto",
  name: "Casa",
  metadata: { plant_seq: 2 },
  house: { power: "sensor.casa" },
  grid: { power: "sensor.rete", daily_energy_entity: "sensor.rete_giorno" },
  solar: {},
  battery: {},
  plants: [
    {
      id: "impianto-2",
      name: "Capanno",
      metadata: {},
      house: { power: "sensor.capanno" },
      grid: { power: "sensor.capanno_rete", daily_energy_entity: "sensor.capanno_giorno" },
      solar: {},
      battery: {},
    },
  ],
});

test("scrivere nel secondo impianto non tocca il primo", () => {
  const dopo = scriviNellImpianto(structuredClone(DUE_CASE), "impianto-2", (bersaglio) => {
    bersaglio.solar = { ...(bersaglio.solar || {}), power: "sensor.capanno_solare" };
  });
  const lista = plantList(dopo);
  assert.equal(lista[0].house.power, "sensor.casa");
  assert.equal(lista[0].solar.power, undefined);
  assert.equal(lista[1].solar.power, "sensor.capanno_solare");
  assert.equal(lista[1].house.power, "sensor.capanno");
});

test("svuotare un campo del secondo impianto lascia intatto quello del primo", () => {
  const dopo = scriviNellImpianto(structuredClone(DUE_CASE), "impianto-2", (bersaglio) => {
    bersaglio.grid = { ...(bersaglio.grid || {}), daily_energy_entity: "" };
  });
  const lista = plantList(dopo);
  assert.equal(lista[0].grid.daily_energy_entity, "sensor.rete_giorno");
  assert.equal(lista[1].grid.daily_energy_entity, "");
});

test("senza impianto scelto si scrive dove si e' sempre scritto: il primo", () => {
  const dopo = scriviNellImpianto(structuredClone(DUE_CASE), "", (bersaglio) => {
    bersaglio.solar = { ...(bersaglio.solar || {}), power: "sensor.casa_solare" };
  });
  const lista = plantList(dopo);
  assert.equal(lista[0].solar.power, "sensor.casa_solare");
  assert.equal(lista[1].solar.power, undefined);
});

test("i due giri che scrivevano al primo livello adesso passano dal posatore", () => {
  for (const modulo of [
    "sections/energy-guidance-section.js",
    "sections/entity-autodetect-section.js",
  ]) {
    const sorgente = leggi(modulo);
    assert.match(sorgente, /scriviNellImpianto\(/, modulo);
    assert.match(sorgente, /impiantoScelto\(\)/, modulo);
  }
});
