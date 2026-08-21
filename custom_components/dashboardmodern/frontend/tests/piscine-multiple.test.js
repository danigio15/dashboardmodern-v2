import assert from "node:assert/strict";
import test from "node:test";

import {
  configuredPools,
  poolIsConfigured,
  poolList,
  poolRunKey,
  poolRunToday,
  poolTargetHours,
  storedPools,
} from "../src/core/pool-model.js";

test("una configurazione di sempre resta una piscina sola", () => {
  const stored = { tempEnt: "sensor.acqua", pumpEnt: "switch.pompa" };
  const elenco = poolList(stored);
  assert.equal(elenco.length, 1);
  assert.equal(elenco[0].tempEnt, "sensor.acqua");
  // I valori di partenza sono quelli che il runtime usa da sempre.
  assert.equal(elenco[0].phMin, 7);
  assert.equal(elenco[0].phMax, 7.6);
  assert.equal(elenco[0].filterStart, "09:00");
  assert.equal(elenco[0].autoHours, true);
});

test("le vasche in piu' stanno accanto alla prima, non al posto suo", () => {
  const stored = {
    tempEnt: "sensor.acqua",
    pools: [{ name: "Piccola", pumpEnt: "switch.pompa2" }],
  };
  const elenco = poolList(stored);
  assert.equal(elenco.length, 2);
  assert.equal(elenco[0].tempEnt, "sensor.acqua");
  assert.equal(elenco[1].name, "Piccola");
  assert.notEqual(elenco[0].id, elenco[1].id);
});

test("salvare non sposta la prima vasca da dove il runtime la cerca", () => {
  const prima = { tempEnt: "sensor.acqua", pumpEnt: "switch.pompa" };
  const salvato = storedPools(
    [
      { ...prima, name: "Grande" },
      { name: "Piccola", pumpEnt: "switch.pompa2" },
    ],
    prima,
  );
  // Il runtime vendorizzato legge questi campi in cima all'oggetto: se si
  // spostassero dentro un elenco, la prima piscina sparirebbe dalla plancia.
  assert.equal(salvato.tempEnt, "sensor.acqua");
  assert.equal(salvato.pumpEnt, "switch.pompa");
  assert.equal(salvato.name, "Grande");
  assert.equal(salvato.pools.length, 1);
  assert.equal(salvato.pools[0].name, "Piccola");
});

test("una sola vasca non lascia dietro un elenco vuoto", () => {
  const salvato = storedPools([{ tempEnt: "sensor.acqua" }], {});
  assert.equal("pools" in salvato, false);
});

test("cio' che non appartiene alle vasche resta dov'e'", () => {
  const salvato = storedPools([{ tempEnt: "sensor.acqua" }], { qualcosaDiFuturo: 42 });
  assert.equal(salvato.qualcosaDiFuturo, 42);
});

test("andata e ritorno non cambiano niente", () => {
  const stored = {
    tempEnt: "sensor.acqua",
    phEnt: "sensor.ph",
    pools: [{ id: "piscina-2", name: "Piccola", pumpEnt: "switch.pompa2" }],
  };
  assert.deepEqual(poolList(storedPools(poolList(stored), stored)), poolList(stored));
});

test("una vasca senza nessuna entita' non si disegna", () => {
  assert.equal(poolIsConfigured({}), false);
  assert.equal(poolIsConfigured({ name: "Vuota" }), false);
  assert.equal(poolIsConfigured({ lightEnt: "light.piscina" }), true);
});

test("l'elenco da disegnare tiene l'indice che la vasca aveva", () => {
  const stored = {
    pools: [{ name: "Piccola", pumpEnt: "switch.pompa2" }],
  };
  // La prima e' vuota: sparisce dal disegno ma la seconda resta la seconda,
  // perche' e' l'indice a dire dove si contano le sue ore.
  const mostrate = configuredPools(stored);
  assert.equal(mostrate.length, 1);
  assert.equal(mostrate[0].index, 1);
});

test("i secondi della prima vasca si contano dove si sono sempre contati", () => {
  assert.equal(poolRunKey({ id: "piscina" }, 0), "cd_pool_run");
  assert.equal(poolRunKey({ id: "piscina-2" }, 1), "cd_pool_run_piscina-2");
});

test("le ore in automatico sono meta' della temperatura, fra due e dodici", () => {
  const auto = { autoHours: true, filterHours: 8 };
  assert.equal(poolTargetHours(auto, 24), 12);
  assert.equal(poolTargetHours(auto, 30), 12);
  assert.equal(poolTargetHours(auto, 2), 2);
  assert.equal(poolTargetHours(auto, 21), 10.5);
  // Senza temperatura si torna alle ore fisse.
  assert.equal(poolTargetHours(auto, null), 8);
  assert.equal(poolTargetHours({ autoHours: false, filterHours: 5 }, 24), 5);
  assert.equal(poolTargetHours({ autoHours: false, filterHours: 0 }, 24), 8);
});

test("il conteggio riparte quando cambia il giorno", () => {
  assert.deepEqual(poolRunToday({ d: "oggi", s: 900 }, "oggi"), { d: "oggi", s: 900 });
  assert.deepEqual(poolRunToday({ d: "ieri", s: 900 }, "oggi"), { d: "oggi", s: 0 });
  assert.deepEqual(poolRunToday(null, "oggi"), { d: "oggi", s: 0 });
});
