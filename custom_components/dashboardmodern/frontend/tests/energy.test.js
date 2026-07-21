import assert from "node:assert/strict";
import test from "node:test";
import { EditorController } from "../src/editor/editor-controller.js";
import { DashboardModernStore } from "../src/state.js";
import { createDefaultCardRegistry } from "../src/cards/registry.js";
import {
  normalizeEnergy,
  renderBatteryStatusEditor,
  renderEnergyFlowsCard,
  renderEnergyOverviewCard,
  renderGridStatusEditor,
  validateBatteryStatusConfig,
  validateEnergyOverviewConfig,
  validateSolarProductionConfig,
} from "../src/cards/energy.js";

class Node {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this._text = "";
    this.value = "";
  }

  append(...items) {
    this.children.push(...items);
  }

  setAttribute(key, value) {
    this.attributes[key] = String(value);
  }

  addEventListener(type, listener) {
    this[`on${type}`] = listener;
  }

  click() {
    this.onclick?.();
  }
  get textContent() {
    return this._text + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }
  querySelectorAll(selector) {
    const out = [];
    const match = (node) => (selector.startsWith(".")
      ? node.className?.split?.(" ").includes(selector.slice(1))
      : node.tagName === selector);
    const walk = (node) => {
      if (match(node)) out.push(node);
      for (const child of node.children) walk(child);
    };
    walk(this);
    return out;
  }
}
globalThis.document = { createElement: (tag) => new Node(tag) };

const runtime = (states = {}) => ({
  locale: "en-US",
  getEntityState: (id) => states[id] || null,
  interactions: { opened: [], openHistory(id, label) { this.opened.push([id, label]); } },
});
const entity = (state, unit) => ({ state, attributes: { unit_of_measurement: unit } });
const cfg = {
  productionEntityId: "sensor.pv",
  houseConsumptionEntityId: "sensor.house",
  gridImportEntityId: "sensor.import",
  gridExportEntityId: "sensor.export",
  batterySocEntityId: "sensor.soc",
  batteryPowerEntityId: "sensor.battery",
  batteryCapacityEntityId: "sensor.capacity",
  dailyProductionEntityId: "sensor.solar_day",
  peakProductionEntityId: "sensor.peak",
  dailyImportEntityId: "sensor.import_day",
  dailyExportEntityId: "sensor.export_day",
  batteryPositiveDirection: "charging",
  powerUnit: "kW",
  energyUnit: "kWh",
  socUnit: "%",
};
const states = {
  "sensor.pv": entity("3200", "W"),
  "sensor.house": entity("2.4", "kW"),
  "sensor.import": entity("100", "W"),
  "sensor.export": entity("0.9", "kW"),
  "sensor.soc": entity("81", "%"),
  "sensor.battery": entity("-1500", "W"),
  "sensor.capacity": entity("7000", "Wh"),
  "sensor.solar_day": entity("18", "kWh"),
  "sensor.peak": entity("4.4", "kW"),
  "sensor.import_day": entity("2000", "Wh"),
  "sensor.export_day": entity("8", "kWh"),
};

test("energy normalization canonicalizes W to kW and kW passthrough", () => {
  const n = normalizeEnergy(runtime(states), cfg);
  assert.equal(n.metrics.production.value, 3.2);
  assert.equal(n.metrics.production.canonicalUnit, "kW");
  assert.equal(n.metrics.house.value, 2.4);
  assert.equal(n.metrics.house.sourceUnit, "kW");
});

test("energy normalization canonicalizes Wh to kWh and kWh passthrough", () => {
  const n = normalizeEnergy(runtime(states), cfg);
  assert.equal(n.metrics.capacity.value, 7);
  assert.equal(n.metrics.capacity.canonicalUnit, "kWh");
  assert.equal(n.metrics.dailyProduction.value, 18);
});

test("incompatible and unknown units are explicit unsupported-unit unavailable states", () => {
  const n = normalizeEnergy(runtime({ "sensor.pv": entity("42", "V"), "sensor.soc": entity("99", "kW") }), { ...cfg, productionEntityId: "sensor.pv", batterySocEntityId: "sensor.soc" });
  assert.equal(n.metrics.production.status, "unsupported-unit");
  assert.equal(n.metrics.production.available, false);
  assert.equal(n.metrics.production.sourceUnit, "V");
  assert.equal(n.metrics.soc.status, "unsupported-unit");
});

test("mixed-unit self-consumption calculations use canonical values only", () => {
  const n = normalizeEnergy(runtime({ "sensor.pv": entity("500", "W"), "sensor.house": entity("0.8", "kW") }), { productionEntityId: "sensor.pv", houseConsumptionEntityId: "sensor.house" });
  assert.equal(n.selfConsumption.value, 0.5);
  assert.equal(n.selfConsumption.canonicalUnit, "kW");
});

test("battery sign conventions, idle, and unavailable states normalize explicitly", () => {
  assert.equal(normalizeEnergy(runtime({ "sensor.battery": entity("1", "kW") }), { batteryPowerEntityId: "sensor.battery", batteryPositiveDirection: "charging" }).batteryMode, "charging");
  assert.equal(normalizeEnergy(runtime({ "sensor.battery": entity("1", "kW") }), { batteryPowerEntityId: "sensor.battery", batteryPositiveDirection: "discharging" }).batteryMode, "discharging");
  assert.equal(normalizeEnergy(runtime({ "sensor.battery": entity("0", "kW") }), { batteryPowerEntityId: "sensor.battery" }).batteryMode, "idle");
  assert.equal(normalizeEnergy(runtime({ "sensor.battery": entity("unavailable", "kW") }), { batteryPowerEntityId: "sensor.battery" }).batteryMode, "unavailable");
});

test("malformed, missing, unknown, and unavailable entities produce explicit states", () => {
  const n = normalizeEnergy(runtime({ "sensor.pv": entity("bad", "kW"), "sensor.house": entity("unknown", "kW"), "sensor.import": entity("unavailable", "kW") }), { productionEntityId: "sensor.pv", houseConsumptionEntityId: "sensor.house", gridImportEntityId: "sensor.import", gridExportEntityId: "sensor.none" });
  assert.equal(n.metrics.production.status, "malformed");
  assert.equal(n.metrics.house.status, "unknown");
  assert.equal(n.metrics.import.status, "unavailable");
  assert.equal(n.metrics.export.status, "missing-entity");
  assert.equal(n.metrics.soc.status, "missing-config");
});


test("energy validators reject malformed config types and executable entity ids", () => {
  const malformedConfigError = [{ field: "config", message: "Config must be an object." }];

  assert.deepEqual(validateEnergyOverviewConfig(null), malformedConfigError);
  assert.deepEqual(validateEnergyOverviewConfig([]), malformedConfigError);

  const errors = validateEnergyOverviewConfig({
    productionEntityId: "javascript:alert(1)",
    houseConsumptionEntityId: "sensor.house",
    gridImportEntityId: "sensor.import",
    gridExportEntityId: "sensor.export",
    batterySocEntityId: "sensor.soc",
    batteryPowerEntityId: "sensor.battery",
    powerUnit: "kW",
    energyUnit: "kWh",
    socUnit: "%",
    batteryPositiveDirection: "charging",
  });

  assert(errors.some((error) => error.field === "config.productionEntityId"));
});

test("energy validators cover missing config, templates, invalid units, and battery direction", () => {
  const errors = validateEnergyOverviewConfig({ productionEntityId: "{{ states }}", powerUnit: "MW", energyUnit: "J", socUnit: "percent", batteryPositiveDirection: "both" });
  assert(errors.some((e) => e.field === "config.houseConsumptionEntityId"));
  assert(errors.some((e) => /cannot contain templates/.test(e.message)));
  assert(errors.some((e) => e.field === "config.powerUnit"));
  assert(errors.some((e) => e.field === "config.energyUnit"));
  assert(errors.some((e) => e.field === "config.socUnit"));
  assert(errors.some((e) => e.field === "config.batteryPositiveDirection"));
  assert.deepEqual(validateBatteryStatusConfig({ batterySocEntityId: "sensor.soc", batteryPowerEntityId: "sensor.p", powerUnit: "kW", energyUnit: "kWh", socUnit: "%", batteryPositiveDirection: "charging" }), []);
  assert(validateSolarProductionConfig({ productionEntityId: "sensor.pv", powerUnit: "", energyUnit: "kWh" }).some((e) => e.field === "config.powerUnit"));
});

test("energy cards render normalized values and unavailable text", () => {
  const node = renderEnergyOverviewCard({ id: "e", title: "Energy", type: "energy-overview", config: cfg }, runtime(states));
  assert.match(node.textContent, /Energy/);
  assert.match(node.textContent, /3.2 kW/);
  const bad = renderEnergyOverviewCard({ id: "e", title: "Energy", config: {} }, runtime());
  assert.match(bad.textContent, /Unavailable/);
});

test("flow rendering is neutral and does not invent directional allocations", () => {
  const node = renderEnergyFlowsCard({ id: "f", title: "Flows", config: cfg }, runtime(states));
  assert.match(node.textContent, /Neutral direct metrics/);
  assert.match(node.textContent, /PV production↔3.2 kW/);
  assert.match(node.textContent, /Battery \(discharging\)↔-1.5 kW/);
  assert.doesNotMatch(node.textContent, /PV→House|House→Battery|Battery→House|sensor\./);

  const inverted = renderEnergyFlowsCard({ id: "f", title: "Flows", config: { ...cfg, batteryPositiveDirection: "discharging" } }, runtime(states));
  assert.match(inverted.textContent, /Battery \(charging\)↔-1.5 kW/);
});

test("tiles use button semantics only when a history interaction is available", () => {
  const active = renderEnergyOverviewCard({ id: "e", title: "Energy", config: cfg }, runtime(states));
  assert.equal(active.querySelectorAll("button").length, 6);
  assert.equal(active.querySelectorAll("div").filter((node) => node.className === "dm-energy-tile").length, 1);
  const inactive = renderEnergyOverviewCard({ id: "e", title: "Energy", config: {} }, runtime());
  assert.equal(inactive.querySelectorAll("button").length, 0);
});

test("history interaction is attached for applicable entity metrics", () => {
  const rt = runtime(states);
  const node = renderEnergyOverviewCard({ id: "e", title: "Energy", config: cfg }, rt);
  node.querySelectorAll("button")[0].click();
  assert.deepEqual(rt.interactions.opened[0], ["sensor.pv", "Production"]);
});

test("structured editors expose controlled unit selectors and plugin-specific fields", () => {
  const patches = [];
  const controller = { updateCardConfigPatch: (id, patch) => patches.push([id, patch]) };
  const batteryEditor = renderBatteryStatusEditor(globalThis.document, { id: "b", config: { batterySocEntityId: "sensor.old", powerUnit: "kW", energyUnit: "kWh", socUnit: "%", batteryPositiveDirection: "charging" } }, controller, [{ message: "Battery SOC is required" }]);
  const selects = batteryEditor.querySelectorAll("select");
  assert.equal(selects.length, 4);
  assert(batteryEditor.textContent.includes("Battery positive direction"));
  assert(!batteryEditor.textContent.includes("PV current production"));
  selects.find((select) => select.dataset.editorField === "card:b:config.powerUnit").value = "W";
  selects.find((select) => select.dataset.editorField === "card:b:config.powerUnit").onchange();
  assert.deepEqual(patches.at(-1), ["b", { powerUnit: "W" }]);
  assert.match(batteryEditor.textContent, /Battery SOC is required/);

  const gridEditor = renderGridStatusEditor(globalThis.document, { id: "g", config: { powerUnit: "kW", energyUnit: "kWh" } }, controller, []);
  assert.equal(gridEditor.querySelectorAll("select").length, 2);
  assert(!gridEditor.textContent.includes("SOC unit"));
});

test("activeDashboard remains unchanged until energy validation succeeds", async () => {
  const dashboard = { id: "dash", title: "Dash", views: [{ id: "v", title: "V", section_ids: ["s"] }], sections: [{ id: "s", title: "S", card_ids: ["c"] }], cards: [{ id: "c", title: "Energy", type: "battery-status", config: { batterySocEntityId: "", batteryPowerEntityId: "", powerUnit: "kW", energyUnit: "kWh", socUnit: "%", batteryPositiveDirection: "charging" } }] };
  let savedDashboard = dashboard;
  const api = { replaceDashboard: async (_entryId, draft) => { savedDashboard = draft; return draft; }, listDashboards: async () => [savedDashboard], getDashboard: async () => savedDashboard };
  const store = new DashboardModernStore(api, { entryIdResolver: async () => "entry" });
  store.setState({ entryId: "entry", activeDashboard: dashboard, activeDashboardId: "dash", dashboards: [dashboard] });
  const controller = new EditorController(store);
  await controller.enter();
  assert.equal(await controller.save(), false);
  assert.equal(store.state.activeDashboard, dashboard);
  controller.updateCardConfig("c", JSON.stringify({ batterySocEntityId: "sensor.soc", batteryPowerEntityId: "sensor.battery", powerUnit: "kW", energyUnit: "kWh", socUnit: "%", batteryPositiveDirection: "charging" }));
  assert.equal(await controller.save(), true);
  assert.equal(store.state.activeDashboard.cards[0].config.batterySocEntityId, "sensor.soc");
});

test("built-in registry includes all Phase 11 energy plugins", () => {
  assert.deepEqual(createDefaultCardRegistry().types(), ["battery-status", "energy-flows", "energy-overview", "grid-status", "home-summary", "legacy-panel", "solar-production", "weather-current", "weather-forecast"]);
});
