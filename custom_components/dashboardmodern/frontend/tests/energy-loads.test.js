import test from "node:test";
import assert from "node:assert/strict";

import {
  migrateLegacyEnergyLoads,
  normalizeEnergyLoads,
} from "../src/core/migrations.js";

test("energy loads are deterministic, ordered and capped at eight", () => {
  const loads = normalizeEnergyLoads(
    Array.from({ length: 10 }, (_, index) => ({
      name: index < 2 ? "Pompa" : `Carico ${index}`,
      power_entity: `sensor.power_${index}`,
      order: 9 - index,
    })),
  );
  assert.equal(loads.length, 8);
  assert.equal(new Set(loads.map(({ id }) => id)).size, 8);
  assert.deepEqual(loads.map(({ order }) => order), [2, 3, 4, 5, 6, 7, 8, 9]);
});

test("fixed flow slots migrate once without deleting legacy values", () => {
  const overrides = {
    "dm.ev_potenza_wallbox": "sensor.wallbox_power",
    "dm.ev_energia_wallbox_oggi": "sensor.wallbox_total",
  };
  const migrated = migrateLegacyEnergyLoads([], overrides, { metadata: {} });
  assert.deepEqual(migrated, [
    {
      id: "energy-load-wb",
      name: "Wallbox",
      icon: "mdi:car-electric",
      power_entity: "sensor.wallbox_power",
      energy_entity: "sensor.wallbox_total",
      color: "#06b6d4",
      order: 0,
    },
  ]);
  assert.equal(overrides["dm.ev_potenza_wallbox"], "sensor.wallbox_power");
  assert.deepEqual(migrateLegacyEnergyLoads([], overrides, { metadata: { energy_loads_migrated: true } }), []);
});

/* Il testo dello stato di carica: «SOC 78%», col prefisso.
 *
 * Qui si pretendeva «78%», senza prefisso, e la casella lo diceva davvero —
 * ma solo per un istante: un altro modulo teneva un MutationObserver sul nodo
 * e ci rimetteva «SOC» addosso, un terzo lo riscriveva a modo suo, e il
 * guscio con un quarto formato. Sullo schermo il numero cambiava faccia da
 * solo. Adesso il padrone e' uno, e la forma e' quella che si vedeva piu'
 * spesso: «SOC» dice di cosa e' quella percentuale, che accanto a un numero
 * in watt non e' ovvio.
 *
 * Senza entita' configurata la casella non dice «—»: si toglie. Annunciare un
 * dato per dire che non ce l'hai e' peggio che non annunciarlo. */
test("lo stato di carica dice cos'e', e sparisce se non e' configurato", async () => {
  const { renderBatterySoc } = await import("../src/sections/energy-flow-section.js");
  const node = { textContent: "", hidden: false, dataset: {}, removeAttribute() {} };
  const document = { getElementById: (id) => (id === "v-battery-soc" ? node : null) };
  assert.equal(
    renderBatterySoc(
      document,
      { battery: { battery_soc_entity: "sensor.battery_soc" } },
      { "sensor.battery_soc": { state: "78" } },
    ),
    "78%",
  );
  assert.equal(node.textContent, "78%");
  assert.equal(node.hidden, false);

  // l'entita' risponde ma non con un numero: la casella resta, il valore no
  assert.equal(
    renderBatterySoc(
      document,
      { battery: { battery_soc_entity: "sensor.battery_soc" } },
      { "sensor.battery_soc": { state: "unavailable" } },
    ),
    "—",
  );

  // nessuna entita' configurata: la casella si toglie
  assert.equal(renderBatterySoc(document, { battery: {} }, {}), "—");
  assert.equal(node.hidden, true);
  assert.equal(node.textContent, "");
});
