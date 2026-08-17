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
  assert.deepEqual([...lefts].sort((a, b) => a - b), lefts);
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

test("clicking a bubble opens its subload group, or its history when it has none", () => {
  const model = flowStageModel({
    loads: [
      load("kitchen", { order: 0, metadata: { beta27_subload_group: "cucina" } }),
      load("boiler", { order: 1 }),
    ],
    states: {},
    period: "day",
  });
  assert.deepEqual(model.nodes[0].click, { kind: "subloads", target: "cucina_day" });
  assert.deepEqual(model.nodes[1].click, {
    kind: "history",
    entity: "sensor.boiler_day",
    title: "boiler",
  });
  const instant = flowStageModel({
    loads: [load("kitchen", { metadata: { beta27_subload_group: "cucina" } })],
    states: {},
  });
  assert.deepEqual(instant.nodes[0].click, { kind: "subloads", target: "cucina" });
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
