// DM-FIX-20260817A
import assert from "node:assert/strict";
import test from "node:test";

import {
  FLOW_MAX_LOADS,
  flowIntensity,
  flowNodeScale,
  flowPeriodEntity,
  flowRecorderEntity,
  flowStageLayout,
  flowStageLoads,
  isWallboxLoad,
  flowStageModel,
  formatFlowValue,
} from "../src/core/energy-flow-topology.js";

function load(id, overrides = {}) {
  return {
    id,
    name: id,
    power_entity: `sensor.${id}_power`,
    daily_energy_entity: `sensor.${id}_day`,
    monthly_energy_entity: `sensor.${id}_month`,
    order: 0,
    ...overrides,
  };
}

function loads(count) {
  return Array.from({ length: count }, (_, index) => load(`load${index + 1}`, { order: index }));
}

test("the stage takes every visible load in order, up to eight", () => {
  const stage = flowStageLoads([
    load("hidden", { show_in_dashboard: false, order: 0 }),
    load("report", { category: "manual-report", order: 1 }),
    { id: "empty", order: 2 },
    load("third", { order: 3 }),
    load("first", { order: 1 }),
    load("second", { order: 2 }),
  ]);
  assert.deepEqual(
    stage.map(({ id }) => id),
    ["first", "second", "third"],
  );
  assert.equal(flowStageLoads(loads(12)).length, FLOW_MAX_LOADS);
});

test("desktop keeps one evenly spaced row and anchors every connector on Home", () => {
  const five = flowStageLayout(5, "desktop");
  assert.deepEqual(
    five.map(({ left }) => left),
    [16.667, 33.333, 50, 66.667, 83.333],
  );
  assert.ok(five.every(({ top, row }) => top === 83 && row === 0));
  assert.ok(five.every(({ path }) => path.startsWith("M 500 365 ")));
  // The centre bubble sits straight below Home, so it takes a line, not a curve.
  assert.equal(five[2].path, "M 500 365 L 500 445");
  assert.match(five[0].path, /^M 500 365 Q 166\.7 405 166\.7 445$/);

  const eight = flowStageLayout(8, "desktop");
  assert.equal(eight.length, 8);
  assert.ok(eight.every(({ row }) => row === 0));
  const lefts = eight.map(({ left }) => left);
  assert.deepEqual(
    [...lefts].sort((a, b) => a - b),
    lefts,
  );
});

test("mobile wraps onto a second row instead of crushing eight bubbles into one", () => {
  assert.deepEqual(
    flowStageLayout(3, "mobile").map(({ row, top }) => [row, top]),
    [
      [0, 68],
      [0, 68],
      [0, 68],
    ],
  );
  const eight = flowStageLayout(8, "mobile");
  assert.deepEqual(
    eight.map(({ row }) => row),
    [0, 0, 0, 0, 1, 1, 1, 1],
  );
  assert.deepEqual(
    eight.map(({ top }) => top),
    [68, 68, 68, 68, 85, 85, 85, 85],
  );
  assert.ok(eight.every(({ path }) => path.startsWith("M 500 460 ")));
  const five = flowStageLayout(5, "mobile");
  assert.deepEqual(
    five.map(({ row }) => row),
    [0, 0, 0, 1, 1],
  );
});

test("bubbles shrink past five and connectors scale with the reading", () => {
  assert.equal(flowNodeScale(3), 1);
  assert.equal(flowNodeScale(5), 1);
  assert.ok(flowNodeScale(8) < flowNodeScale(6));

  const heavy = flowIntensity(7000, 7000);
  const light = flowIntensity(60, 7000);
  assert.ok(heavy.width > light.width);
  assert.ok(heavy.duration < light.duration);
  assert.equal(flowIntensity(0, 7000).ratio, 0);
  // A single load is its own peak and still reads as a full flow.
  assert.equal(flowIntensity(120, 120).ratio, 1);
});

test("readings keep the period unit and never invent a value", () => {
  // it-IT only groups from five digits up, which is why 1235 stays ungrouped.
  assert.equal(formatFlowValue(1234.6, "instant"), "1235 W");
  assert.equal(formatFlowValue(12345, "instant"), "12.345 W");
  assert.equal(formatFlowValue(2.34, "day"), "2,3 kWh");
  assert.equal(formatFlowValue(2.34, "day", "en-GB"), "2.3 kWh");
  assert.equal(formatFlowValue(null, "day"), "—");
  assert.equal(formatFlowValue("", "instant"), "—");
});

test("only an explicit period helper is read as a period value", () => {
  assert.equal(flowPeriodEntity(load("x"), "instant"), "sensor.x_power");
  assert.equal(flowPeriodEntity(load("x"), "day"), "sensor.x_day");
  assert.equal(flowPeriodEntity(load("x"), "month"), "sensor.x_month");
  // The lifetime meter is never a period fallback: its state is a running
  // total, so reading it would print years of energy as one month.
  assert.equal(flowPeriodEntity({ history_entity: "sensor.total" }, "month"), "");
  assert.equal(flowPeriodEntity({ total_energy_entity: "sensor.total" }, "month"), "");
  assert.equal(flowRecorderEntity({ history_entity: "sensor.total" }), "sensor.total");
  assert.equal(flowRecorderEntity({ total_energy_entity: "sensor.meter" }), "sensor.meter");
});

test("a load metered only by its lifetime counter reads absent, never the total", () => {
  const lifetime = {
    id: "boiler",
    name: "Boiler",
    order: 0,
    power_entity: "sensor.boiler_power",
    total_energy_entity: "sensor.boiler_total",
  };
  const states = { "sensor.boiler_total": { state: "4134.18" } };

  const month = flowStageModel({ loads: [lifetime], states, period: "month" });
  assert.equal(month.nodes[0].value, null);
  assert.equal(month.nodes[0].text, "—");

  const day = flowStageModel({ loads: [lifetime], states, period: "day" });
  assert.equal(day.nodes[0].text, "—");

  // With a Recorder delta there is a real value to show, for today as well as
  // for the month: the lifetime counter feeds both, through the bundle.
  for (const [period, value, text] of [
    ["day", 1.44, "1,4 kWh"],
    ["month", 7.843, "7,8 kWh"],
  ]) {
    const withBundle = flowStageModel({
      loads: [lifetime],
      states,
      recorderValues: { boiler: value },
      period,
    });
    assert.equal(withBundle.nodes[0].value, value);
    assert.equal(withBundle.nodes[0].text, text);
    assert.equal(withBundle.nodes[0].entity, "sensor.boiler_total");
  }

  // The instant view reads live power and never a Recorder delta.
  const instant = flowStageModel({
    loads: [lifetime],
    states: { ...states, "sensor.boiler_power": { state: "1500" } },
    recorderValues: { boiler: 7.843 },
  });
  assert.equal(instant.nodes[0].text, "1500 W");
});

test("eight configured loads produce eight bound bubbles", () => {
  const model = flowStageModel({
    loads: loads(8),
    states: Object.fromEntries(
      Array.from({ length: 8 }, (_, index) => [`sensor.load${index + 1}_power`, { state: "100" }]),
    ),
  });
  assert.equal(model.count, 8);
  assert.equal(new Set(model.nodes.map(({ id }) => id)).size, 8);
  assert.ok(model.nodes.every((node) => node.active));
  assert.ok(model.nodes.every((node) => node.desktop && node.mobile));
  assert.ok(model.nodes.every((node) => node.color));
});

test("a load below the threshold is drawn idle, and an unbound one reads as absent", () => {
  const model = flowStageModel({
    loads: [load("a", { order: 0 }), load("b", { order: 1 }), { id: "c", name: "C", order: 2 }],
    states: {
      "sensor.a_power": { state: "1800" },
      "sensor.b_power": { state: "0.2" },
    },
  });
  assert.deepEqual(
    model.nodes.map(({ id, active, text }) => [id, active, text]),
    [
      ["a", true, "1800 W"],
      ["b", false, "0 W"],
      ["c", false, "—"],
    ],
  );
  assert.equal(model.peak, 1800);
});

test("saved flow-node customization wins, defaults never overwrite the Load", () => {
  const model = flowStageModel({
    loads: [load("first", { name: "Pompa di calore", order: 0 }), load("second", { order: 1 })],
    // Only `boiler` was saved; `wb` is absent and must not rename load two.
    flowNodes: { boiler: { name: "Boiler cantina", icon: "♨️", color: "#123456" } },
    states: {},
  });
  assert.equal(model.nodes[0].name, "Boiler cantina");
  assert.equal(model.nodes[0].icon, "♨️");
  assert.equal(model.nodes[0].color, "#123456");
  assert.equal(model.nodes[1].name, "second");
});

test("a flow node switched off in the editor leaves the stage entirely", () => {
  const model = flowStageModel({
    loads: loads(3),
    flowNodes: { wb: { enabled: false } },
    states: {},
  });
  assert.deepEqual(
    model.nodes.map(({ id }) => id),
    ["load1", "load3"],
  );
  // The remaining two re-space instead of leaving a hole where load two was.
  assert.deepEqual(
    model.nodes.map(({ desktop }) => desktop.left),
    [33.333, 66.667],
  );
});

test("clicking a circle opens its own appliances, or its history when it has none", () => {
  const model = flowStageModel({
    loads: [
      load("kitchen", { order: 0, name: "Cucina" }),
      { id: "forno", name: "Forno", metadata: { beta27_subload_group: "kitchen" } },
      load("boiler", { order: 1 }),
    ],
    states: {},
    period: "day",
  });
  // A circle holding appliances opens the popup listing them; the group is the
  // circle itself, with nothing to bind by hand.
  assert.deepEqual(model.nodes[0].click, { kind: "subloads", target: "kitchen_day" });
  assert.deepEqual(model.nodes[1].click, {
    kind: "history",
    entity: "sensor.boiler_day",
    title: "boiler",
  });
  const instant = flowStageModel({
    loads: [
      load("kitchen", { name: "Cucina" }),
      { id: "forno", name: "Forno", metadata: { beta27_subload_group: "kitchen" } },
    ],
    states: {},
  });
  assert.deepEqual(instant.nodes[0].click, { kind: "subloads", target: "kitchen" });
});

test("day and month prefer the recorder bundle over the period helper", () => {
  const model = flowStageModel({
    loads: [load("wallbox", { order: 0 })],
    states: { "sensor.wallbox_month": { state: "12" } },
    recorderValues: { wallbox: 148.2 },
    period: "month",
  });
  assert.equal(model.nodes[0].value, 148.2);
  assert.equal(model.nodes[0].text, "148,2 kWh");

  const day = flowStageModel({
    loads: [load("wallbox", { order: 0 })],
    states: { "sensor.wallbox_day": { state: "3" } },
    recorderValues: { wallbox: 18.4 },
    period: "day",
  });
  assert.equal(day.nodes[0].value, 18.4);
});

test("a circle holding appliances reads as their sum", () => {
  const loads = [
    { id: "cucina", name: "Cucina", order: 0 },
    {
      id: "forno",
      name: "Forno",
      power_entity: "sensor.forno_power",
      metadata: { beta27_subload_group: "cucina" },
    },
    {
      id: "frigo",
      name: "Frigorifero",
      power_entity: "sensor.frigo_power",
      metadata: { beta27_subload_group: "cucina" },
    },
  ];
  const states = {
    "sensor.forno_power": { state: "1800" },
    "sensor.frigo_power": { state: "95" },
  };

  const model = flowStageModel({ loads, states });
  // The appliances are inside the circle, never circles of their own.
  assert.deepEqual(
    model.nodes.map(({ id }) => id),
    ["cucina"],
  );
  assert.equal(model.nodes[0].value, 1895);
  assert.equal(model.nodes[0].source, "sum");
  assert.equal(model.nodes[0].children, 2);
  assert.equal(model.nodes[0].active, true);

  // Adding an appliance grows the circle with nothing else to configure.
  const grown = flowStageModel({
    loads: [
      ...loads,
      {
        id: "lavastoviglie",
        name: "Lavastoviglie",
        power_entity: "sensor.lavastoviglie_power",
        metadata: { beta27_subload_group: "cucina" },
      },
    ],
    states: { ...states, "sensor.lavastoviglie_power": { state: "200" } },
  });
  assert.equal(grown.nodes[0].value, 2095);
});

test("a clamp meter on the circle wins over the sum of what is inside it", () => {
  const loads = [
    { id: "cucina", name: "Cucina", order: 0, power_entity: "sensor.cucina_clamp" },
    {
      id: "forno",
      name: "Forno",
      power_entity: "sensor.forno_power",
      metadata: { beta27_subload_group: "cucina" },
    },
  ];
  const model = flowStageModel({
    loads,
    states: { "sensor.cucina_clamp": { state: "2000" }, "sensor.forno_power": { state: "1800" } },
  });
  assert.equal(model.nodes[0].value, 2000);
  assert.equal(model.nodes[0].source, "direct");
});

test("the sum covers day and month, through the same Recorder deltas", () => {
  const loads = [
    { id: "cucina", name: "Cucina", order: 0 },
    { id: "forno", name: "Forno", metadata: { beta27_subload_group: "cucina" } },
    { id: "frigo", name: "Frigorifero", metadata: { beta27_subload_group: "cucina" } },
  ];
  const model = flowStageModel({
    loads,
    states: {},
    recorderValues: { forno: 1.2, frigo: 0.8 },
    period: "day",
  });
  assert.equal(model.nodes[0].value, 2);
  assert.equal(model.nodes[0].text, "2,0 kWh");
  assert.equal(model.nodes[0].source, "sum");
});

test("an appliance with no reading is skipped, it does not zero the group", () => {
  const loads = [
    { id: "cucina", name: "Cucina", order: 0 },
    {
      id: "forno",
      name: "Forno",
      power_entity: "sensor.forno_power",
      metadata: { beta27_subload_group: "cucina" },
    },
    { id: "frigo", name: "Frigorifero", metadata: { beta27_subload_group: "cucina" } },
  ];
  const model = flowStageModel({ loads, states: { "sensor.forno_power": { state: "1800" } } });
  assert.equal(model.nodes[0].value, 1800);

  // With nothing readable at all the circle is absent, not a zero.
  const blank = flowStageModel({ loads, states: {} });
  assert.equal(blank.nodes[0].value, null);
  assert.equal(blank.nodes[0].text, "—");
});

test("an appliance assigned to a circle counts in it, configured only once", () => {
  const loads = [{ id: "cucina", name: "Cucina", order: 0 }];
  const appliances = [
    {
      id: "appl-forno",
      name: "Forno",
      power_entity: "sensor.forno_power",
      metadata: { beta27_subload_group: "cucina" },
    },
    { id: "appl-lavatrice", name: "Lavatrice", power_entity: "sensor.lavatrice_power" },
  ];
  const states = {
    "sensor.forno_power": { state: "1800" },
    "sensor.lavatrice_power": { state: "900" },
  };

  const model = flowStageModel({ loads, appliances, states });
  // Only the assigned one is inside the circle; the unassigned appliance is
  // not silently added to a load it was never filed under.
  assert.equal(model.nodes[0].value, 1800);
  assert.equal(model.nodes[0].children, 1);
  assert.equal(model.nodes[0].source, "sum");
  // And an appliance is never a circle of its own on the stage.
  assert.deepEqual(
    model.nodes.map(({ id }) => id),
    ["cucina"],
  );
});

test("appliances and loads-editor children add up in the same circle, once each", () => {
  const model = flowStageModel({
    loads: [
      { id: "cucina", name: "Cucina", order: 0 },
      {
        id: "frigo",
        name: "Frigorifero",
        power_entity: "sensor.frigo_power",
        metadata: { beta27_subload_group: "cucina" },
      },
    ],
    appliances: [
      {
        id: "appl-forno",
        name: "Forno",
        power_entity: "sensor.forno_power",
        metadata: { beta27_subload_group: "cucina" },
      },
      // The same device present in both sections must not be counted twice.
      {
        id: "frigo",
        name: "Frigorifero",
        power_entity: "sensor.frigo_power",
        metadata: { beta27_subload_group: "cucina" },
      },
    ],
    states: {
      "sensor.frigo_power": { state: "100" },
      "sensor.forno_power": { state: "1800" },
    },
  });
  assert.equal(model.nodes[0].value, 1900);
  assert.equal(model.nodes[0].children, 2);
});

/* Il cerchio della Wallbox porta all'auto, non allo storico di un sensore. */
test("la wallbox si riconosce dal carico, non dalla posizione", () => {
  const wallboxEntities = ["sensor.wb_power"];
  const cases = [
    // Il carico dice di esserlo.
    [{ id: "l1", name: "Garage", metadata: { flow_kind: "ev" } }, true],
    // E' il carico Wallbox che la configurazione conosce.
    [{ id: "load-wallbox", name: "Colonnina" }, true],
    // I suoi sensori sono quelli che la sezione Auto sta gia' leggendo.
    [{ id: "l2", name: "Garage", power_entity: "sensor.wb_power" }, true],
    [{ id: "l3", name: "Garage", monthly_energy_entity: "sensor.wb_power" }, true],
    // Chi crea un carico a mano lo chiama cosi'.
    [{ id: "l4", name: "Wallbox garage" }, true],
    [{ id: "l5", name: "Forno", power_entity: "sensor.forno" }, false],
  ];
  for (const [load, expected] of cases) {
    assert.equal(isWallboxLoad(load, null, wallboxEntities), expected, load.name);
  }
  // Il nome scritto sul cerchio conta quanto quello del carico.
  assert.equal(isWallboxLoad({ id: "l6", name: "Slot 2" }, { name: "Wallbox" }, []), true);
});

test("senza un'auto configurata il cerchio resta quello di prima", () => {
  const loads = [{ id: "load-wallbox", name: "Wallbox", power_entity: "sensor.wb_power" }];
  const states = { "sensor.wb_power": { state: "3200" } };

  // La sezione non passa nulla quando non c'e' un veicolo da aprire: meglio un
  // grafico che una finestra vuota.
  const senzaAuto = flowStageModel({ loads, states });
  assert.deepEqual(senzaAuto.nodes[0].click, {
    kind: "history",
    entity: "sensor.wb_power",
    title: "Wallbox",
  });

  const conAuto = flowStageModel({ loads, states, wallbox: { entities: ["sensor.wb_power"] } });
  assert.deepEqual(conAuto.nodes[0].click, { kind: "ev" });
});

test("gli altri cerchi non diventano l'auto per il fatto di essere secondi", () => {
  // FLOW_SLOT_KEYS chiama "wb" il secondo cerchio per ragioni storiche: quel
  // nome e' una posizione, non un elettrodomestico.
  const model = flowStageModel({
    loads: [
      { id: "a", name: "Boiler", power_entity: "sensor.a", order: 0 },
      { id: "b", name: "Lavanderia", power_entity: "sensor.b", order: 1 },
    ],
    states: { "sensor.a": { state: "100" }, "sensor.b": { state: "200" } },
    wallbox: { entities: ["sensor.wb_power"] },
  });
  assert.equal(model.nodes[1].slotKey, "wb");
  assert.equal(model.nodes[1].click.kind, "history");
});

test("il cerchio somma anche gli elettrodomestici del mondo vecchio", () => {
  /* «I flussi si creano ma senza valore; il popup dello stesso
   * elettrodomestico mostra i valori corretti»: gli apparecchi configurati
   * prima del modello canonico portano solo `entities: [...]`, senza
   * `power_entity`. Il popup i watt li trova scandendo le entita'; il
   * cerchio deve fare la stessa domanda. */
  const model = flowStageModel({
    loads: [{ id: "cerchio-cucina", name: "Cucina", metadata: {} }],
    appliances: [
      {
        id: "frigo",
        name: "Frigo",
        entities: ["switch.frigo", "sensor.frigo_w"],
        metadata: { beta27_subload_group: "cerchio-cucina" },
      },
    ],
    states: {
      "sensor.frigo_w": { state: "312", attributes: { unit_of_measurement: "W" } },
      "switch.frigo": { state: "on", attributes: {} },
    },
    period: "instant",
  });
  assert.equal(model.nodes[0].value, 312);
  assert.equal(model.nodes[0].source, "sum");
  // E chi i watt non li dichiara da nessuna parte resta onestamente muto.
  const muto = flowStageModel({
    loads: [{ id: "cerchio-cucina", name: "Cucina", metadata: {} }],
    appliances: [
      {
        id: "x",
        name: "X",
        entities: ["switch.x"],
        metadata: { beta27_subload_group: "cerchio-cucina" },
      },
    ],
    states: { "switch.x": { state: "on", attributes: {} } },
    period: "instant",
  });
  assert.equal(muto.nodes[0].value, null);
});
