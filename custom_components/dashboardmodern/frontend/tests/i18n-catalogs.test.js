import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MESSAGE_KEYS } from "./i18n-message-keys.js";
import { SOURCE_INDEX } from "../src/i18n/source-index.js";
import {
  BUILT_IN_LOCALES,
  LOCALE_REGISTRY,
  loadCatalog,
  localeBridge,
  registerCatalog,
  resetCatalogs,
  resetLocale,
  supportedLocales,
  translate,
} from "../src/core/i18n.js";

const I18N_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/i18n");
const KEYS = new Set(MESSAGE_KEYS);
const PLACEHOLDER = /\$\{[^}]*\}/g;

async function catalogFiles() {
  const names = await readdir(I18N_DIR);
  return names.filter((name) => name.endsWith(".js") && name !== "source-index.js").sort();
}

async function loadCatalogModule(name) {
  const module = await import(`../src/i18n/${name}`);
  return module.default;
}

test.afterEach(() => {
  resetLocale();
  resetCatalogs();
});

test("every catalog file names a locale the registry knows", async () => {
  for (const name of await catalogFiles()) {
    const code = name.replace(/\.js$/, "");
    assert.ok(LOCALE_REGISTRY[code], `src/i18n/${name} is not a registered locale`);
    assert.ok(
      !BUILT_IN_LOCALES.includes(code),
      `${code} needs no catalog: English is the pivot and Italian is the source`,
    );
  }
});

test("every offered locale reaches a catalog, its own or a bridged one", async () => {
  const shipped = new Set((await catalogFiles()).map((name) => name.replace(/\.js$/, "")));
  /* The picker offers every registered locale. A locale with neither a catalog
   * nor a bridge to one would be offered and then render entirely in English,
   * which is worse than not offering it: the user thinks they picked wrong. */
  const stranded = supportedLocales().filter((code) => {
    if (BUILT_IN_LOCALES.includes(code) || shipped.has(code)) return false;
    const bridge = localeBridge(code);
    return !bridge || !shipped.has(bridge);
  });
  assert.deepEqual(stranded, [], `locales offered with no reachable catalog: ${stranded.join(", ")}`);
});

test("catalogs answer the whole corpus", async () => {
  for (const name of await catalogFiles()) {
    const catalog = await loadCatalogModule(name);
    const missing = MESSAGE_KEYS.filter((key) => !catalog[key]);
    assert.deepEqual(
      missing,
      [],
      `${name} is missing ${missing.length} keys, starting with: ${missing.slice(0, 5).join(" | ")}`,
    );
  }
});

test("catalogs invent no keys of their own", async () => {
  for (const name of await catalogFiles()) {
    const catalog = await loadCatalogModule(name);
    const unknown = Object.keys(catalog).filter((key) => !KEYS.has(key));
    /* A key that is no longer in the corpus is dead weight the loader still
     * ships, and usually means a `t()` call site was reworded without the
     * catalogs following. */
    assert.deepEqual(unknown, [], `${name} has keys outside the corpus: ${unknown.slice(0, 5).join(" | ")}`);
  }
});

test("a translation keeps every placeholder its key declares", async () => {
  for (const name of await catalogFiles()) {
    const catalog = await loadCatalogModule(name);
    for (const [key, value] of Object.entries(catalog)) {
      const expected = (key.match(PLACEHOLDER) || []).slice().sort();
      const actual = (value.match(PLACEHOLDER) || []).slice().sort();
      /* Order may change — languages put the number in different places — but
       * a dropped placeholder would render "unidades" with no number at all. */
      assert.deepEqual(actual, expected, `${name}: "${key}" -> "${value}" changed its placeholders`);
    }
  }
});

test("no translation is left as its English source", async () => {
  for (const name of await catalogFiles()) {
    const catalog = await loadCatalogModule(name);
    const untouched = Object.entries(catalog)
      .filter(([key, value]) => key === value)
      /* Proper nouns, units and symbols are the same word everywhere. They are
       * listed rather than pattern-matched so a lazy copy cannot hide here. */
      .filter(([key]) => !SHARED_ACROSS_LANGUAGES.has(key))
      /* …and a few words genuinely coincide with English in one language but
       * not in the next, so those exceptions are declared per locale. */
      .filter(([key]) => !(LOCALE_IDENTITIES[name.replace(/\.js$/, "")] || new Set()).has(key))
      .map(([key]) => key);
    assert.deepEqual(untouched, [], `${name} left untranslated: ${untouched.slice(0, 8).join(" | ")}`);
  }
});

/* Strings that legitimately read the same in every language we ship. */
const SHARED_ACROSS_LANGUAGES = new Set([
  ".",
  "24 h",
  "Auto",
  "Boost",
  "Config",
  "Home Assistant entity",
  "N/A",
  "Radiators",
  "Turbo",
  /* Il nome della scheda del ponte: mezza Europa lo chiama cosi'. */
  "Widgets",
  "kWh/day",
  "☀️ Solar",
  "📊 Report",
  "Solar",
  "Solar ΔT",
  "Recirc.",
  "Med",
  "Med-",
  "Med+",
  "Target SoC",
  "System OK",
  "of",
  "pH",
  "🔥 Boiler",
]);

/*
 * Words that coincide with English in one language but not the next.
 * Kept per locale so an untranslated string cannot hide behind another
 * language's legitimate coincidence.
 */
const LOCALE_IDENTITIES = {
  es: new Set([
    "Color",
    "Error",
    "ideal",
    "Magenta",
    "Pickup",
    "Script",
    "Total",
  ]),
  fr: new Set([
    "Action",
    "Batteries",
    "CCTV ACTIVE",
    "Configuration",
    "CONFIGURATION",
    "Cyan",
    "Direction",
    "Filtration",
    "Garage",
    "Indigo",
    "Information",
    "Intrusion",
    "Magenta",
    "Mode",
    "Orange",
    "Pause",
    "PAUSE",
    "Photo",
    "Production",
    "Recirculation",
    "Saturation",
    "Script",
    "Session",
    "Sessions",
    "Total",
    "Type",
    "Violet",
    "WC",
    "Zone",
  ]),
  de: new Set([
    "💨 Wind",
    "${value} offline",
    "April",
    "August",
    "Boiler",
    "Computer",
    "Cyan",
    "DETAILS",
    "DIMMER",
    "Download",
    "Garage",
    "Grill",
    "ideal",
    "Indigo",
    "Information",
    "Magenta",
    "Name",
    "Name (A–Z)",
    "NNW",
    "November",
    "Optional",
    "Orange",
    "Pause",
    "PAUSE",
    "Person",
    "Pool",
    "Pools",
    "September",
    "Server",
    "Server / NAS",
    "SSW",
    "STANDBY",
    "Start",
    "Timer",
    "Toaster",
    "Upload",
    "WNW",
    "WSW",
    "Zone",
  ]),
  pt: new Set([
    "${value} offline",
    "CCTV offline",
    "ideal",
    "Magenta",
    "Script",
    "Total",
  ]),
  nl: new Set([
    "♨️ Oven",
    "⚠️ Camera offline",
    "💨 Wind",
    "🔥 Radiator",
    "🚪 Opening",
    "🛡️ ALARM",
    "${open} open",
    "${value} offline",
    "${value} units",
    "1 open",
    "1 unit",
    "Alarm",
    "Amber",
    "April",
    "Boiler",
    "Camera",
    "Computer",
    "December",
    "DETAILS",
    "DIMMER",
    "Effect",
    "Garage",
    "Grill",
    "Hatchback",
    "Indigo",
    "Label",
    "Lift",
    "Magenta",
    "Media",
    "NNW",
    "November",
    "Open",
    "OPEN",
    "Oven",
    "Printer",
    "Script",
    "September",
    "Server",
    "Server / NAS",
    "Start",
    "Timer",
    "Type",
    "Violet",
    "Warm",
    "Water",
    "WNW",
    "Zone",
  ]),
  pl: new Set([
    "🛡️ ALARM",
    "${value} offline",
    "Alarm",
    "Alert",
    "Grill",
    "Hatchback",
    "Magenta",
    "Pickup",
    "Program",
    "Start",
  ]),
  tr: new Set([
    "🛡️ ALARM",
    "Alarm",
    "Disk",
    "Fan",
    "Hatchback",
    "ideal",
    "Program",
  ]),
  ko: new Set([
    "TV",
  ]),
  /* ar, hi, ja and zh-Hans share no word with English: nothing to declare. */
};

test("the source index points at keys the catalogs answer", () => {
  const dangling = Object.entries(SOURCE_INDEX)
    .filter(([, english]) => !KEYS.has(english))
    .map(([italian]) => italian);
  assert.deepEqual(dangling, [], `source index entries with no corpus key: ${dangling.slice(0, 5).join(" | ")}`);
});

test("the source index maps Italian onto English, not onto itself", () => {
  const identity = Object.entries(SOURCE_INDEX).filter(([italian, english]) => italian === english);
  assert.deepEqual(identity, [], "an identity mapping earns nothing and hides a missing pair");
});

test("the vendored shells paint nothing the index cannot place", async () => {
  /*
   * Both shells are vendored and re-generated from upstream, so neither can be
   * fixed in place — the English one is still half-translated ("⚡ Energy
   * Erogata (da HA)"). What can be fixed is the mapping: every visible string
   * either is a key, or maps to one. Units, acronyms and product names are
   * listed as the things that legitimately stay put.
   */
  const shells = ["dashboard.html", "dashboard-en.html"];
  for (const shell of shells) {
    const html = (await readFile(path.join(I18N_DIR, "../../legacy", shell), "utf8"))
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "");
    const unreachable = new Set();
    for (const match of html.matchAll(/>([^<>]+)</g)) {
      const value = match[1].replace(/\s+/g, " ").trim();
      if (!value || value.length > 80 || !/[A-Za-zÀ-ÿ]/.test(value)) continue;
      if (KEYS.has(value) || SOURCE_INDEX[value] || UNTRANSLATED_SHELL_TEXT.has(value)) continue;
      unreachable.add(value);
    }
    assert.deepEqual(
      [...unreachable].sort(),
      [],
      `${shell} paints text nothing can translate: ${[...unreachable].slice(0, 8).join(" | ")}`,
    );
  }
});

/*
 * Shell text that stays as it is in every language: units and symbols, hardware
 * acronyms, product and protocol names, and the boot string the page shows
 * before any script has run.
 */
const UNTRANSLATED_SHELL_TEXT = new Set([
  "--°C",
  "°C",
  "CONNECTING...",
  "CPU",
  "DEL",
  "Download",
  "EV",
  "EV Smart",
  "Fast",
  "Inverter AC",
  "Inverter DC",
  "Min+Sol",
  "OK",
  "ONLINE",
  "Package ID 0 · N100 MiniPC",
  "RAM",
  "Smart Home",
  "Smart Home Dashboard",
  "Speedtest downlink",
  "Speedtest uplink",
  "Upload",
  "W",
  "Wallbox",
  "kWh",
  "— kWh",
  "— kWh &nbsp;|&nbsp; — €",
  "⚡ Wallbox",
  "⚡ Wallbox &amp; Ricarica EV",
]);

test("a catalog is fetched on demand and answers through the engine", async () => {
  const code = await loadCatalog("es-MX");
  /* The regional tag resolves to `es`, which is the file that gets fetched. */
  assert.equal(code, "es");
  assert.equal(translate("Close", "es-MX"), "Cerrar");
  assert.equal(translate("Close", "es"), "Cerrar");
});

test("an unknown locale fails soft instead of throwing", async () => {
  const code = await loadCatalog("xx");
  assert.equal(code, "en");
  assert.equal(translate("Close", "xx"), "Close");
});

test("a locale needing no catalog resolves without a fetch", async () => {
  assert.equal(await loadCatalog("en"), "en");
  assert.equal(await loadCatalog("it-IT"), "it");
});

test("registering a catalog twice merges rather than replaces", () => {
  registerCatalog("fr", { Close: "Fermer" });
  registerCatalog("fr", { Save: "Enregistrer" });
  assert.equal(translate("Close", "fr"), "Fermer");
  assert.equal(translate("Save", "fr"), "Enregistrer");
});
