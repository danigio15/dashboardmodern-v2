// DM-FIX-20260817A
/* The Beta 30 stage renderer against a minimal DOM shim: enough of the legacy
 * flow markup to prove the fixed five-bubble topology is replaced by one
 * computed bubble per configured Load, in all three period views. */
import assert from "node:assert/strict";
import test from "node:test";

class ClassList {
  constructor(node) {
    this.node = node;
  }
  #set() {
    return new Set(String(this.node.className || "").split(/\s+/).filter(Boolean));
  }
  add(...names) {
    const set = this.#set();
    names.forEach((name) => set.add(name));
    this.node.className = [...set].join(" ");
  }
  toggle(name, force) {
    const set = this.#set();
    if (force) set.add(name);
    else set.delete(name);
    this.node.className = [...set].join(" ");
  }
  contains(name) {
    return this.#set().has(name);
  }
}

class Style {
  constructor() {
    this.values = new Map();
    this.priorities = new Map();
  }
  setProperty(name, value, priority = "") {
    this.values.set(name, String(value));
    this.priorities.set(name, priority);
  }
  removeProperty(name) {
    this.values.delete(name);
    this.priorities.delete(name);
  }
  getPropertyValue(name) {
    return this.values.get(name) || "";
  }
  getPropertyPriority(name) {
    return this.priorities.get(name) || "";
  }
  set left(value) {
    this.setProperty("left", value);
  }
  set top(value) {
    this.setProperty("top", value);
  }
  set stroke(value) {
    this.setProperty("stroke", value);
  }
  set fill(value) {
    this.setProperty("fill", value);
  }
}

/* Simple-selector support: tag, .class, [attr], [attr="v"], [attr^='v'] and
 * [attr*='v' i], joined by commas. That is every selector the renderer uses. */
const SIMPLE = /^([a-z]*)((?:[.#][\w-]+|\[[^\]]+\])*)$/i;
const PART = /([.#])([\w-]+)|\[([^\]=*^]+)(?:([*^]?=)\s*["']?([^"'\]]*)["']?)?(\s+i)?\]/g;

function datasetKey(attribute) {
  return attribute.startsWith("data-")
    ? attribute.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    : "";
}

function attributeValue(node, attribute) {
  const key = datasetKey(attribute);
  if (key) return node.dataset[key];
  if (attribute === "id") return node.id;
  if (attribute === "class") return node.className;
  return node.attributes[attribute];
}

function matchesSimple(node, selector) {
  const parsed = SIMPLE.exec(selector.trim());
  if (!parsed) return false;
  const [, tag, rest] = parsed;
  if (tag && node.tagName.toLowerCase() !== tag.toLowerCase()) return false;
  PART.lastIndex = 0;
  let part;
  while ((part = PART.exec(rest || ""))) {
    const [, prefix, name, attribute, operator, expected, insensitive] = part;
    if (prefix === ".") {
      if (!node.classList.contains(name)) return false;
      continue;
    }
    if (prefix === "#") {
      if (node.id !== name) return false;
      continue;
    }
    const value = attributeValue(node, attribute);
    if (value === undefined || value === null) return false;
    if (!operator) continue;
    const haystack = insensitive ? String(value).toLowerCase() : String(value);
    const needle = insensitive ? String(expected).toLowerCase() : String(expected);
    if (operator === "=" && haystack !== needle) return false;
    if (operator === "^=" && !haystack.startsWith(needle)) return false;
    if (operator === "*=" && !haystack.includes(needle)) return false;
  }
  return true;
}

const matches = (node, selector) =>
  selector.split(",").some((part) => matchesSimple(node, part));

class Element {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.className = "";
    this.classList = new ClassList(this);
    this.style = new Style();
    this.hidden = false;
    this.id = "";
    this.textContent = "";
    this.onclick = null;
    this.parentElement = null;
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentElement = this;
      this.children.push(node);
    }
  }
  remove() {
    const siblings = this.parentElement?.children;
    if (!siblings) return;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentElement = null;
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
  descendants(out = []) {
    for (const child of this.children) {
      out.push(child);
      child.descendants(out);
    }
    return out;
  }
  querySelectorAll(selector) {
    return this.descendants().filter((node) => matches(node, selector));
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  click(event = {}) {
    this.onclick?.(event);
  }
}

function element(tag, { id = "", className = "", ...rest } = {}) {
  const node = new Element(tag);
  node.id = id;
  node.className = className;
  Object.assign(node, rest);
  return node;
}

/* One view of the legacy stage: the two SVGs plus the five hand-authored
 * bubbles and their connectors. */
function legacyView(id, suffix) {
  const view = element("div", { id });
  const stage = element("div", { className: "flow-stage" });
  const desktop = element("svg", { className: "flow-svg desktop-svg" });
  const mobile = element("svg", { className: "flow-svg mobile-svg" });
  for (const key of ["boiler", "wb", "clima", "lav", "cuc"]) {
    stage.append(element("div", { id: `n-${key}${suffix}`, className: "node n-load" }));
    desktop.append(element("path", { id: `line-home-${key}${suffix}`, className: "flow-line" }));
    mobile.append(element("path", { id: `m-line-home-${key}${suffix}`, className: "flow-line" }));
  }
  desktop.append(element("path", { id: `line-solar-home${suffix}`, className: "flow-line" }));
  stage.append(desktop, mobile);
  view.append(stage);
  return view;
}

function legacyDocument() {
  const head = element("head");
  const body = element("body");
  const views = {
    instant: legacyView("view-ist", ""),
    day: legacyView("view-day", "-day"),
    month: legacyView("view-month", "-month"),
  };
  body.append(views.instant, views.day, views.month);
  const document = {
    documentElement: element("html", { lang: "it" }),
    head,
    body,
    createElement: (tag) => new Element(tag),
    createElementNS: (_namespace, tag) => new Element(tag),
    getElementById: (id) => body.descendants().find((node) => node.id === id) || null,
    querySelectorAll: (selector) => body.querySelectorAll(selector),
    querySelector: (selector) => body.querySelector(selector),
    addEventListener() {},
  };
  return { document, views };
}

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

/* `shared.js` captures `globalThis.document` once, at first import, so the whole
 * file drives a single stage and swaps only the configuration between tests. */
const { document, views } = legacyDocument();
globalThis.document = document;
globalThis.localStorage = memoryStorage();
// The section subscribes to the runtime's period bundle on the global object,
// so the tests need somewhere for that event to actually land.
const events = new EventTarget();
globalThis.addEventListener = events.addEventListener.bind(events);
globalThis.dispatchEvent = events.dispatchEvent.bind(events);
const section = await import("../src/sections/energy-flow-section.js");

function configure({ loads = [], states = {}, flowNodes = null, bundle = null } = {}) {
  globalThis.DashboardModernModules = { store: { getSection: (name) => ({ loads })[name] } };
  globalThis.localStorage = memoryStorage(flowNodes ? { cd_flow_nodes: flowNodes } : {});
  globalThis.__HASS__ = { states };
  if (bundle) globalThis.dispatchEvent(new CustomEvent("dashboardmodern:period-bundle", { detail: bundle }));
  section.refreshEnergyFlows();
}

function bubbles(view) {
  return view.querySelectorAll("[data-dm-flow-node]");
}

function arcs(view, variant = "desktop") {
  return view.querySelector(`svg.${variant}-svg`).querySelectorAll("[data-dm-flow-arc]");
}

function textOf(node, selector) {
  return node.querySelector(selector)?.textContent || "";
}

function load(id, order, overrides = {}) {
  return {
    id,
    name: id,
    order,
    power_entity: `sensor.${id}_power`,
    daily_energy_entity: `sensor.${id}_day`,
    monthly_energy_entity: `sensor.${id}_month`,
    ...overrides,
  };
}

test("every configured load gets its own bubble and connectors, in all three views", () => {
  configure({
    loads: Array.from({ length: 7 }, (_, index) => load(`load${index + 1}`, index)),
    states: { "sensor.load1_power": { state: "2400" } },
  });

  for (const view of Object.values(views)) {
    assert.equal(bubbles(view).length, 7, "one bubble per configured load");
    assert.equal(arcs(view, "desktop").length, 7);
    assert.equal(arcs(view, "mobile").length, 7);
    assert.equal(view.dataset.dmFlowOwner, "beta30");
    assert.equal(view.dataset.dmCanonicalLoadCount, "7");
  }

  // The five hand-authored bubbles and connectors are hidden, not duplicated.
  const legacy = views.instant
    .querySelectorAll(".node.n-load")
    .filter((node) => !node.dataset.dmFlowNode);
  assert.equal(legacy.length, 5);
  assert.ok(legacy.every((node) => node.hidden));
  assert.equal(
    views.instant.querySelector("#line-home-boiler").style.getPropertyValue("display"),
    "none",
  );
});

test("a bubble carries the load name, icon and reading of its period", () => {
  configure({
    loads: [load("wallbox", 0, { name: "Wallbox", icon: "🚗", color: "#06b6d4" })],
    states: {
      "sensor.wallbox_power": { state: "7100" },
      "sensor.wallbox_day": { state: "18.4" },
      "sensor.wallbox_month": { state: "260" },
    },
  });

  const instant = bubbles(views.instant)[0];
  assert.equal(textOf(instant, ".node-label"), "Wallbox");
  assert.equal(textOf(instant, ".node-icon"), "🚗");
  assert.equal(textOf(instant, ".dm-flow-value"), "7100 W");
  assert.equal(instant.style.getPropertyValue("--n-color"), "#06b6d4");
  assert.equal(textOf(bubbles(views.day)[0], ".dm-flow-value"), "18,4 kWh");
  assert.equal(textOf(bubbles(views.month)[0], ".dm-flow-value"), "260,0 kWh");
});

test("an mdi icon is drawn through the icon engine, not as an empty ha-icon box", () => {
  // `<ha-icon>` only paints where that element is defined; here it is not, so a
  // circle configured with `mdi:car-electric` came out with no glyph at all.
  const asked = [];
  globalThis.DashboardModernIconEngine = {
    render: (target, kind, value, options) => {
      asked.push([kind, value, options?.size]);
      target.innerHTML = '<span class="dm-icon-engine-glyph">🚘</span>';
      return true;
    },
  };
  globalThis.cdIconMarkup = () => "<ha-icon></ha-icon>";
  try {
    configure({
      loads: [load("auto", 0, { name: "Auto", icon: "mdi:car-electric" })],
      states: { "sensor.auto_power": { state: "3200" } },
    });

    const icon = bubbles(views.instant)[0].querySelector(".node-icon");
    assert.deepEqual(asked[0], ["action", "mdi:car-electric", 28]);
    assert.match(icon.innerHTML, /🚘/);
    assert.equal(icon.textContent, "", "the token is never printed as text");
  } finally {
    delete globalThis.DashboardModernIconEngine;
    delete globalThis.cdIconMarkup;
  }
});

test("an emoji icon still goes straight into the bubble", () => {
  configure({
    loads: [load("auto", 0, { name: "Auto", icon: "🚗" })],
    states: { "sensor.auto_power": { state: "3200" } },
  });
  assert.equal(textOf(bubbles(views.instant)[0], ".node-icon"), "🚗");
});

test("an active connector animates in its load colour, an idle one does not", () => {
  configure({
    loads: [load("oven", 0, { color: "#ea580c" }), load("fridge", 1, { color: "#0ea5e9" })],
    states: {
      "sensor.oven_power": { state: "2100" },
      "sensor.fridge_power": { state: "0" },
    },
  });

  const [oven, fridge] = arcs(views.instant);
  assert.equal(oven.dataset.dmFlowArc, "oven");
  assert.ok(oven.classList.contains("dm-energy-flow-active"));
  assert.equal(oven.style.getPropertyValue("--line-color"), "#ea580c");
  assert.ok(oven.getAttribute("d").startsWith("M 500 365 "));
  assert.ok(fridge.classList.contains("dm-energy-flow-idle"));
  assert.ok(!fridge.classList.contains("dm-energy-flow-active"));
  // The heavier load draws the heavier line.
  assert.ok(
    Number.parseFloat(oven.style.getPropertyValue("--dm-flow-width")) >
      Number.parseFloat(fridge.style.getPropertyValue("--dm-flow-width")),
  );
  // Mobile connectors are drawn in their own viewBox.
  assert.ok(arcs(views.instant, "mobile")[0].getAttribute("d").startsWith("M 500 460 "));
});

test("removing a load removes its bubble and its connectors", () => {
  configure({ loads: [load("a", 0), load("b", 1), load("c", 2)] });
  assert.equal(bubbles(views.instant).length, 3);

  configure({ loads: [load("a", 0), load("c", 2)] });
  assert.deepEqual(
    bubbles(views.instant).map((node) => node.dataset.dmFlowNode),
    ["a", "c"],
  );
  assert.equal(document.body.querySelectorAll('[data-dm-flow-arc="b"]').length, 0);
  assert.equal(views.instant.dataset.dmCanonicalLoadCount, "2");
});

test("a bubble opens its own appliances, or the history of its entity", () => {
  const opened = [];
  globalThis.apriSubLoads = (group) => opened.push(["subloads", group]);
  globalThis.apriStorico = (_event, entity, title) => opened.push(["history", entity, title]);
  configure({
    loads: [
      load("kitchen", 0, { name: "Cucina" }),
      // An appliance inside the circle, not a circle of its own.
      { id: "forno", name: "Forno", metadata: { beta27_subload_group: "kitchen" } },
      load("boiler", 1, { name: "Boiler" }),
    ],
  });

  assert.deepEqual(
    bubbles(views.instant).map((node) => node.dataset.dmFlowNode),
    ["kitchen", "boiler"],
  );
  bubbles(views.instant)[0].click();
  bubbles(views.instant)[1].click();
  bubbles(views.month)[0].click();
  assert.deepEqual(opened, [
    ["subloads", "kitchen"],
    ["history", "sensor.boiler_power", "Boiler"],
    ["subloads", "kitchen_month"],
  ]);
  delete globalThis.apriSubLoads;
  delete globalThis.apriStorico;
});

test("saved flow-node customization renames and recolours the bubble it owns", () => {
  configure({
    loads: [load("pump", 0, { name: "Pompa di calore" }), load("dryer", 1, { name: "Asciugatrice" })],
    flowNodes: { boiler: { name: "Boiler cantina", icon: "♨️", color: "#123456" } },
  });
  const [first, second] = bubbles(views.instant);
  assert.equal(textOf(first, ".node-label"), "Boiler cantina");
  assert.equal(first.style.getPropertyValue("--n-color"), "#123456");
  assert.equal(textOf(second, ".node-label"), "Asciugatrice");
});

test("no configured load means an empty stage, not five orphan bubbles", () => {
  configure({ loads: [] });
  assert.equal(bubbles(views.instant).length, 0);
  assert.equal(views.instant.dataset.dmCanonicalLoadCount, "0");
  assert.ok(
    views.instant.querySelectorAll(".node.n-load").every((node) => node.hidden),
    "the legacy bubbles stay hidden when nothing is configured",
  );
});

test("the main solar/grid/battery connectors are still owned by the mirror", () => {
  configure({ loads: [load("a", 0)] });
  const main = views.instant.querySelector("#line-solar-home");
  assert.equal(main.dataset.dmMainFlow, "solar-home");
  assert.equal(main.dataset.dmFlowPeriod, "instant");
  assert.equal(views.instant.dataset.dmEnergyFlows, "directional-value-bound");
});

test("a load metered only by its lifetime counter reads today and this month from the bundle", () => {
  const lifetime = {
    id: "boiler",
    name: "Boiler",
    order: 0,
    power_entity: "sensor.boiler_power",
    total_energy_entity: "sensor.boiler_total",
  };
  // The running total must never reach a bubble: it is energy since the meter
  // was installed, not consumption of a period.
  const states = {
    "sensor.boiler_power": { state: "1500" },
    "sensor.boiler_total": { state: "4134.18" },
  };

  configure({ loads: [lifetime], states });
  assert.equal(textOf(bubbles(views.instant)[0], ".dm-flow-value"), "1500 W");
  assert.equal(textOf(bubbles(views.day)[0], ".dm-flow-value"), "—");
  assert.equal(textOf(bubbles(views.month)[0], ".dm-flow-value"), "—");

  configure({
    loads: [lifetime],
    states,
    bundle: {
      deviceDay: {
        devices: [{ key: "boiler", name: "Boiler", history: "sensor.boiler_total" }],
        values: new Map([["sensor.boiler_total", 1.44]]),
      },
      deviceMonth: {
        devices: [{ key: "boiler", name: "Boiler", history: "sensor.boiler_total" }],
        values: new Map([["sensor.boiler_total", 7.843]]),
      },
    },
  });
  assert.equal(textOf(bubbles(views.day)[0], ".dm-flow-value"), "1,4 kWh");
  assert.equal(textOf(bubbles(views.month)[0], ".dm-flow-value"), "7,8 kWh");
  assert.equal(textOf(bubbles(views.instant)[0], ".dm-flow-value"), "1500 W");
});
