// Regression tests for the navbar visibility engine (cdSecBoot/cdApplyNavVis).
// The engine is extracted verbatim from the vendored dashboard and executed
// against mock storage and DOM, covering the exact field failures we hit:
// a fresh plancia must show only Home+Config, a post-reset plancia must
// re-derive (the old boot flag made it stick fully visible), populated
// sections must stay visible, and explicit user choices must win.

import test from "node:test";

import { readLegacyBundle } from "./legacy-source.js";
import assert from "node:assert";

const html = readLegacyBundle("dashboard.html");

function extract(startMarker, endMarker) {
  const i = html.indexOf(startMarker);
  assert.notEqual(i, -1, `marker mancante: ${startMarker.slice(0, 40)}`);
  const j = html.indexOf(endMarker, i);
  assert.notEqual(j, -1, `fine mancante: ${endMarker}`);
  return html.slice(i, j + endMarker.length);
}

const engine =
  extract("function cdNavVisMap()", "}, 3000); ") +
  "\n" +
  extract("function cdSecLS(", "setTimeout(cdSecBoot, 1200); ");

const NAV_KEYS = [
  "home",
  "energy",
  "appliances-main",
  "ev",
  "boiler",
  "clima",
  "temp",
  "security",
  "server",
  "tapparelle",
  "irrigazione",
  "piscina",
];

function runEngine(seedStorage = {}) {
  const store = new Map(Object.entries(seedStorage));
  const tabs = {};
  for (const k of NAV_KEYS) {
    const style = {
      display: "",
      setProperty(prop, v) {
        if (prop === "display") this.display = v;
      },
      removeProperty(prop) {
        if (prop === "display") this.display = "";
      },
    };
    tabs[k] = { style };
  }
  const timeouts = [];
  const sandbox = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    window: { __DASHBOARDMODERN_HOSTED__: true },
    document: {
      querySelector: (sel) => {
        const m = /\.tab\[data-tab="([\w-]+)"\]/.exec(sel);
        return m && tabs[m[1]] ? tabs[m[1]] : null;
      },
      querySelectorAll: (sel) => {
        const m = /\.tab\[data-tab="([\w-]+)"\]/.exec(sel);
        return m && tabs[m[1]] ? [tabs[m[1]]] : [];
      },
    },
    setTimeout: (fn) => timeouts.push(fn),
    setInterval: (fn) => timeouts.push(fn),
    cdMarkDirty: () => {},
    cdSyncPush: () => {},
    cdCfg: (key) => {
      try {
        const ls = store.get(key);
        if (ls) return JSON.parse(ls);
      } catch (e) {
        /* ignore */
      }
      return {};
    },
  };
  const keys = Object.keys(sandbox);
  const fn = new Function(...keys, `${engine}\n`);
  fn(...keys.map((k) => sandbox[k]));
  for (const cb of timeouts.slice()) cb();
  return { store, tabs };
}

test("fresh plancia: everything except home hidden", () => {
  const { store, tabs } = runEngine();
  const sections = JSON.parse(store.get("cd_sections"));
  assert.equal(sections.energy, false);
  assert.equal(sections.piscina, false);
  assert.equal(tabs.home.style.display, "");
  for (const k of NAV_KEYS) {
    if (k === "home") continue;
    assert.equal(tabs[k].style.display, "none", `tab ${k} visibile su fresh`);
  }
});

test("post-reset (no cd_sections, stale leftovers): re-derives and hides", () => {
  // The old engine's boot flag made this scenario stick fully visible.
  const { store, tabs } = runEngine({ cd_navbar_order: "[]" });
  assert.ok(store.get("cd_sections"), "cd_sections non riderivato dopo reset");
  assert.equal(tabs.energy.style.display, "none");
});

test("populated sections stay visible on first derivation", () => {
  const { tabs } = runEngine({
    cd_entity_overrides: JSON.stringify({ "dm.energy_potenza": "sensor.x" }),
    cd_tapparelle: JSON.stringify([{ name: "Salone", entity: "cover.s" }]),
    cd_clima_units: JSON.stringify([{ entity: "climate.c" }]),
  });
  assert.equal(tabs.energy.style.display, "");
  assert.equal(tabs.tapparelle.style.display, "");
  assert.equal(tabs.clima.style.display, "");
  assert.equal(tabs.ev.style.display, "none");
  assert.equal(tabs.piscina.style.display, "none");
});

test("v2 maps missing the newer keys get them filled, choices intact", () => {
  // Field bug: a map written by the older engine had only the seven legacy
  // keys, so Elettrodomestici (and tapparelle/irrigazione/piscina) never hid.
  const { store, tabs } = runEngine({
    cd_sections: JSON.stringify({
      energy: false,
      ev: false,
      boiler: false,
      clima: false,
      temp: false,
      security: false,
      server: false,
    }),
  });
  const cur = JSON.parse(store.get("cd_sections"));
  assert.equal(cur.appliances, false, "appliances non migrato");
  assert.equal(cur.tapparelle, false);
  assert.equal(cur.energy, false, "scelta esistente alterata");
  assert.equal(tabs["appliances-main"].style.display, "none");
});

test("explicit user choices are never overridden", () => {
  const { store, tabs } = runEngine({
    cd_sections: JSON.stringify({ energy: true, ev: false }),
    cd_entity_overrides: JSON.stringify({ "dm.ev_batteria": "sensor.b" }),
  });
  // Existing choices are untouched; only missing keys get filled in.
  const cur = JSON.parse(store.get("cd_sections"));
  assert.equal(cur.energy, true);
  assert.equal(cur.ev, false);
  assert.equal(cur.appliances, false);
  assert.equal(tabs.ev.style.display, "none");
  assert.equal(tabs.energy.style.display, "");
});
