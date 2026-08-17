// DM-FIX-20260817B
import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_FLOW_LOADS,
  emptyLoad,
  emptySubload,
  loadConfigSummary,
  loadConfigWarnings,
  loadGroupId,
  loadsConfigModel,
  loadsConfigToSections,
  moveLoad,
} from "../src/core/energy-loads-config.js";

/* An installation configured the old way: five fixed circles in `cd_flow_nodes`
 * pointing at groups, the groups and their appliances in the two legacy keys,
 * and the canonical section holding the same appliances again. */
const LEGACY_FLOW_NODES = {
  boiler: { name: "Boiler", icon: "♨️", color: "#ea580c", group: "", pwr: "sensor.boiler_power" },
  wb: { name: "Wallbox", icon: "🚗", color: "#06b6d4", group: "", pwr: "" },
  clima: { enabled: false },
  lav: { name: "Lavanderia", icon: "🧺", color: "#7c3aed", group: "lavanderia" },
};

const LEGACY_GROUPS = [
  { id: "lavanderia", name: "Lavanderia", icon: "🧺", color: "#7c3aed" },
  { id: "cucina", name: "Cucina", icon: "🍳", color: "#f97316" },
];

const LEGACY_SUBLOADS = {
  lavanderia: [{ id: "sub-washer", name: "Lavatrice", icon: "🧺", pwr: "sensor.washer_power" }],
};

const CANONICAL = [
  { id: "boiler", name: "Boiler", order: 0, power_entity: "sensor.boiler_power", total_energy_entity: "sensor.boiler_total" },
  { id: "wallbox", name: "Wallbox", order: 1, power_entity: "sensor.wb_power" },
  { id: "clima", name: "Clima", order: 2, power_entity: "sensor.clima_power" },
  { id: "lavanderia", name: "Lavanderia", order: 3, power_entity: "sensor.laundry_power" },
  {
    id: "sub-dryer",
    name: "Asciugatrice",
    power_entity: "sensor.dryer_power",
    total_energy_entity: "sensor.dryer_total",
    metadata: { beta27_subload_group: "lavanderia" },
  },
];

test("an existing configuration lands in one list without the user retyping it", () => {
  const model = loadsConfigModel({
    loads: CANONICAL,
    flowNodes: LEGACY_FLOW_NODES,
    groups: LEGACY_GROUPS,
    subloads: LEGACY_SUBLOADS,
  });

  // Four circles, in flow order; the appliances are inside them, not alongside.
  assert.deepEqual(
    model.map(({ id, name }) => [id, name]),
    [
      ["boiler", "Boiler"],
      ["wallbox", "Wallbox"],
      ["clima", "Clima"],
      ["lavanderia", "Lavanderia"],
    ],
  );
  assert.deepEqual(model.map(({ order }) => order), [0, 1, 2, 3]);

  // The circle customization is now part of the load it described.
  assert.equal(model[0].icon, "♨️");
  assert.equal(model[0].color, "#ea580c");
  assert.equal(model[1].icon, "🚗");
  // A circle switched off in the old editor stays switched off.
  assert.equal(model[2].visible, false);
  assert.equal(model[0].visible, true);

  // Appliances come from the canonical section and from the legacy popup, once.
  assert.deepEqual(
    model[3].children.map(({ id, name, power }) => [id, name, power]),
    [
      ["sub-dryer", "Asciugatrice", "sensor.dryer_power"],
      ["sub-washer", "Lavatrice", "sensor.washer_power"],
    ],
  );
  assert.deepEqual(model[0].children, []);
});

test("a load carries its own entities, with the total meter as the period source", () => {
  const model = loadsConfigModel({ loads: CANONICAL, flowNodes: LEGACY_FLOW_NODES });
  assert.equal(model[0].power, "sensor.boiler_power");
  assert.equal(model[0].total, "sensor.boiler_total");
  assert.equal(model[0].daily, "");
  assert.equal(model[0].monthly, "");
});

test("saving writes the canonical section and re-derives the legacy popup keys", () => {
  const model = loadsConfigModel({
    loads: CANONICAL,
    flowNodes: LEGACY_FLOW_NODES,
    groups: LEGACY_GROUPS,
    subloads: LEGACY_SUBLOADS,
  });
  const { loads, groups, subloads, flowNodes } = loadsConfigToSections(model, CANONICAL);

  const parents = loads.filter((item) => item.show_in_dashboard !== false);
  assert.deepEqual(
    parents.map(({ id, order }) => [id, order]),
    [
      ["boiler", 0],
      ["wallbox", 1],
      ["lavanderia", 3],
    ],
  );
  // The hidden circle is still a load, only not shown on the stage.
  assert.equal(loads.find((item) => item.id === "clima").show_in_dashboard, false);

  // Appliances stay canonical loads, tied to their parent's group.
  const dryer = loads.find((item) => item.id === "sub-dryer");
  assert.equal(dryer.metadata.beta27_subload_group, "lavanderia");
  assert.equal(dryer.show_in_dashboard, false);
  assert.equal(dryer.total_energy_entity, "sensor.dryer_total");

  // The mirrors the hosted popup reads are rewritten from the same model.
  assert.deepEqual(
    subloads.lavanderia.map(({ id, pwr }) => [id, pwr]),
    [
      ["sub-dryer", "sensor.dryer_power"],
      ["sub-washer", "sensor.washer_power"],
    ],
  );
  assert.ok(groups.some((group) => group.id === "lavanderia" && group.name === "Lavanderia"));
  assert.equal(flowNodes.boiler.name, "Boiler");
  assert.equal(flowNodes.clima.enabled, false);
});

test("a save never drops fields this editor does not show", () => {
  const previous = [
    {
      id: "boiler",
      name: "Boiler",
      order: 0,
      power_entity: "sensor.boiler_power",
      threshold_run: 12,
      price_kwh: 0.31,
      show_in_report: false,
    },
    { id: "report-row", name: "Stima", category: "manual-report", order: 9 },
  ];
  const model = loadsConfigModel({ loads: previous });
  const { loads } = loadsConfigToSections(model, previous);
  const boiler = loads.find((item) => item.id === "boiler");
  assert.equal(boiler.threshold_run, 12);
  assert.equal(boiler.price_kwh, 0.31);
  assert.equal(boiler.show_in_report, false);
  // Manual report rows were never editable here and must survive the write.
  assert.ok(loads.some((item) => item.id === "report-row"));
});

test("the round trip is stable: saving twice changes nothing", () => {
  const first = loadsConfigToSections(
    loadsConfigModel({
      loads: CANONICAL,
      flowNodes: LEGACY_FLOW_NODES,
      groups: LEGACY_GROUPS,
      subloads: LEGACY_SUBLOADS,
    }),
    CANONICAL,
  );
  const second = loadsConfigToSections(
    loadsConfigModel({
      loads: first.loads,
      flowNodes: first.flowNodes,
      groups: first.groups,
      subloads: first.subloads,
    }),
    first.loads,
  );
  assert.deepEqual(second.loads, first.loads);
  assert.deepEqual(second.subloads, first.subloads);
});

test("adding, reordering and removing a load keeps the list contiguous", () => {
  let model = loadsConfigModel({ loads: CANONICAL });
  const added = emptyLoad(model);
  model = [...model, added];
  assert.equal(added.group, added.id, "a new load groups under itself, with nothing to bind");

  model = moveLoad(model, added.id, -1);
  assert.equal(model[3].id, added.id);
  assert.deepEqual(model.map(({ order }) => order), [0, 1, 2, 3, 4]);

  model = moveLoad(model, model[0].id, -1);
  assert.equal(model[0].id, "boiler", "the first load cannot move above itself");

  const { loads } = loadsConfigToSections(
    model.filter((item) => item.id !== "clima"),
    CANONICAL,
  );
  assert.equal(loads.some((item) => item.id === "clima"), false);
});

test("the flow cap is the same eight the stage draws", () => {
  const many = Array.from({ length: 12 }, (_, index) => ({
    id: `load-${index}`,
    name: `Carico ${index}`,
    order: index,
    power_entity: `sensor.p${index}`,
  }));
  assert.equal(loadsConfigModel({ loads: many }).length, MAX_FLOW_LOADS);
  assert.equal(loadsConfigToSections(loadsConfigModel({ loads: many }), many).loads.length, MAX_FLOW_LOADS);
});

test("a new appliance is created inside its load, never loose", () => {
  const load = { id: "cucina", children: [] };
  const child = emptySubload(load);
  assert.match(child.id, /^cucina-sub-1$/);
  load.children.push(child);
  const { loads } = loadsConfigToSections([{ ...load, name: "Cucina", group: "cucina" }], []);
  assert.equal(loads[1].metadata.beta27_subload_group, "cucina");
});

test("the group id of a migrated load is preserved, a new one groups under itself", () => {
  assert.equal(loadGroupId({ id: "x", metadata: { beta27_subload_group: "cucina" } }), "cucina");
  assert.equal(loadGroupId({ id: "carico-3" }), "carico-3");
});

test("each card says what it is bound to and what is still missing", () => {
  const bound = { power: "sensor.p", total: "sensor.t", children: [{ id: "a" }] };
  assert.equal(loadConfigSummary(bound), "potenza · contatore totale · 1 dispositivo");
  assert.equal(loadConfigWarnings(bound).length, 0);

  assert.equal(loadConfigSummary({}), "nessuna entità");
  // Nothing bound is said once, not split across overlapping complaints.
  const empty = loadConfigWarnings({});
  assert.equal(empty.length, 1);
  assert.match(empty[0], /cerchio resta vuoto/);

  // A load with only a total meter is complete: the period is derived from it.
  assert.equal(loadConfigWarnings({ power: "sensor.p", total: "sensor.t" }).length, 0);
  // Energy but no power: the Instant view has nothing to draw.
  assert.match(loadConfigWarnings({ total: "sensor.t" })[0], /Manca la potenza/);
  assert.equal(loadConfigSummary({ power: "sensor.p" }, "en"), "power");
});
